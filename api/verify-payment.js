import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const json = (res,status,body) => res.status(status).setHeader('Content-Type','application/json').json(body)
export default async function handler(req,res) {
  if(req.method!=='POST') return json(res,405,{error:'Method not allowed'})
  try {
    const token=(req.headers.authorization||'').replace(/^Bearer\\s+/i,'')
    const {data:{user},error:authError}=await supabase.auth.getUser(token)
    if(authError||!user) return json(res,401,{error:'Sign in required'})
    const {razorpay_order_id,razorpay_payment_id,razorpay_signature,order_id}=req.body||{}
    if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature||!order_id) return json(res,400,{error:'Missing payment details'})
    const {data:order,error}=await supabase.from('orders').select('id,user_id,razorpay_order_id,total,status').eq('id',order_id).eq('user_id',user.id).single()
    if(error||!order||order.razorpay_order_id!==razorpay_order_id) return json(res,404,{error:'Order not found'})
    const expected=crypto.createHmac('sha256',process.env.RAZORPAY_KEY_SECRET).update(razorpay_order_id+'|'+razorpay_payment_id).digest('hex')
    const a=Buffer.from(expected), b=Buffer.from(razorpay_signature)
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return json(res,400,{error:'Payment signature verification failed'})
    const {error:paymentError}=await supabase.from('payments').update({provider_payment_id:razorpay_payment_id,status:'captured',signature_verified:true}).eq('provider_order_id',razorpay_order_id)
    if(paymentError) return json(res,500,{error:'Could not record payment'})
    await supabase.from('orders').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',order.id).in('status',['pending_payment','paid'])
    return json(res,200,{verified:true,orderNumber:order.id,status:'paid',message:'Payment verified. Voucher fulfilment will be shown in your orders.'})
  } catch(e) { console.error('verify-payment failed',e); return json(res,500,{error:'Unable to verify payment'}) }
}