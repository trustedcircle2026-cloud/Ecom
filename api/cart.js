import {db,reply,userFromRequest} from './_lib.js'
export default async function handler(req,res){
 if(!['GET','PUT'].includes(req.method))return reply(res,405,{error:'Method not allowed'})
 try{
  const user=await userFromRequest(req);if(!user)return reply(res,401,{error:'Sign in required'})
  const {data:cart,error:cartError}=await db.from('carts').upsert({user_id:user.id},{onConflict:'user_id'}).select('id').single()
  if(cartError)throw cartError
  if(req.method==='GET'){
   const {data,error}=await db.from('cart_items').select('product_id,quantity,products(id,name,brand,category,denomination,selling_price,is_active)').eq('cart_id',cart.id)
   if(error)throw error
   return reply(res,200,{items:(data||[]).filter(x=>x.products?.is_active).map(x=>({id:x.product_id,brand:x.products.brand,category:x.products.category,amount:x.products.denomination,price:x.products.selling_price,title:x.products.name,qty:x.quantity}))})
  }
  const {items}=req.body||{}
  if(!Array.isArray(items)||items.length>30)return reply(res,400,{error:'Invalid cart items'})
  const ids=[...new Set(items.map(x=>x.id))]
  if(ids.some(x=>typeof x!=='string'))return reply(res,400,{error:'Invalid product'})
  const {data:products,error:productError}=ids.length?await db.from('products').select('id,is_active').in('id',ids):{data:[],error:null}
  if(productError)throw productError
  if((products||[]).length!==ids.length||(products||[]).some(p=>!p.is_active))return reply(res,400,{error:'One or more products are unavailable'})
  const rows=items.map(x=>({cart_id:cart.id,product_id:x.id,quantity:Number(x.qty)}))
  if(rows.some(x=>!Number.isInteger(x.quantity)||x.quantity<1||x.quantity>10))return reply(res,400,{error:'Cart quantity must be between 1 and 10'})
  const {error:deleteError}=await db.from('cart_items').delete().eq('cart_id',cart.id)
  if(deleteError)throw deleteError
  if(rows.length){const {error:insertError}=await db.from('cart_items').insert(rows);if(insertError)throw insertError}
  return reply(res,200,{saved:true,item_count:rows.length})
 }catch(e){console.error('cart API',e);return reply(res,500,{error:'Unable to update your cart'})}
}
