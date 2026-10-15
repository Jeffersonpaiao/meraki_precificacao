import {context,reply} from '../../../lib/server-auth';
import {emptyData} from '../../../lib/seed';
import {z} from 'zod';
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),name:z.string().trim().min(2).max(160)}),
 z.object({action:z.literal('status'),clinicId:z.string().uuid(),active:z.boolean()}),
 z.object({action:z.literal('member'),clinicId:z.string().uuid(),email:z.string().email().max(254),role:z.enum(['administrador','gestor','operador'])}),
 z.object({action:z.literal('removeMember'),clinicId:z.string().uuid(),userId:z.string().uuid()})
]);
async function handle(request:Request,write:boolean){try{const {db}=await context(request);let payload:Record<string,unknown>={action:'list'};if(write){if(Number(request.headers.get('content-length'))>10000)return reply({error:'Requisição muito grande.'},413);const raw=await request.text();if(raw.length>10000)return reply({error:'Requisição muito grande.'},413);payload=command.parse(JSON.parse(raw));if(payload.action==='create'){const document=emptyData();document.settings.clinic=String(payload.name);payload.document=document;}}const {data,error}=await db.rpc('meraki_admin',{payload});if(error)return reply({error:error.code==='42501'?'Acesso exclusivo do administrador geral.':error.message},error.code==='42501'?403:400);return reply(data);}catch(e){return reply({error:(e as Error).message},400);}}
export const GET=(request:Request)=>handle(request,false);
export const POST=(request:Request)=>handle(request,true);
