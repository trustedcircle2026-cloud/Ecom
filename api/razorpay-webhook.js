import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
export const config={api:{bodyParser:false}}
async function rawBody(req){const chunks=[];for await(const chunk of req)chunks.push(chunk);return Buffer.concat(chunks)}
export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'})
  try{
    const body=await rawBody(req)
    const signature=req.headers['x-razorpay-signature']
    const expected=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex')
    const a=Buffer.from(expected),b=Buffer.from(signature||'')
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return res.status(400).json({error:'Invalid webhook signature'})
    const event=JSON.parse(body.toString('utf8'))
    const eventId=req.headers['x-razorpay-event-id']
    if(!eventId) return res.status(400).json({error:'Missing event id'})
    const {error:insertError}=await supabase.from('webhook_events').insert({id:eventId,event_type:event.event})
    if(insertError?.code==='23505') return res.status(200).json({received:true,duplicate:true})
    if(insertError) return res.status(500).json({error:'Could not record webhook'})
    if(event.event==='payment.captured'){
      const payment=event.payload?.payment?.entity
      const rpOrderId=payment?.order_id
      if(rpOrderId){
        const {data:order}=await supabase.from('orders').select('id').eq('razorpay_order_id',rpOrderId).maybeSingle()
        if(order){
          await supabase.from('payments').update({provider_payment_id:payment.id,status:'captured'}).eq('provider_order_id',rpOrderId)
          await supabase.from('orders').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',order.id).in('status',['pending_payment','paid'])
        }
      }
    } else if(event.event==='payment.failed'){
      const payment=event.payload?.payment?.entity
      if(payment?.order_id){
        await supabase.from('payments').update({provider_payment_id:payment.id,status:'failed'}).eq('provider_order_id',payment.order_id)
        await supabase.from('orders').update({status:'payment_failed'}).eq('razorpay_order_id',payment.order_id).eq('status','pending_payment')
      }
    }
    return res.status(200).json({received:true})
  }catch(e){console.error('razorpay webhook failed',e);return res.status(500).json({error:'Webhook processing failed'})}
}