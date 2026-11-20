import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  const {data,error}=await db.from('orders').select('id,order_number,status,total,currency,paid_at,created_at,order_items(product_name,brand,denomination,quantity)').order('created_at',{ascending:false}).limit(100)
  if(error)throw error
  return reply(res,200,{orders:data||[]})
 }catch(e){console.error('admin-orders',e);return reply(res,500,{error:'Unable to load orders'})}
}
