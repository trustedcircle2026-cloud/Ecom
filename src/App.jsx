import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowUpRight, Check, ChevronDown, Gift, Heart, Menu, Search, ShoppingBag, ShieldCheck, Sparkles, UserRound, X, LogOut, LayoutDashboard, Package, Plus, Minus, Trash2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import AdminDashboard from './AdminDashboard.jsx'
import MyOrders from './MyOrders.jsx'

const brands = [
  { name: 'Amazon', category: 'Shopping', color: '#f5a623', mark: 'a' },
  { name: 'Flipkart', category: 'Shopping', color: '#2874f0', mark: 'F' },
  { name: 'Myntra', category: 'Fashion', color: '#ed3f83', mark: 'M' },
  { name: 'Swiggy', category: 'Food & dining', color: '#f47b20', mark: 'S' },
  { name: 'Zomato', category: 'Food & dining', color: '#e23744', mark: 'Z' },
  { name: 'Tata CLiQ', category: 'Shopping', color: '#5c2d91', mark: 'T' },
  { name: 'Croma', category: 'Electronics', color: '#16a085', mark: 'C' },
  { name: 'More brands', category: 'Explore', color: '#244d40', mark: '+' }
]
const starterProducts = brands.slice(0, 7).flatMap((b, i) => [500, 1000, 2000].map((amount, j) => ({
  id: b.name.toLowerCase().replaceAll(' ', '-') + '-' + amount, brand: b.name, category: b.category,
  amount, price: amount, color: b.color, badge: j === 2 ? 'Popular' : j === 0 && i % 2 === 0 ? 'Quick gift' : ''
})))
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [products, setProducts] = useState(starterProducts)
  const [cart, setCart] = useState(() => JSON.parse(localStorage.getItem('tc-cart') || '[]'))
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [cartOpen, setCartOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ordersOpen, setOrdersOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('tc-cart', JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) { setProfile(null); setIsAdmin(false); return }
    fetch('/api/admin-status',{headers:{Authorization:'Bearer '+session.access_token}}).then(r=>r.json()).then(d=>setIsAdmin(Boolean(d.isAdmin))).catch(()=>setIsAdmin(false))
    setProfile({ name: session.user.user_metadata?.full_name || session.user.email, email: session.user.email, avatar: session.user.user_metadata?.avatar_url })
    if (supabase) supabase.from('products').select('id,name,brand,category,denomination,selling_price,is_active').eq('is_active', true).then(({ data, error }) => {
      if (!error && data?.length) setProducts(data.map(p => ({ id:p.id, brand:p.brand, category:p.category, amount:p.denomination, price:p.selling_price, title:p.name, color: brands.find(b=>b.name===p.brand)?.color || '#244d40' })))
    })
  }, [session])

  const categories = ['All', 'Shopping', 'Fashion', 'Food & dining', 'Electronics']
  const filtered = useMemo(() => products.filter(p => (category === 'All' || p.category === category) && (p.brand + ' ' + p.category + ' ' + p.amount).toLowerCase().includes(query.toLowerCase())), [products, category, query])
  const count = cart.reduce((n, item) => n + item.qty, 0)
  const total = cart.reduce((n, item) => n + item.price * item.qty, 0)
  const add = product => { setCart(old => { const found = old.find(x => x.id === product.id); return found ? old.map(x => x.id === product.id ? {...x, qty:x.qty+1} : x) : [...old, {...product, qty:1}] }); setNotice('Added to your bag'); setCartOpen(true) }
  const changeQty = (id, delta) => setCart(old => old.map(x => x.id === id ? {...x, qty:x.qty+delta} : x).filter(x => x.qty > 0))
  const signIn = async () => {
    if (!supabase) { setNotice('Add your Supabase URL and anon key in Vercel environment variables first.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:window.location.origin } })
    if (error) setNotice(error.message)
    setLoading(false)
  }
  const signOut = async () => { await supabase?.auth.signOut(); setAccountOpen(false); setNotice('You have signed out.') }
  const checkout = async () => {
    if (!session) { setCartOpen(false); setNotice('Sign in with Google to continue to checkout.'); setAccountOpen(true); return }
    if (!cart.length || !supabase) return
    setLoading(true)
    try {
      const { data:{session:activeSession} } = await supabase.auth.getSession()
      const response = await fetch('/api/create-order', { method:'POST', headers:{'Content-Type':'application/json',Authorization:'Bearer '+activeSession.access_token}, body:JSON.stringify({items:cart.map(x=>({productId:x.id,quantity:x.qty}))}) })
      const order = await response.json()
      if (!response.ok) throw new Error(order.error || 'Could not start checkout')
      if (!window.Razorpay) await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://checkout.razorpay.com/v1/checkout.js';script.onload=resolve;script.onerror=()=>reject(new Error('Unable to load payment checkout'));document.body.appendChild(script)})
      const razorpay = new window.Razorpay({
        key:order.keyId, amount:order.amount, currency:order.currency, name:'Trusted Circle',
        description:'Digital gift card purchase', order_id:order.razorpayOrderId,
        prefill:{name:profile?.name,email:profile?.email}, theme:{color:'#1c4435'},
        handler:async payment=>{
          try {
            const verified=await fetch('/api/verify-payment',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+activeSession.access_token},body:JSON.stringify({...payment,order_id:order.orderId})})
            const result=await verified.json()
            if(!verified.ok) throw new Error(result.error || 'Payment verification failed')
            setCart([]);setCartOpen(false);setNotice('Payment verified. Your order is being prepared.')
          } catch(e) { setNotice(e.message || 'Payment verification failed') }
        },
        modal:{ondismiss:()=>setNotice('Checkout closed. Your order remains unpaid until payment is verified.')}
      })
      razorpay.on('payment.failed',r=>setNotice(r.error?.description || 'Payment failed. Please try again.'))
      razorpay.open()
    } catch(e) { setNotice(e.message || 'Unable to start checkout') }
    finally { setLoading(false) }
  }

  return <div className="app">
    <div className="announcement"><Sparkles size={13}/> A little joy, delivered instantly <span>•</span> Digital gift cards, made easy</div>
    <header className="header">
      <a className="logo" href="#"><span className="logo-icon"><Gift size={21}/></span><span>trusted<span className="logo-light">circle</span><small>GIFTS THAT FEEL RIGHT</small></span></a>
      <nav className="desktop-nav"><a href="#shop">Explore gifts</a><a href="#brands">Brands</a><a href="#how">How it works</a></nav>
      <div className="header-actions">
        <button className="icon-btn search-toggle" onClick={()=>document.getElementById('search')?.focus()} aria-label="Search"><Search/></button>
        <button className="icon-btn" onClick={()=>setAccountOpen(true)} aria-label="Account"><UserRound/></button>
        <button className="bag-btn" onClick={()=>setCartOpen(true)}><ShoppingBag size={18}/><span>Bag</span><b>{count}</b></button>
      </div>
    </header>
    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><span/> THE GIFT OF CHOICE</div><h1>Make their day.<br/><em>In one click.</em></h1><p>Thoughtful gifting, without the guesswork. Shop digital gift cards from the brands they already love.</p><a className="primary-btn" href="#shop">Explore gift cards <ArrowUpRight size={17}/></a><div className="hero-proof"><span className="proof-avatars">✦ ✦ ✦</span><span>Simple. Instant. Always appreciated.</span></div></div>
        <div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="gift-card card-back"><span> A LITTLE SOMETHING</span><b>For you.</b><i>✳</i></div><div className="gift-card card-front"><div className="card-top"><span>trustedcircle</span><Gift size={20}/></div><div className="card-spark">✳</div><div className="card-bottom"><b>Good things<br/>are coming.</b><span>DIGITAL GIFT CARD</span></div></div><div className="float-tag tag-top"><Sparkles size={14}/> Instant delivery</div><div className="float-tag tag-bottom"><Heart size={14}/> Picked with love</div></div>
      </section>
      <section className="trust-strip"><div><ShieldCheck/><span>Secure checkout</span></div><div><Gift/><span>100% digital gifts</span></div><div><ArrowRight/><span>Easy to redeem</span></div><div><Check/><span>Delivered to your inbox</span></div></section>
      <section className="brands-section" id="brands"><div className="section-heading"><div><div className="eyebrow">A BRAND FOR EVERYONE</div><h2>They love these. <em>Trust us.</em></h2></div><a href="#shop">View all gifts <ArrowRight size={16}/></a></div><div className="brand-grid">{brands.map(b=><button className="brand-tile" key={b.name} onClick={()=>{setCategory(b.category==='Explore'?'All':b.category);document.getElementById('shop').scrollIntoView({behavior:'smooth'})}}><span className="brand-mark" style={{'--brand':b.color}}>{b.mark}</span><span>{b.name}</span><ArrowUpRight size={14}/></button>)}</div></section>
      <section className="shop-section" id="shop"><div className="section-heading"><div><div className="eyebrow">THE GOOD STUFF</div><h2>Find their <em>kind of happy.</em></h2></div><div className="search-box"><Search size={17}/><input id="search" placeholder="Search brands or gifts..." value={query} onChange={e=>setQuery(e.target.value)}/></div></div><div className="filter-row">{categories.map(c=><button key={c} className={category===c?'filter active':'filter'} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="product-grid">{filtered.map((p,i)=><article className="product-card" key={p.id}><div className="product-visual" style={{'--brand':p.color}}><div className="visual-label">trustedcircle <span>GIFT CARD</span></div><div className="visual-amount">{money(p.amount)}</div><div className="visual-brand">{p.brand}</div><div className="visual-flower">✳</div>{p.badge&&<span className="product-badge">{p.badge}</span>}</div><div className="product-info"><div><span className="product-category">{p.category}</span><h3>{p.title || p.brand} Gift Card</h3><p>{money(p.amount)} voucher</p></div><button className="add-btn" onClick={()=>add(p)} aria-label={'Add '+p.brand+' gift card'}><Plus size={18}/></button></div></article>)}</div>{filtered.length===0&&<div className="empty-state">No gift cards match that search. Try another brand.</div>}</section>
      <section className="how-section" id="how"><div className="eyebrow">THOUGHTFUL MADE SIMPLE</div><h2>Three steps to <em>their smile.</em></h2><div className="steps"><div><span>01</span><Gift/><h3>Choose their favourite</h3><p>Pick a brand and the gift card value that feels just right.</p></div><div><span>02</span><ShieldCheck/><h3>Checkout securely</h3><p>A smooth, secure payment experience from start to finish.</p></div><div><span>03</span><ArrowUpRight/><h3>Make someone's day</h3><p>The digital voucher arrives in their inbox, ready to enjoy.</p></div></div></section>
      <section className="closing-cta"><div><div className="eyebrow">GOOD GIFTS. ZERO GUESSWORK.</div><h2>Go on. Make<br/><em>someone smile.</em></h2></div><a className="light-btn" href="#shop">Find a gift <ArrowUpRight/></a><span className="cta-star">✳</span></section>
    </main>
    <footer><a className="logo footer-logo" href="#"><span className="logo-icon"><Gift size={19}/></span><span>trusted<span className="logo-light">circle</span><small>GIFTS THAT FEEL RIGHT</small></span></a><span>© {new Date().getFullYear()} Trusted Circle. Made for the moments that matter.</span><div><a href="#shop">Shop</a><a href="#how">How it works</a></div></footer>
    {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    {cartOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setCartOpen(false)}><aside className="drawer"><div className="drawer-head"><div><span className="eyebrow">YOUR SELECTION</span><h2>Your bag <small>({count})</small></h2></div><button className="icon-btn" onClick={()=>setCartOpen(false)}><X/></button></div>{cart.length?<><div className="cart-lines">{cart.map(item=><div className="cart-line" key={item.id}><div className="mini-card" style={{'--brand':item.color}}><Gift/></div><div className="cart-detail"><b>{item.brand} Gift Card</b><span>{money(item.amount)}</span><div className="qty"><button onClick={()=>changeQty(item.id,-1)}><Minus size={13}/></button>{item.qty}<button onClick={()=>changeQty(item.id,1)}><Plus size={13}/></button><button className="remove" onClick={()=>setCart(old=>old.filter(x=>x.id!==item.id))}><Trash2 size={13}/></button></div></div><b>{money(item.price*item.qty)}</b></div>)}</div><div className="cart-summary"><div><span>Subtotal</span><b>{money(total)}</b></div><div><span>Delivery</span><b>Free</b></div><div className="grand-total"><span>Total</span><b>{money(total)}</b></div><button className="primary-btn checkout-btn" onClick={checkout} disabled={loading}>{loading ? "Preparing checkout..." : "Continue to checkout"} <ArrowRight size={17}/></button><p><ShieldCheck size={14}/> Secure payment · Digital delivery</p></div></>:<div className="empty-cart"><ShoppingBag size={38}/><h3>Your bag is waiting</h3><p>Add a gift card to get started.</p><button className="primary-btn" onClick={()=>setCartOpen(false)}>Explore gifts</button></div>}</aside></div>}
    {accountOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setAccountOpen(false)}><aside className="account-modal"><button className="icon-btn modal-close" onClick={()=>setAccountOpen(false)}><X/></button><span className="logo-icon"><UserRound/></span><h2>{session?'Welcome back':'A little account, a lot of convenience.'}</h2><p>{session?'You are signed in to Trusted Circle.':'Sign in to save your bag, view your orders and keep your gifts together.'}</p>{session?<><div className="profile-row">{profile?.avatar&&<img src={profile.avatar} alt=""/>}<div><b>{profile?.name}</b><span>{profile?.email}</span></div></div><button className="primary-btn full-btn" onClick={()=>{setAccountOpen(false);setAdminOpen(true)}}>{isAdmin?'Admin workspace':'My account'} <ArrowRight size={16}/></button><button className="secondary-btn full-btn" onClick={signOut}><LogOut size={16}/> Sign out</button></>:<button className="google-btn" onClick={signIn} disabled={loading}><span>G</span>{loading?'Connecting...':'Continue with Google'}<ArrowRight size={16}/></button>}<small className="modal-note">By continuing, you agree to our Terms and Privacy Policy.</small></aside></div>}
    {adminOpen&&isAdmin?<AdminDashboard session={session} onClose={()=>setAdminOpen(false)}/>:adminOpen&&<div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&setAdminOpen(false)}><aside className="drawer admin-drawer"><div className="drawer-head"><div><span className="eyebrow">ACCOUNT</span><h2>My account</h2></div><button className="icon-btn" onClick={()=>setAdminOpen(false)}><X/></button></div><div className="admin-welcome"><LayoutDashboard/><div><b>{profile?.name}</b><span>{profile?.email}</span></div></div><div className="account-links"><button onClick={()=>setOrdersOpen(true)}><Package/> My orders <ArrowRight/></button><button onClick={()=>setNotice('Your profile is managed securely through your Google account.')}><UserRound/> Profile details <ArrowRight/></button></div><p className="muted">Order history and voucher delivery will appear here after the order service is configured.</p></aside></div>}
    {ordersOpen&&session&&<MyOrders session={session} onClose={()=>setOrdersOpen(false)}/>}
  </div>
}
export default App