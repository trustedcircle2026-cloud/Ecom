import {reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 const {user,admin}=await adminFromRequest(req)
 if(!user)return reply(res,401,{error:'Sign in required'})
 return reply(res,200,{isAdmin:admin})
}
