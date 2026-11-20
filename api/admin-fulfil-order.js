import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  const {order_id,vouchers}=req.body||{}
  if(!order_id||!Array.isArray(vouchers)||!vouchers.length)return reply(res,400,{error:'Order and voucher codes are required'})
  const {data:order,error:orderError}=await db.from('orders').select('id,status,order_items(id,quantity)').eq('id',order_id).maybeSingle()
  if(orderError)throw orderError
  if(!order)return reply(res,404,{error:'Order not found'})
  if(order.status==='fulfilled')return reply(res,409,{error:'This order is already fulfilled'})
  if(!['paid','processing'].includes(order.status))return reply(res,409,{error:'Only successfully paid orders can be fulfilled'})
  const items=order.order_items||[]
  const expected=items.reduce((n,item)=>n+Number(item.quantity),0)
  if(vouchers.length!==expected)return reply(res,400,{error:`Enter exactly ${expected} voucher code(s) for this order`})
  const counts=new Map(items.map(item=>[item.id,0]))
  const rows=[]
  for(const v of vouchers){
   const itemId=String(v.order_item_id||''),code=String(v.code||'').trim(),pin=String(v.pin||'').trim(),expiry=v.expiry_date||null
   if(!counts.has(itemId)||!code)return reply(res,400,{error:'Each voucher needs a valid order item and code'})
   if(expiry&&!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(expiry))return reply(res,400,{error:'Expiry dates must use YYYY-MM-DD'})
   counts.set(itemId,counts.get(itemId)+1)
   rows.push({order_item_id:itemId,code,pin:pin||null,expiry_date:expiry})
  }
  for(const item of items)if(counts.get(item.id)!==Number(item.quantity))return reply(res,400,{error:'Enter exactly the ordered quantity for every product line'})
  const {data:existing,error:existingError}=await db.from('order_vouchers').select('id').in('order_item_id',items.map(x=>x.id))
  if(existingError)throw existingError
  if(existing?.length)return reply(res,409,{error:'Voucher codes have already been assigned to this order'})
  const {error:insertError}=await db.from('order_vouchers').insert(rows)
  if(insertError)throw insertError
  const {error:updateError}=await db.from('orders').update({status:'fulfilled'}).eq('id',order_id).in('status',['paid','processing'])
  if(updateError){await db.from('order_vouchers').delete().in('order_item_id',items.map(x=>x.id));throw updateError}
  return reply(res,200,{success:true,status:'fulfilled',assigned:rows.length})
 }catch(e){console.error('admin fulfilment',e);return reply(res,500,{error:'Unable to save voucher codes. Please refresh the order and try again.'})}
}
