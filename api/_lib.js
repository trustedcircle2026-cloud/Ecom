import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
export const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
export const reply=(res,status,body)=>res.status(status).setHeader('Content-Type','application/json').json(body)
export async function userFromRequest(req){
 const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,'')
 if(!token)return null
 const {data:{user},error}=await db.auth.getUser(token)
 return error?null:user
}
export async function adminFromRequest(req){
 const user=await userFromRequest(req);if(!user)return {user:null,admin:false}
 const {data}=await db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle()
 return {user,admin:!!data}
}
const key=()=>{const raw=process.env.VOUCHER_ENCRYPTION_KEY||'';if(!/^[a-f0-9]{64}$/i.test(raw))throw new Error('VOUCHER_ENCRYPTION_KEY must be 64 hexadecimal characters');return Buffer.from(raw,'hex')}
export function encryptSecret(value){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key(),iv)
 const encrypted=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()])
 return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.')
}
export function decryptSecret(value){
 if(!value)return null
 const [iv,tag,data]=value.split('.')
 const decipher=crypto.createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64'))
 decipher.setAuthTag(Buffer.from(tag,'base64'))
 return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8')
}
