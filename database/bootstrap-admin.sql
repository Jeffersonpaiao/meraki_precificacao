-- Execute once through the trusted SQL console after this account has signed up
-- and confirmed its email. Never grant platform access from editable user metadata.
do $$
declare owner_id uuid;
begin
 select id into owner_id from auth.users where lower(email)='jeffersondpaiao@gmail.com' and email_confirmed_at is not null;
 if owner_id is null then raise exception 'Create and confirm the owner account first'; end if;
 insert into public.meraki_platform_admins(user_id) values(owner_id) on conflict do nothing;
end;$$;
