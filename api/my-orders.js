import {db,reply,userFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 try{
  const user=await userFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'})
  const {data,error}=await db.from('orders').select('id,order_number,status,total,currency,paid_at,created_at,order_items(id,product_name,brand,denomination,quantity,unit_price)').eq('user_id',user.id).order('created_at',{ascending:false})
  if(error)throw error
  return reply(res,200,{orders:data||[]})
 }catch(e){console.error('my-orders',e);return reply(res,500,{error:'Unable to load your orders'})}
}
