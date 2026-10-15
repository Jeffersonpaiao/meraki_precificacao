import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {emptyData} from '../lib/seed.ts';

test('database enforces platform administration, tenant isolation, roles and suspension',async()=>{
 const db=new PGlite();
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',reader='00000000-0000-4000-8000-000000000003';
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const path of ['20261013192112_meraki_initial.sql','20261015173111_meraki_platform_admin.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+path,import.meta.url),'utf8'));
 await db.query('insert into auth.users values($1,$4,now()),($2,$5,now()),($3,$6,now())',[owner,other,reader,'owner@example.com','other@example.com','reader@example.com']);
 await db.query('insert into meraki_platform_admins(user_id) values($1)',[owner]);
 async function as(user:string,fn:()=>Promise<void>){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);try{await fn();}finally{await db.exec('reset role');}}
 async function command(payload:object){return (await db.query<{result:{clinicId:string}}>('select meraki_admin($1::jsonb) as result',[JSON.stringify(payload)])).rows[0].result;}
 let a='',b='';
 await as(owner,async()=>{a=(await command({action:'create',name:'Clinic A',document:emptyData()})).clinicId;b=(await command({action:'create',name:'Clinic B',document:emptyData()})).clinicId;await command({action:'member',clinicId:b,email:'other@example.com',role:'administrador'});await command({action:'member',clinicId:a,email:'reader@example.com',role:'operador'});});
 assert.equal((await db.query('select * from meraki_workspaces')).rows.length,2);
 await as(other,async()=>{await assert.rejects(command({action:'create',name:'Illegal',document:emptyData()}),/Forbidden/);assert.equal((await db.query('select * from meraki_workspaces where clinic_id=$1',[a])).rows.length,0);assert.equal((await db.query('select * from meraki_workspaces where clinic_id=$1',[b])).rows.length,1);await assert.rejects(db.query('insert into meraki_platform_admins(user_id) values($1)',[other]),/permission denied/);});
 await as(reader,async()=>{assert.equal((await db.query('select * from meraki_workspaces')).rows.length,1);const res=await db.query('update meraki_workspaces set revision=revision+1 where clinic_id=$1 returning clinic_id',[a]);assert.equal(res.rows.length,0);});
 await as(owner,async()=>{await db.query('update meraki_workspaces set revision=1 where clinic_id=$1',[a]);await assert.rejects(db.query('update meraki_workspaces set revision=1 where clinic_id=$1',[a]),/Invalid revision/);await command({action:'status',clinicId:b,active:false});});
 await as(other,async()=>{assert.equal((await db.query('select * from meraki_workspaces')).rows.length,0);});
 assert.equal((await db.query("select * from meraki_audit where action='workspace.update'")).rows.length,1);
 await as(owner,async()=>{await command({action:'member',clinicId:a,email:'reader@example.com',role:'gestor'});});
 await as(reader,async()=>{
  await assert.rejects(db.query("update meraki_workspaces set document=jsonb_set(document,'{settings,clinic}','\"Alterada\"'),revision=revision+1 where clinic_id=$1",[a]),/Only administrators/);
  await db.query('update meraki_workspaces set revision=revision+1 where clinic_id=$1',[a]);
 });
 const before=(await db.query('select * from meraki_clinics')).rows.length;
 await as(owner,async()=>{
  await assert.rejects(command({action:'create',name:'Invalid atomic creation',document:null}),/Cadastro inválido/);
  await assert.rejects(command({action:'removeMember',clinicId:a,userId:owner}),/próprio acesso/);
  await command({action:'removeMember',clinicId:a,userId:reader});
 });
 assert.equal((await db.query('select * from meraki_clinics')).rows.length,before);
 await as(reader,async()=>{assert.equal((await db.query('select * from meraki_workspaces')).rows.length,0);});
 }finally{await db.close();}
});
