import adminFulfilOrder from '../../api/admin-fulfil-order.js'
import adminOrders from '../../api/admin-orders.js'
import adminProducts from '../../api/admin-products.js'
import adminStatus from '../../api/admin-status.js'
import adminUsers from '../../api/admin-users.js'
import cart from '../../api/cart.js'
import createOrder from '../../api/create-order.js'
import myOrders from '../../api/my-orders.js'
import orderVouchers from '../../api/order-vouchers.js'
import razorpayWebhook from '../../api/razorpay-webhook.js'
import verifyPayment from '../../api/verify-payment.js'

const routes = {
  'admin-fulfil-order': adminFulfilOrder,
  'admin-orders': adminOrders,
  'admin-products': adminProducts,
  'admin-status': adminStatus,
  'admin-users': adminUsers,
  cart,
  'create-order': createOrder,
  'my-orders': myOrders,
  'order-vouchers': orderVouchers,
  'razorpay-webhook': razorpayWebhook,
  'verify-payment': verifyPayment
}

export const handler = async event => {
  const path = event.path || new URL(event.rawUrl).pathname
  const route = path.includes('/.netlify/functions/api/')
    ? path.split('/.netlify/functions/api/')[1]
    : path.replace(/^\\/api\\//, '')
  const name = (route || '').split('/')[0].replace(/\\.js$/, '')
  const apiHandler = routes[name]
  if (!apiHandler) return { statusCode: 404, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'API route not found' }) }

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64')
    : Buffer.from(event.body || '', 'utf8')
  let body = {}
  if (raw.length && name !== 'razorpay-webhook') {
    try { body = JSON.parse(raw.toString('utf8')) } catch { return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Invalid JSON body' }) } }
  }
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]))
  const url = new URL(event.rawUrl || `https://netlify.local${path}`)
  const req = {
    method: event.httpMethod || 'GET',
    headers,
    body,
    query: Object.fromEntries(url.searchParams.entries())
  }
  if (name === 'razorpay-webhook') {
    req[Symbol.asyncIterator] = async function* () { yield raw }
  }
  let statusCode = 200
  const responseHeaders = { 'Content-Type': 'application/json' }
  let responseBody = ''
  const res = {
    status(code) { statusCode = code; return this },
    setHeader(key, value) { responseHeaders[key] = value; return this },
    json(value) { responseBody = JSON.stringify(value); return this }
  }
  try {
    await apiHandler(req, res)
    return { statusCode, headers: responseHeaders, body: responseBody || '{}' }
  } catch (error) {
    console.error('Netlify API adapter error', error)
    return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ error: 'Internal server error' }) }
  }
}
