import {db,reply,adminFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(!['GET','POST','PATCH'].includes(req.method))return reply(res,405,{error:'Method not allowed'})
 try{
  const {user,admin}=await adminFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'});if(!admin)return reply(res,403,{error:'Administrator access required'})
  if(req.method==='GET'){
   const {data,error}=await db.from('products').select('id,name,brand,category,denomination,selling_price,is_active,created_at').order('created_at',{ascending:false})
   if(error)throw error
   const products=await Promise.all((data||[]).map(async p=>{const {count}=await db.from('voucher_inventory').select('id',{count:'exact',head:true}).eq('product_id',p.id).eq('status','available');return {...p,available_stock:count||0}}))
   return reply(res,200,{products})
  }
  if(req.method==='POST'){
   const {name,brand,category,denomination,selling_price,description,image_url}=req.body||{}
   const amount=Number(denomination),price=Number(selling_price)
   if(!name?.trim()||!brand?.trim()||!category?.trim()||!Number.isInteger(amount)||amount<=0||!Number.isFinite(price)||price<=0||price>amount)return reply(res,400,{error:'Enter a name, brand, category, valid denomination and selling price (up to denomination).'})
   const {data:brandRow,error:brandError}=await db.from('brands').select('id').eq('name',brand).maybeSingle()
   if(brandError)throw brandError
   const {data,error}=await db.from('products').insert({name:name.trim(),brand:brand.trim(),brand_id:brandRow?.id||null,category:category.trim(),denomination:amount,selling_price:price,description:description||null,image_url:image_url||null,is_active:true}).select().single()
   if(error)throw error
   return reply(res,201,{product:data})
  }
  const {id,is_active}=req.body||{}
  if(!id||typeof is_active!=='boolean')return reply(res,400,{error:'Product ID and active status are required'})
  const {data,error}=await db.from('products').update({is_active}).eq('id',id).select().single()
  if(error)throw error
  return reply(res,200,{product:data})
 }catch(e){console.error('admin-products',e);return reply(res,500,{error:'Unable to manage products'})}
}
