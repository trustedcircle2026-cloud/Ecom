import { createClient } from '@supabase/supabase-js'
export const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
export const reply=(res,status,body)=>res.status(status).setHeader('Content-Type','application/json').json(body)
export async function userFromRequest(req){
 const token=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'')
 if(!token)return null
 const {data:{user},error}=await db.auth.getUser(token)
 return error?null:user
}
export async function adminFromRequest(req){
 const user=await userFromRequest(req);if(!user)return {user:null,admin:false}
 const {data}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle()
 return {user,admin:!!data}
}
