import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  const page=Math.max(1,Number(req.query?.page)||1)
  const {data,error}=await db.auth.admin.listUsers({page,perPage:100})
  if(error)throw error
  return reply(res,200,{users:(data.users||[]).map(u=>({id:u.id,email:u.email,full_name:u.user_metadata?.full_name||u.user_metadata?.name||'',avatar_url:u.user_metadata?.avatar_url||'',created_at:u.created_at,last_sign_in_at:u.last_sign_in_at,email_confirmed_at:u.email_confirmed_at})),page})
 }catch(e){console.error('admin-users',e);return reply(res,500,{error:'Unable to load customer accounts'})}
}
