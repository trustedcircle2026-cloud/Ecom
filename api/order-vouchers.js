import {db,reply,userFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{error:'Method not allowed'})
 try{
  const user=await userFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'})
  const orderId=String(req.query?.orderId||'')
  if(!orderId)return reply(res,400,{error:'Order ID is required'})
  const {data:order,error}=await db.from('orders').select('id,order_number,status,order_items(id)').eq('id',orderId).eq('user_id',user.id).maybeSingle()
  if(error)throw error
  if(!order)return reply(res,404,{error:'Order not found'})
  if(order.status!=='fulfilled')return reply(res,409,{error:'Voucher details will appear here after the administrator sends your code'})
  const ids=(order.order_items||[]).map(x=>x.id)
  const {data:vouchers,error:voucherError}=await db.from('order_vouchers').select('order_item_id,code,pin,expiry_date').in('order_item_id',ids)
  if(voucherError)throw voucherError
  return reply(res,200,{orderNumber:order.order_number,status:order.status,vouchers:(vouchers||[]).map(v=>({orderItemId:v.order_item_id,code:v.code,pin:v.pin,expiryDate:v.expiry_date}))})
 }catch(e){console.error('order-vouchers',e);return reply(res,500,{error:'Unable to retrieve voucher details'})}
}
