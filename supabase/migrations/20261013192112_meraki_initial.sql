-- Meraki Precificação: PostgreSQL 15+ / Supabase. Aplicar em projeto novo dedicado.
-- Os cadastros são um documento versionado por clínica para manter o cálculo atômico.
-- Nenhuma credencial de service_role é usada pelo aplicativo.
begin;
create schema if not exists meraki_private;
revoke all on schema meraki_private from public;

create table public.meraki_clinics (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name)>0),
 created_at timestamptz not null default now()
);
create table public.meraki_memberships (
 clinic_id uuid not null references public.meraki_clinics(id),
 user_id uuid not null references auth.users(id),
 role text not null check(role in ('administrador','gestor','operador')),
 created_at timestamptz not null default now(), primary key(clinic_id,user_id)
);
create index meraki_memberships_user_idx on public.meraki_memberships(user_id,clinic_id);
create table public.meraki_workspaces (
 clinic_id uuid primary key references public.meraki_clinics(id),
 revision integer not null default 0 check(revision>=0),
 document jsonb not null check(jsonb_typeof(document)='object' and document->>'schema'='1'),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table public.meraki_audit (
 id bigint generated always as identity primary key, clinic_id uuid not null references public.meraki_clinics(id),
 actor uuid, action text not null, revision integer, created_at timestamptz not null default now()
);
create index meraki_audit_clinic_date_idx on public.meraki_audit(clinic_id,created_at desc);
alter table public.meraki_clinics enable row level security;
alter table public.meraki_memberships enable row level security;
alter table public.meraki_workspaces enable row level security;
alter table public.meraki_audit enable row level security;
revoke all on public.meraki_clinics, public.meraki_memberships, public.meraki_workspaces, public.meraki_audit from anon, authenticated;
grant select on public.meraki_clinics, public.meraki_memberships, public.meraki_workspaces, public.meraki_audit to authenticated;
grant update(document,revision) on public.meraki_workspaces to authenticated;
create policy self_membership on public.meraki_memberships for select to authenticated using(user_id=(select auth.uid()));
create policy clinic_read on public.meraki_clinics for select to authenticated using(exists(select 1 from public.meraki_memberships m where m.clinic_id=id and m.user_id=(select auth.uid())));
create policy workspace_read on public.meraki_workspaces for select to authenticated using(exists(select 1 from public.meraki_memberships m where m.clinic_id=meraki_workspaces.clinic_id and m.user_id=(select auth.uid())));
create policy workspace_write on public.meraki_workspaces for update to authenticated
 using(exists(select 1 from public.meraki_memberships m where m.clinic_id=meraki_workspaces.clinic_id and m.user_id=(select auth.uid()) and m.role in ('administrador','gestor')))
 with check(exists(select 1 from public.meraki_memberships m where m.clinic_id=meraki_workspaces.clinic_id and m.user_id=(select auth.uid()) and m.role in ('administrador','gestor')));
create policy audit_read on public.meraki_audit for select to authenticated using(exists(select 1 from public.meraki_memberships m where m.clinic_id=meraki_audit.clinic_id and m.user_id=(select auth.uid()) and m.role in ('administrador','gestor')));

-- Trigger privado com privilégios elevados exclusivamente para auditoria imutável.
-- Verifica auth.uid() e vínculo explicitamente; não exposto pela Data API.
create function meraki_private.guard_workspace() returns trigger language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); member_role text; old_versions jsonb; new_versions jsonb; i integer;
begin
 if actor is null then raise exception 'Authentication required'; end if;
 select role into member_role from public.meraki_memberships where clinic_id=old.clinic_id and user_id=actor;
 if member_role is null or member_role not in ('administrador','gestor') then raise exception 'Forbidden'; end if;
 if new.clinic_id<>old.clinic_id or new.revision<>old.revision+1 then raise exception 'Invalid revision'; end if;
 if member_role<>'administrador' and new.document->'settings' is distinct from old.document->'settings' then raise exception 'Only administrators can change clinic settings'; end if;
 old_versions:=coalesce(old.document->'snapshots','[]'::jsonb);new_versions:=coalesce(new.document->'snapshots','[]'::jsonb);
 if jsonb_typeof(new_versions)<>'array' or jsonb_array_length(new_versions)<jsonb_array_length(old_versions) then raise exception 'Approved versions are immutable'; end if;
 if jsonb_array_length(old_versions)>0 then
  for i in 0..jsonb_array_length(old_versions)-1 loop
   if new_versions->i is distinct from old_versions->i then raise exception 'Approved versions are immutable'; end if;
  end loop;
 end if;
 if jsonb_array_length(new_versions)>jsonb_array_length(old_versions)+1 then raise exception 'Approve one version per transaction'; end if;
 new.updated_at:=now();new.updated_by:=actor;
 insert into public.meraki_audit(clinic_id,actor,action,revision) values(old.clinic_id,actor,'workspace.update',new.revision);
 return new;
end;$$;
revoke all on function meraki_private.guard_workspace() from public,anon,authenticated;
create trigger meraki_workspace_guard before update on public.meraki_workspaces for each row execute function meraki_private.guard_workspace();
commit;
