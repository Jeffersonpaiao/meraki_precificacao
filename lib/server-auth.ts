import {createClient} from '@supabase/supabase-js';
export const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function context(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('O ambiente de produção ainda não foi configurado.');
 const token=request.headers.get('authorization');
 if(!token?.startsWith('Bearer '))throw new Error('Autenticação necessária.');
 const db=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token.slice(7));
 if(error||!data.user)throw new Error('Sessão expirada ou inválida. Entre novamente.');
 return {db,user:data.user};
}
