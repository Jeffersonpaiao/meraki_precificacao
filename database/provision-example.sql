-- Execute como administrador no SQL Editor APÓS criar usuário em Authentication.
-- Substitua o UUID antes de executar. Não é executado automaticamente.
do $$
declare clinic uuid; account uuid := '00000000-0000-0000-0000-000000000000';
begin
 if not exists(select 1 from auth.users where id=account) then raise exception 'Substitua account por um usuário existente.'; end if;
 insert into public.meraki_clinics(name) values('Minha clínica') returning id into clinic;
 insert into public.meraki_memberships(clinic_id,user_id,role) values(clinic,account,'administrador');
 insert into public.meraki_workspaces(clinic_id,document) values(clinic,
 '{"schema":1,"supplies":[],"procedures":[],"taxes":[],"references":[],"snapshots":[],"audit":[],"settings":{"clinic":"Minha clínica","minimumMargin":25,"staleDays":90,"tolerance":10,"minimumReferences":3,"capacity":160,"driver":"hours","fixed":[]}}'::jsonb);
end $$;
