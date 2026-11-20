import {db,reply,userFromRequest,decryptSecret} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 try{
  const user=await userFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'})
  const orderId=String(req.query?.orderId||'')
  if(!orderId)return reply(res,400,{error:'Order ID is required'})
  const {data:order,error}=await db.from('orders').select('id,order_number,status,order_items(id,product_name,brand,denomination,quantity)').eq('id',orderId).eq('user_id',user.id).maybeSingle()
  if(error)throw error
  if(!order)return reply(res,404,{error:'Order not found'})
  if(!['fulfilled','paid','processing'].includes(order.status))return reply(res,409,{error:'Voucher details are not available until payment and fulfilment are complete'})
  const ids=(order.order_items||[]).map(x=>x.id)
  const {data:inventory,error:inventoryError}=await db.from('voucher_inventory').select('id,order_item_id,code_ciphertext,pin_ciphertext,expiry_date,status').in('order_item_id',ids).eq('status','delivered')
  if(inventoryError)throw inventoryError
  const vouchers=(inventory||[]).map(v=>({orderItemId:v.order_item_id,code:decryptSecret(v.code_ciphertext),pin:decryptSecret(v.pin_ciphertext),expiryDate:v.expiry_date}))
  return reply(res,200,{orderNumber:order.order_number,status:order.status,vouchers})
 }catch(e){console.error('order-vouchers',e);return reply(res,500,{error:'Unable to retrieve voucher details'})}
}
