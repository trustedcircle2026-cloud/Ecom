import {useEffect,useState} from 'react'
import {X,Gift,Copy,RefreshCw} from 'lucide-react'
const money=n=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(n||0))
export default function MyOrders({session,onClose}){
 const [orders,setOrders]=useState([]),[vouchers,setVouchers]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const token=session?.access_token
 const load=async()=>{setBusy(true);try{const r=await fetch('/api/my-orders',{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load orders');setOrders(d.orders||[])}catch(e){setError(e.message)}finally{setBusy(false)}}
 useEffect(()=>{load()},[])
 const reveal=async id=>{setError('');try{const r=await fetch('/api/order-vouchers?orderId='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Voucher details are not ready');setVouchers(old=>({...old,[id]:d.vouchers||[]}))}catch(e){setError(e.message)}}
 const copy=text=>navigator.clipboard?.writeText(text).then(()=>setError('Voucher code copied.')).catch(()=>setError('Copy is unavailable in this browser.'))
 return <div style={{position:'fixed',inset:0,zIndex:70,background:'#10291f88',display:'flex',justifyContent:'flex-end'}}><section style={{width:'min(560px,100%)',height:'100%',overflow:'auto',background:'#fbfaf7',padding:24,color:'#234638'}}>
 <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #e5e9e1',paddingBottom:15}}><div><div style={{fontSize:9,letterSpacing:2,color:'#a57850'}}>YOUR ACCOUNT</div><h2 style={{font:'26px Georgia',margin:'7px 0 0'}}>My orders</h2></div><button onClick={onClose} style={{border:0,background:'transparent',cursor:'pointer'}}><X/></button></header>
 <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'15px 0'}}><span style={{fontSize:11,color:'#78877e'}}>Your digital gift card purchases</span><button onClick={load} style={{border:'1px solid #dce3da',background:'#fff',padding:8,cursor:'pointer'}}><RefreshCw size={15}/></button></div>
 {error&&<p role="status" style={{fontSize:11,background:'#edf2eb',padding:10}}>{error}</p>}
 {orders.map(o=><article key={o.id} style={{background:'#fff',border:'1px solid #e5e9e1',padding:15,marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',gap:10}}><div><b style={{fontSize:12}}>{o.order_number}</b><div style={{fontSize:10,color:'#839087',marginTop:5}}>{new Date(o.created_at).toLocaleString('en-IN')}</div></div><div style={{textAlign:'right'}}><b style={{fontSize:12}}>{money(o.total)}</b><div style={{fontSize:10,color:'#728579',marginTop:5}}>{o.status==='paid'?'Payment successful · Voucher pending manual fulfilment':o.status}</div></div></div>
 {(o.order_items||[]).map((i,n)=><div key={n} style={{fontSize:11,padding:'10px 0',borderTop:'1px solid #edf0ea',marginTop:9}}><b>{i.brand}</b> · {i.product_name} · {i.quantity} × {money(i.unit_price)}</div>)}
 {o.status==='fulfilled'&&<button onClick={()=>reveal(o.id)} style={{border:0,background:'#1c4435',color:'#fff',padding:'10px 13px',fontSize:10,display:'flex',alignItems:'center',gap:7,cursor:'pointer'}}><Gift size={14}/> View voucher details</button>}
 {(vouchers[o.id]||[]).map((v,n)=><div key={n} style={{background:'#f0f3ed',padding:12,marginTop:10,fontSize:11}}><div style={{fontWeight:700}}>Voucher {n+1}</div><div style={{display:'flex',justifyContent:'space-between',gap:8,marginTop:8}}><code>{v.code}</code><button onClick={()=>copy(v.code)} style={{border:0,background:'transparent',cursor:'pointer'}}><Copy size={14}/></button></div>{v.pin&&<div style={{marginTop:7}}>PIN: <b>{v.pin}</b></div>}{v.expiryDate&&<div style={{marginTop:6,color:'#78877e'}}>Expiry: {v.expiryDate}</div>}</div>)}
 </article>)}
 {!orders.length&&!busy&&<p style={{textAlign:'center',padding:45,color:'#7b8a80',fontSize:12}}>You have no orders yet.</p>}{busy&&<p style={{fontSize:11,color:'#7b8a80'}}>Loading orders…</p>}
 </section></div>
}
