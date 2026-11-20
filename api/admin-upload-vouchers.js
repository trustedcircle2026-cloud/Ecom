import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(req.method!=='POST')return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  const {product_id,vouchers}=req.body||{}
  if(typeof product_id!=='string'||!Array.isArray(vouchers)||!vouchers.length||vouchers.length>500)return reply(res,400,{error:'Select a product and provide 1–500 vouchers'})
  const {data:product,error:productError}=await db.from('products').select('id').eq('id',product_id).eq('is_active',true).maybeSingle()
  if(productError)throw productError
  if(!product)return reply(res,404,{error:'Active product not found'})
  const rows=[]
  for(const item of vouchers){
   const code=String(item?.code||'').trim(),pin=String(item?.pin||'').trim(),expiry=item?.expiry_date||null
   if(!code)return reply(res,400,{error:'Every voucher row must contain a voucher code'})
   if(expiry&&!/^\\d{4}-\\d{2}-\\d{2}$/.test(expiry))return reply(res,400,{error:'Expiry dates must use YYYY-MM-DD'})
   rows.push({product_id,code,pin:pin||null,expiry_date:expiry,status:'available',uploaded_by:user.id})
  }
  const {error}=await db.from('voucher_inventory').insert(rows)
  if(error)throw error
  return reply(res,201,{uploaded:rows.length,message:'Voucher codes uploaded'})
 }catch(e){console.error('voucher upload',e);return reply(res,500,{error:'Unable to upload voucher inventory'})}
}
