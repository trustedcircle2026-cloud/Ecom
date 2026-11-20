import crypto from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const json=(res,status,body)=>res.status(status).setHeader('Content-Type','application/json').json(body)
export default async function handler(req,res){
 if(req.method!=='POST')return json(res,405,{error:'Method not allowed'})
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'')
  const {data:{user},error:authError}=await supabase.auth.getUser(token)
  if(authError||!user)return json(res,401,{error:'Sign in required'})
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature,order_id}=req.body||{}
  if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature||!order_id)return json(res,400,{error:'Missing payment details'})
  const {data:order,error}=await supabase.from('orders').select('id,order_number,user_id,razorpay_order_id,total,status').eq('id',order_id).eq('user_id',user.id).single()
  if(error||!order||order.razorpay_order_id!==razorpay_order_id)return json(res,404,{error:'Order not found'})
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id+'|'+razorpay_payment_id).digest('hex')
  const a=Buffer.from(expected),b=Buffer.from(razorpay_signature)
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return json(res,400,{error:'Payment signature verification failed'})
  const credentials=Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64')
  const providerResponse=await fetch('https://api.razorpay.com/v1/payments/'+encodeURIComponent(razorpay_payment_id),{headers:{Authorization:'Basic '+credentials}})
  const providerPayment=await providerResponse.json()
  if(!providerResponse.ok||providerPayment.order_id!==razorpay_order_id||providerPayment.amount!==Math.round(Number(order.total)*100)||providerPayment.currency!=='INR'||providerPayment.status!=='captured')return json(res,409,{error:'Payment is not captured for the expected order amount'})
  const {error:paymentError}=await supabase.from('payments').update({provider_payment_id:razorpay_payment_id,status:'captured',signature_verified:true}).eq('provider_order_id',razorpay_order_id)
  if(paymentError)return json(res,500,{error:'Could not record payment'})
  const {error:orderUpdateError}=await supabase.from('orders').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',order.id).in('status',['pending_payment','paid'])
  if(orderUpdateError)return json(res,500,{error:'Payment verified but order update is pending'})
  return json(res,200,{verified:true,orderNumber:order.order_number,status:'paid',message:'Payment successful. Your order is confirmed. Our team will manually assign your voucher.'})
 }catch(e){console.error('verify-payment failed',e);return json(res,500,{error:'Unable to verify payment'})}
}
