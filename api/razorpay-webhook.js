import crypto from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
export const config={api:{bodyParser:false}}
async function rawBody(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks)}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
 try{
  const body=await rawBody(req),signature=req.headers['x-razorpay-signature']
  const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex')
  const a=Buffer.from(expected),b=Buffer.from(signature||'')
  if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return res.status(400).json({error:'Invalid webhook signature'})
  const event=JSON.parse(body.toString('utf8')),eventId=req.headers['x-razorpay-event-id']
  if(!eventId)return res.status(400).json({error:'Missing event id'})
  const payment=event.payload?.payment?.entity
  if(event.event==='payment.captured'&&payment?.order_id){
   const {data:order,error}=await supabase.from('orders').select('id,total,currency').eq('razorpay_order_id',payment.order_id).maybeSingle()
   if(error)throw error
   if(order&&payment.amount!==Math.round(Number(order.total)*100))throw new Error('Captured payment amount does not match order total')
   if(order&&payment.currency!==order.currency)throw new Error('Captured payment currency does not match order currency')
   if(order){
    const {error:paymentError}=await supabase.from('payments').update({provider_payment_id:payment.id,status:'captured',signature_verified:true}).eq('provider_order_id',payment.order_id)
    if(paymentError)throw paymentError
    const {error:orderError}=await supabase.from('orders').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',order.id).in('status',['pending_payment','paid'])
    if(orderError)throw orderError
    const {error:fulfilError}=await supabase.rpc('fulfil_paid_order',{p_order_id:order.id})
    if(fulfilError)console.error('Voucher fulfilment pending inventory review',order.id,fulfilError)
   }
  }else if(event.event==='payment.failed'&&payment?.order_id){
   const {error:paymentError}=await supabase.from('payments').update({provider_payment_id:payment.id,status:'failed'}).eq('provider_order_id',payment.order_id)
   if(paymentError)throw paymentError
   const {data:order}=await supabase.from('orders').select('id').eq('razorpay_order_id',payment.order_id).maybeSingle()
   if(order){const {data:items}=await supabase.from('order_items').select('id').eq('order_id',order.id);const {error:releaseError}=await supabase.from('voucher_inventory').update({status:'available',order_item_id:null,reserved_until:null}).eq('status','reserved').in('order_item_id',(items||[]).map(x=>x.id));if(releaseError)throw releaseError}
   const {error:orderError}=await supabase.from('orders').update({status:'payment_failed'}).eq('razorpay_order_id',payment.order_id).eq('status','pending_payment')
   if(orderError)throw orderError
  }
  const {error:insertError}=await supabase.from('webhook_events').insert({id:eventId,event_type:event.event})
  if(insertError?.code==='23505')return res.status(200).json({received:true,duplicate:true})
  if(insertError)throw insertError
  return res.status(200).json({received:true})
 }catch(e){console.error('Razorpay webhook processing failed',e);return res.status(500).json({error:'Webhook processing failed'})}
}
