import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const json = (res, status, body) => res.status(status).setHeader('Content-Type','application/json').json(body)

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res,405,{error:'Method not allowed'})
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i,'')
    if (!token) return json(res,401,{error:'Sign in required'})
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) return json(res,401,{error:'Invalid session'})
    const { items } = req.body || {}
    if (!Array.isArray(items) || !items.length || items.length > 30) return json(res,400,{error:'Invalid cart'})
    const ids = [...new Set(items.map(x => x.productId))]
    if (ids.some(x => typeof x !== 'string')) return json(res,400,{error:'Invalid product'})
    const { data: products, error } = await supabase.from('products').select('id,name,brand,denomination,selling_price,is_active').in('id',ids).eq('is_active',true)
    if (error || !products || products.length !== ids.length) return json(res,400,{error:'One or more products are unavailable'})
    let subtotal = 0
    const lines = []
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      const qty = Number(item.quantity)
      if (!product || !Number.isInteger(qty) || qty < 1 || qty > 10) return json(res,400,{error:'Invalid cart quantity'})
      const { count } = await supabase.from('voucher_inventory').select('id',{count:'exact',head:true}).eq('product_id',product.id).eq('status','available')
      if ((count || 0) < qty) return json(res,409,{error:product.brand + ' voucher is currently out of stock'})
      subtotal += Number(product.selling_price) * qty
      lines.push({ product_id:product.id, product_name:product.name, brand:product.brand, denomination:product.denomination, quantity:qty, unit_price:product.selling_price })
    }
    if (!Number.isFinite(subtotal) || subtotal <= 0) return json(res,400,{error:'Invalid order amount'})
    const orderNumber = 'TC' + Date.now().toString()
    const { data: order, error: orderError } = await supabase.from('orders').insert({ order_number:orderNumber,user_id:user.id,status:'pending_payment',subtotal,total:subtotal }).select().single()
    if (orderError) return json(res,500,{error:'Could not create order'})
    const { error: lineError } = await supabase.from('order_items').insert(lines.map(x=>({...x,order_id:order.id})))
    if (lineError) { await supabase.from('orders').delete().eq('id',order.id); return json(res,500,{error:'Could not create order items'}) }
    const credentials = Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64')
    const rp = await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:'Basic '+credentials,'Content-Type':'application/json'},body:JSON.stringify({amount:Math.round(subtotal*100),currency:'INR',receipt:orderNumber,notes:{internal_order_id:order.id,user_id:user.id}})})
    const paymentOrder = await rp.json()
    if (!rp.ok) { await supabase.from('orders').update({status:'payment_failed'}).eq('id',order.id); return json(res,502,{error:'Payment provider could not create the order'}) }
    await supabase.from('orders').update({razorpay_order_id:paymentOrder.id}).eq('id',order.id)
    await supabase.from('payments').insert({order_id:order.id,provider_order_id:paymentOrder.id,amount:subtotal,currency:'INR',status:'created'})
    return json(res,200,{orderId:order.id,orderNumber,razorpayOrderId:paymentOrder.id,amount:paymentOrder.amount,currency:paymentOrder.currency,keyId:process.env.RAZORPAY_KEY_ID})
  } catch (e) { console.error('create-order failed',e); return json(res,500,{error:'Unable to start checkout'}) }
}