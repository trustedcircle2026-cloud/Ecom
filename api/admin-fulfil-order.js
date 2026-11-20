import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  const {order_id}=req.body||{};if(!order_id)return reply(res,400,{error:'Order ID is required'})
  const {data,error}=await db.rpc('fulfil_paid_order',{p_order_id:order_id})
  if(error)return reply(res,409,{error:error.message||'Could not fulfil order. Check voucher stock.'})
  return reply(res,200,{result:data})
 }catch(e){console.error('admin fulfilment',e);return reply(res,500,{error:'Unable to fulfil order'})}
}
