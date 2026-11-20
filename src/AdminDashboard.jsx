import {useEffect,useState} from 'react'
import {X,PackagePlus,ClipboardList,RefreshCw,ShieldCheck,CheckCircle2} from 'lucide-react'

const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0))
const field={width:'100%',padding:'11px 12px',border:'1px solid #dce3da',borderRadius:5,background:'#fff',fontSize:12,color:'#234638',outlineColor:'#a77a52'}
const btn={border:0,background:'#1c4435',color:'#fff',padding:'11px 14px',borderRadius:4,fontSize:11,fontWeight:600,cursor:'pointer'}
export default function AdminDashboard({session,onClose}){
 const [tab,setTab]=useState('overview'),[products,setProducts]=useState([]),[orders,setOrders]=useState([]),[users,setUsers]=useState([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const [form,setForm]=useState({name:'',brand:'Amazon',category:'Shopping',denomination:'500',selling_price:'500',description:''})
 const [voucherDrafts,setVoucherDrafts]=useState({})
 const token=session?.access_token
 const call=async(url,options={})=>{const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(options.headers||{})}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');return d}
 const refresh=async()=>{setBusy(true);try{const [p,o,u]=await Promise.all([call('/api/admin-products'),call('/api/admin-orders'),call('/api/admin-users')]);setProducts(p.products||[]);setOrders(o.orders||[]);setUsers(u.users||[])}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 useEffect(()=>{refresh()},[])
 const update=(key,value)=>setForm(old=>({...old,[key]:value}))
 const createProduct=async e=>{e.preventDefault();setBusy(true);try{await call('/api/admin-products',{method:'POST',body:JSON.stringify(form)});setForm({name:'',brand:'Amazon',category:'Shopping',denomination:'500',selling_price:'500',description:''});setMessage('Product created successfully.');await refresh()}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 const toggle=async p=>{setBusy(true);try{await call('/api/admin-products',{method:'PATCH',body:JSON.stringify({id:p.id,is_active:!p.is_active})});await refresh()}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 const fulfil=async order=>{
  const vouchers=[]
  for(const item of order.order_items||[]){
   const raw=voucherDrafts[item.id]||''
   const lines=raw.split(String.fromCharCode(10)).map(x=>x.trim()).filter(Boolean)
   if(lines.length!==Number(item.quantity)){setMessage(item.product_name+': enter exactly '+item.quantity+' voucher code line(s).');return}
   for(const line of lines){
    const [code,pin='',expiry_date='']=line.split(',').map(x=>x.trim())
    if(!code){setMessage('Every voucher line must contain a code.');return}
    vouchers.push({order_item_id:item.id,code,pin,expiry_date:expiry_date||null})
   }
  }
  setBusy(true)
  try{const result=await call('/api/admin-fulfil-order',{method:'POST',body:JSON.stringify({order_id:order.id,vouchers})});setMessage('Order fulfilled. '+result.assigned+' voucher code(s) assigned to the customer.');setVoucherDrafts(old=>{const next={...old};(order.order_items||[]).forEach(i=>delete next[i.id]);return next});await refresh()}
  catch(e){setMessage(e.message)}finally{setBusy(false)}
 }
 const paidOrders=orders.filter(o=>['paid','processing'].includes(o.status))
 const nav=[['overview','Overview',ShieldCheck],['products','Products',PackagePlus],['orders','Orders',ClipboardList],['customers','Customers',ClipboardList]]
 return <div style={{position:'fixed',inset:0,zIndex:60,background:'#10291f88',display:'flex',justifyContent:'flex-end'}}>
  <section style={{width:'min(820px,100%)',height:'100%',overflow:'auto',background:'#f8f8f3',padding:22,color:'#234638'}}>
   <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #dfe5dc',paddingBottom:16}}>
    <div><div style={{fontSize:9,letterSpacing:2,color:'#a57850',fontWeight:700}}>TRUSTED CIRCLE · CONTROL CENTRE</div><h2 style={{fontFamily:'Georgia,serif',fontWeight:500,margin:'7px 0 0'}}>Admin workspace</h2></div>
    <button onClick={onClose} style={{border:0,background:'transparent',padding:8,cursor:'pointer'}}><X/></button>
   </header>
   <nav style={{display:'flex',gap:7,overflowX:'auto',padding:'16px 0'}}>{nav.map(([id,label,Icon])=><button key={id} onClick={()=>setTab(id)} style={{...btn,background:tab===id?'#1c4435':'#e8eee7',color:tab===id?'#fff':'#315344',whiteSpace:'nowrap',display:'flex',alignItems:'center',gap:7}}><Icon size={15}/>{label}</button>)}<button onClick={refresh} style={{...btn,marginLeft:'auto',background:'#fff',color:'#315344',border:'1px solid #dce3da'}}><RefreshCw size={15}/></button></nav>
   {message&&<div role="status" style={{padding:12,background:'#edf2eb',border:'1px solid #d8e3d5',fontSize:11,marginBottom:14,display:'flex',justifyContent:'space-between',gap:10}}>{message}<button onClick={()=>setMessage('')} style={{border:0,background:'transparent',cursor:'pointer'}}>×</button></div>}
   {tab==='overview'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(145px,1fr))',gap:12}}>
    {[['Active products',products.filter(p=>p.is_active).length],['Total products',products.length],['Total orders',orders.length],['Paid · awaiting codes',paidOrders.length],['Customer accounts',users.length]].map(([label,value])=><div key={label} style={{background:'#fff',border:'1px solid #e2e7df',padding:17}}><div style={{fontSize:10,color:'#7a8a80'}}>{label}</div><div style={{fontSize:28,fontFamily:'Georgia,serif',marginTop:8}}>{value}</div></div>)}
    <div style={{gridColumn:'1/-1',background:'#fff',padding:18,border:'1px solid #e2e7df'}}><h3 style={{font:'18px Georgia',margin:'0 0 12px'}}>Recent orders</h3>{orders.slice(0,6).map(o=><div key={o.id} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'10px 0',borderTop:'1px solid #edf0ea',fontSize:11}}><span>{o.order_number} · {o.status}</span><b>{money(o.total)}</b></div>)}{!orders.length&&<p style={{fontSize:11,color:'#7a8a80'}}>No orders received yet.</p>}</div>
   </div>}
   {tab==='products'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))',gap:18}}>
    <form onSubmit={createProduct} style={{background:'#fff',padding:18,border:'1px solid #e2e7df',display:'grid',gap:10}}><h3 style={{font:'18px Georgia',margin:0}}>Add gift card product</h3>
     <input required placeholder="Product name" value={form.name} onChange={e=>update('name',e.target.value)} style={field}/>
     <select value={form.brand} onChange={e=>update('brand',e.target.value)} style={field}>{['Amazon','Flipkart','Myntra','Swiggy','Zomato','Tata CLiQ','Croma','Other brands'].map(x=><option key={x}>{x}</option>)}</select>
     <select value={form.category} onChange={e=>update('category',e.target.value)} style={field}>{['Shopping','Fashion','Food & dining','Electronics','Other'].map(x=><option key={x}>{x}</option>)}</select>
     <input required type="number" min="1" placeholder="Voucher denomination" value={form.denomination} onChange={e=>update('denomination',e.target.value)} style={field}/>
     <input required type="number" min="1" step=".01" placeholder="Selling price (INR)" value={form.selling_price} onChange={e=>update('selling_price',e.target.value)} style={field}/>
     <textarea placeholder="Description (optional)" value={form.description} onChange={e=>update('description',e.target.value)} style={{...field,minHeight:65}}/>
     <button disabled={busy} style={btn}><PackagePlus size={15}/> Create product</button>
    </form>
    <div style={{background:'#fff',padding:18,border:'1px solid #e2e7df'}}><h3 style={{font:'18px Georgia',margin:'0 0 12px'}}>Product catalogue</h3>{products.map(p=><div key={p.id} style={{padding:'12px 0',borderTop:'1px solid #edf0ea',display:'flex',justifyContent:'space-between',gap:8,fontSize:11}}><span><b>{p.brand}</b><br/>{p.name} · {money(p.selling_price)}<br/><span style={{color:'#7b8b80'}}>Unlimited ordering · Admin fulfils after payment</span></span><button onClick={()=>toggle(p)} style={{...btn,padding:'7px 9px',background:p.is_active?'#e9eee8':'#f5e9e5',color:p.is_active?'#315344':'#965b47'}}>{p.is_active?'Active':'Inactive'}</button></div>)}</div>
   </div>}
   {tab==='orders'&&<div style={{display:'grid',gap:13}}><div style={{fontSize:11,color:'#718176'}}>Paid orders stay in this queue until you enter the actual gift-card code(s) and submit fulfilment. Codes are stored as entered; no voucher stock upload or encryption key is used.</div>
    {orders.map(o=><article key={o.id} style={{background:'#fff',padding:17,border:'1px solid #e2e7df'}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><div><b style={{fontSize:13}}>{o.order_number}</b><div style={{fontSize:10,color:'#7b8b80',marginTop:5}}>{new Date(o.created_at).toLocaleString('en-IN')} · {o.status.toUpperCase()}</div></div><b>{money(o.total)}</b></div>
     {(o.order_items||[]).map(item=><div key={item.id} style={{borderTop:'1px solid #edf0ea',marginTop:12,paddingTop:12}}><div style={{fontSize:11,fontWeight:700}}>{item.brand} · {item.product_name} · {item.quantity} × {money(item.unit_price)}</div>{['paid','processing'].includes(o.status)&&<><label style={{display:'block',fontSize:10,color:'#718176',margin:'9px 0 6px'}}>Enter {item.quantity} voucher code line(s): code,pin,expiry-date (PIN and expiry optional)</label><textarea value={voucherDrafts[item.id]||''} onChange={e=>setVoucherDrafts(old=>({...old,[item.id]:e.target.value}))} placeholder={'SAMPLE-CODE-001,1234,2027-12-31'+(item.quantity>1?'\\nSAMPLE-CODE-002,,':'' )} style={{...field,minHeight:Math.max(70,Number(item.quantity)*34),fontFamily:'monospace'}}/></>}</div>)}
     {['paid','processing'].includes(o.status)&&<button disabled={busy} onClick={()=>fulfil(o)} style={{...btn,marginTop:14,display:'inline-flex',alignItems:'center',gap:7}}><CheckCircle2 size={15}/> Save codes & mark fulfilled</button>}
     {o.status==='fulfilled'&&<div style={{marginTop:12,color:'#39734e',fontSize:11,display:'flex',alignItems:'center',gap:6}}><CheckCircle2 size={15}/> Voucher codes sent to customer account</div>}
    </article>)}
    {!orders.length&&<div style={{background:'#fff',padding:30,textAlign:'center',fontSize:12,color:'#7b8b80'}}>No orders yet.</div>}
   </div>}
   {tab==='customers'&&<div style={{background:'#fff',padding:18,border:'1px solid #e2e7df'}}><h3 style={{font:'18px Georgia',margin:'0 0 12px'}}>Customer accounts</h3>{users.map(u=><div key={u.id} style={{padding:'12px 0',borderTop:'1px solid #edf0ea',display:'flex',justifyContent:'space-between',gap:12,fontSize:11}}><div><b>{u.full_name||'Google user'}</b><div style={{color:'#7b8b80',marginTop:4}}>{u.email}</div><div style={{color:'#7b8b80',marginTop:4}}>Joined {new Date(u.created_at).toLocaleDateString('en-IN')} · Last sign-in {u.last_sign_in_at?new Date(u.last_sign_in_at).toLocaleDateString('en-IN'):'Never'}</div></div><span style={{color:u.email_confirmed_at?'#39734e':'#9a7048'}}>{u.email_confirmed_at?'Verified':'Unverified'}</span></div>)}{!users.length&&<p style={{fontSize:11,color:'#7a8a80'}}>No customer accounts found.</p>}</div>}
   {busy&&<p style={{fontSize:10,color:'#7a8a80'}}>Working…</p>}
   <p style={{fontSize:10,color:'#8a978e',lineHeight:1.6,marginTop:22}}>Administrator-only order fulfilment. Enter real voucher codes only after payment is confirmed.</p>
  </section>
 </div>
}
