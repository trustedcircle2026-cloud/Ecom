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
  const {data:order,error}=await supabase.from('orders').select('id,order_number,user_id,razorpay_order_id,status').eq('id',order_id).eq('user_id',user.id).single()
  if(error||!order||order.razorpay_order_id!==razorpay_order_id)return json(res,404,{error:'Order not found'})
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id+'|'+razorpay_payment_id).digest('hex')
  const a=Buffer.from(expected),b=Buffer.from(razorpay_signature)
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return json(res,400,{error:'Payment signature verification failed'})
  // Browser callback is only an acknowledgement. The signed Razorpay webhook is the source of truth for PAID status.
  return json(res,200,{received:true,status:'awaiting_webhook',orderNumber:order.order_number,message:'Payment response received. Your order will be marked paid after Razorpay webhook confirmation.'})
 }catch(e){console.error('payment callback acknowledgement failed',e);return json(res,500,{error:'Unable to acknowledge payment response'})}
}
