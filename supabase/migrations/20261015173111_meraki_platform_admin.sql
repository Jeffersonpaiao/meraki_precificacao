begin;
alter table public.meraki_clinics add column active boolean not null default true;
create table public.meraki_platform_admins(user_id uuid primary key references auth.users(id),created_at timestamptz not null default now());
alter table public.meraki_platform_admins enable row level security;
revoke all on public.meraki_platform_admins from anon,authenticated;
grant select on public.meraki_platform_admins to authenticated;
create policy own_admin on public.meraki_platform_admins for select to authenticated using(user_id=(select auth.uid()));
create policy active_workspace on public.meraki_workspaces as restrictive for all to authenticated
 using(exists(select 1 from public.meraki_clinics c where c.id=clinic_id and c.active))
 with check(exists(select 1 from public.meraki_clinics c where c.id=clinic_id and c.active));

create function meraki_private.admin_command(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); action text:=payload->>'action'; clinic uuid; target_user uuid; result jsonb;
begin
 if actor is null or not exists(select 1 from public.meraki_platform_admins where user_id=actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 if action='list' then
  select jsonb_build_object('clinics',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'active',c.active,'created_at',c.created_at,'members',coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'email',u.email,'role',m.role)) from public.meraki_memberships m join auth.users u on u.id=m.user_id where m.clinic_id=c.id),'[]'::jsonb)) order by c.created_at desc) from public.meraki_clinics c),'[]'::jsonb)) into result;
  return result;
 elsif action='create' then
  if length(btrim(payload->>'name')) not between 2 and 160 or payload->'document'->>'schema' is distinct from '1' then raise exception 'Cadastro inválido'; end if;
  insert into public.meraki_clinics(name) values(btrim(payload->>'name')) returning id into clinic;
  insert into public.meraki_memberships(clinic_id,user_id,role) values(clinic,actor,'administrador');
  insert into public.meraki_workspaces(clinic_id,document) values(clinic,payload->'document');
 elsif action in ('status','member','removeMember') then
  clinic:=(payload->>'clinicId')::uuid;
  perform 1 from public.meraki_clinics where id=clinic for update;
  if not found then raise exception 'Clínica não encontrada'; end if;
  if action='status' then
   if jsonb_typeof(payload->'active') is distinct from 'boolean' then raise exception 'Status inválido'; end if;
   update public.meraki_clinics set active=(payload->>'active')::boolean where id=clinic;
  elsif action='member' then
   select id into target_user from auth.users where lower(email)=lower(payload->>'email') and email_confirmed_at is not null;
   if target_user is null then raise exception 'Usuário não encontrado ou e-mail ainda não confirmado.'; end if;
   if payload->>'role' is null or payload->>'role' not in ('administrador','gestor','operador') then raise exception 'Perfil inválido'; end if;
   if target_user=actor and payload->>'role'<>'administrador' then raise exception 'Não remova seu próprio acesso administrativo.'; end if;
   insert into public.meraki_memberships(clinic_id,user_id,role) values(clinic,target_user,payload->>'role') on conflict(clinic_id,user_id) do update set role=excluded.role;
  else
   target_user:=(payload->>'userId')::uuid;
   if target_user=actor then raise exception 'Não remova seu próprio acesso administrativo.'; end if;
   delete from public.meraki_memberships where clinic_id=clinic and user_id=target_user;
  end if;
 else raise exception 'Operação inválida'; end if;
 insert into public.meraki_audit(clinic_id,actor,action) values(clinic,actor,'platform.'||action||coalesce(':'||target_user::text,''));
 return jsonb_build_object('ok',true,'clinicId',clinic);
end;$$;
revoke all on function meraki_private.admin_command(jsonb) from public,anon,authenticated;
grant usage on schema meraki_private to authenticated;
grant execute on function meraki_private.admin_command(jsonb) to authenticated;
-- The elevated function stays outside the exposed API schema. Both direct and
-- wrapper calls verify the authenticated actor against a non-user-writable table.
create function public.meraki_admin(payload jsonb) returns jsonb language sql security invoker set search_path='' as $$ select meraki_private.admin_command(payload); $$;
revoke all on function public.meraki_admin(jsonb) from public,anon;
grant execute on function public.meraki_admin(jsonb) to authenticated;
commit;
