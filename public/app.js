const tg = window.Telegram?.WebApp;
tg?.ready(); tg?.expand();
const $ = id => document.getElementById(id);
const state = { products: [], cart: new Map(), orderId: null, currentOrder: null };
const money = n => new Intl.NumberFormat('fa-IR').format(Number(n || 0)) + ' تومان';
const symbols = ['🌿','🍯','🍇','🌰','🫙','🌾','🍎'];
function initData() { return tg?.initData || ''; }
function headers(json=false) { const h = {}; if (initData()) h.Authorization = 'tma ' + initData(); if (json) h['Content-Type'] = 'application/json'; return h; }
async function api(url, options={}) {
 const r = await fetch(url, {...options, headers:{...headers(Boolean(options.body)),...(options.headers||{})}});
 let data={}; try { data=await r.json(); } catch {}
 if (!r.ok) throw new Error(data.error || 'درخواست انجام نشد.');
 return data;
}
function note(text,error=false){$('notice').textContent=text;$('notice').classList.toggle('error',error);$('notice').hidden=false;$('notice').scrollIntoView({behavior:'smooth',block:'nearest'});}
function hidePanels(){['cartSection','checkoutSection','paymentSection','myOrdersSection','adminSection'].forEach(id=>$(id).hidden=true);}
function openPanel(id){hidePanels();$(id).hidden=false;$(id).scrollIntoView({behavior:'smooth',block:'start'});}
async function loadProducts(){
 try{const d=await api('/api/products');state.products=d.products||[];renderProducts();}
 catch(e){$('products').innerHTML='<div class="empty">بارگذاری محصولات انجام نشد. '+escapeHtml(e.message)+'</div>';}
}
function renderProducts(){
 const root=$('products');
 if(!state.products.length){root.innerHTML='<div class="empty">هنوز کالایی در فروشگاه ثبت نشده است. مدیر باید کالا و قیمت را از پنل مدیریت اضافه کند.</div>';return;}
 root.innerHTML=state.products.map((p,i)=>'<article class="product"><div class="product-symbol">'+symbols[i%symbols.length]+'</div><h3>'+escapeHtml(p.name)+'</h3><p>'+escapeHtml(p.description||'محصولی از پادنا')+'<br>موجودی: '+money(p.stock)+' '+escapeHtml(p.unit)+'</p><div class="product-bottom"><div class="price">'+money(p.price_toman)+'<small>به‌ازای هر '+escapeHtml(p.unit)+'</small></div><button class="primary" data-add="'+escapeHtml(p.id)+'" type="button" '+(Number(p.stock)<=0?'disabled':'')+'>افزودن به سبد</button></div></article>').join('');
 root.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{const p=state.products.find(x=>x.id===b.dataset.add);if(!p)return;const q=state.cart.get(p.id)||0;if(q+1>Number(p.stock)){note('تعداد انتخابی از موجودی بیشتر است.',true);return;}state.cart.set(p.id,q+1);renderCart();note('به سبد خرید اضافه شد.');}));
}
function renderCart(){
 const items=[...state.cart.entries()].map(([id,q])=>({p:state.products.find(p=>p.id===id),q})).filter(x=>x.p);
 $('cartCount').textContent=money(items.reduce((a,x)=>a+x.q,0)).replace(' تومان','');
 $('cartItems').innerHTML=items.length?items.map(({p,q})=>'<div class="cart-row"><div><b>'+escapeHtml(p.name)+'</b><small>'+money(p.price_toman)+' / '+escapeHtml(p.unit)+'</small></div><div class="qty"><button type="button" data-dec="'+escapeHtml(p.id)+'" aria-label="کم کردن">−</button><b>'+money(q).replace(' تومان','')+'</b><button type="button" data-inc="'+escapeHtml(p.id)+'" aria-label="زیاد کردن">+</button></div></div>').join(''):'<div class="empty">سبد خرید خالی است.</div>';
 const subtotal=items.reduce((a,x)=>a+Math.round(Number(x.p.price_toman)*x.q),0);$('subtotal').textContent=money(subtotal);
 $('cartItems').querySelectorAll('[data-dec]').forEach(b=>b.onclick=()=>{const id=b.dataset.dec,q=(state.cart.get(id)||0)-1;if(q<=0)state.cart.delete(id);else state.cart.set(id,q);renderCart();});
 $('cartItems').querySelectorAll('[data-inc]').forEach(b=>b.onclick=()=>{const id=b.dataset.inc,p=state.products.find(x=>x.id===id),q=(state.cart.get(id)||0)+1;if(q>Number(p.stock)){note('موجودی کافی نیست.',true);return;}state.cart.set(id,q);renderCart();});
}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
$('cartOpen').onclick=()=>{openPanel('cartSection');renderCart();};
$('cartClose').onclick=hidePanels;$('checkoutClose').onclick=hidePanels;
$('checkoutOpen').onclick=()=>{if(!state.cart.size){note('ابتدا کالا به سبد اضافه کنید.',true);return;}if(!initData()){note('برای ثبت سفارش، فروشگاه را از داخل ربات تلگرام باز کنید.',true);return;}openPanel('checkoutSection');};
$('refresh').onclick=loadProducts;
$('checkoutForm').addEventListener('submit',async e=>{
 e.preventDefault();const f=new FormData(e.currentTarget);const payload={phone:f.get('phone'),city:f.get('city'),address:f.get('address'),deliveryMethod:f.get('deliveryMethod'),items:[...state.cart.entries()].map(([productId,quantity])=>({productId,quantity}))};
 const btn=e.submitter;btn.disabled=true;btn.textContent='در حال ثبت سفارش…';
 try{const d=await api('/api/orders',{method:'POST',body:JSON.stringify(payload)});state.orderId=d.order.id;state.currentOrder=d.order;state.cart.clear();renderCart();renderPayment(d);openPanel('paymentSection');}
 catch(err){note(err.message,true);}
 finally{btn.disabled=false;btn.textContent='ثبت سفارش و رفتن به مرحله پرداخت';}
});
function renderPayment(d){
 const p=d.payment;const card=p.configured?'<div class="payment-card"><div class="muted small">مبلغ قابل پرداخت</div><div class="payment-number">'+money(d.order.totalToman)+'</div><div class="muted small">به نام صاحب کارت</div><b>'+escapeHtml(p.cardHolderName)+'</b><div class="payment-number">'+escapeHtml(p.cardNumber)+'</div><button class="copy-button" type="button" id="copyCard">کپی شماره کارت</button><button class="copy-button" type="button" id="copyTotal">کپی مبلغ</button></div>':'<div class="payment-card error-text">اطلاعات کارت هنوز توسط مدیر در تنظیمات امن سرور وارد نشده است. برای جلوگیری از واریز اشتباه، فعلاً مبلغی واریز نکنید.</div>';
 $('paymentDetails').innerHTML='<div class="status">سفارش '+escapeHtml(d.order.id)+' · در انتظار تأیید پرداخت</div><p>مبلغ کالاها: <b>'+money(d.order.subtotalToman)+'</b></p><p>هزینه ارسال: <b>'+money(d.order.shippingToman)+'</b></p><p>مبلغ نهایی: <b>'+money(d.order.totalToman)+'</b></p>'+card+'<p class="muted small">'+escapeHtml(d.message)+'</p>';
 $('copyCard')?.addEventListener('click',()=>copyText(p.cardNumber));$('copyTotal')?.addEventListener('click',()=>copyText(String(d.order.totalToman)));
}
async function copyText(t){try{await navigator.clipboard.writeText(t);note('کپی شد.');}catch{note('کپی خودکار ممکن نیست؛ متن را دستی انتخاب کنید.',true);}}
$('trackingForm').addEventListener('submit',async e=>{e.preventDefault();if(!state.orderId)return;const btn=e.submitter;btn.disabled=true;try{const f=new FormData(e.currentTarget);const d=await api('/api/orders/'+encodeURIComponent(state.orderId)+'/payment-reference',{method:'POST',body:JSON.stringify({trackingCode:f.get('trackingCode')})});note(d.message);e.currentTarget.reset();loadMyOrders();}catch(err){note(err.message,true);}finally{btn.disabled=false;}});
async function loadMyOrders(){if(!initData()){note('برای مشاهده سفارش‌ها فروشگاه را از تلگرام باز کنید.',true);return;}try{const d=await api('/api/my-orders');$('myOrders').innerHTML=d.orders.length?d.orders.map(o=>'<div class="order-card"><h3>'+escapeHtml(o.id)+'</h3><span class="status">'+escapeHtml(statusText(o.status))+'</span><p>مبلغ: '+money(o.totalToman)+'</p><p>ثبت: '+new Date(o.createdAt).toLocaleString('fa-IR')+'</p>'+(o.shippingTracking?'<p>کد رهگیری ارسال: '+escapeHtml(o.shippingTracking)+'</p>':'')+'</div>').join(''):'<div class="empty">سفارشی ثبت نشده است.</div>';openPanel('myOrdersSection');}catch(e){note(e.message,true);}}
function statusText(s){return ({awaiting_payment:'در انتظار پرداخت',payment_submitted:'کد پرداخت ثبت شده؛ منتظر بررسی',payment_confirmed:'پرداخت تأیید شد',preparing:'در حال آماده‌سازی',shipped:'ارسال شده',completed:'تکمیل شده',cancelled:'لغو شده'})[s]||s;}
async function loadAdmin(){if(!initData()){note('پنل مدیریت فقط از داخل تلگرام و برای مدیر مجاز قابل استفاده است.',true);return;}try{const d=await api('/api/admin/orders');$('adminOrders').innerHTML=d.orders.length?d.orders.map(o=>'<div class="order-card"><h3>'+escapeHtml(o.id)+' — '+escapeHtml(o.customerName)+'</h3><span class="status">'+escapeHtml(statusText(o.status))+'</span><p>'+escapeHtml(o.phone)+' · '+escapeHtml(o.city)+' · '+(o.deliveryMethod==='post'?'پست پیشتاز':'تحویل اصفهان')+'</p><p>'+escapeHtml(o.address)+'</p><p>کالاها: '+o.items.map(x=>escapeHtml(x.name)+' × '+money(x.quantity).replace(' تومان','')).join('، ')+'</p><p>مبلغ کل: <b>'+money(o.totalToman)+'</b> · کد پرداخت: '+escapeHtml(o.paymentTracking||'ثبت نشده')+'</p><form class="form admin-order-form" data-id="'+escapeHtml(o.id)+'"><label>تغییر وضعیت<select name="status">'+['awaiting_payment','payment_submitted','payment_confirmed','preparing','shipped','completed','cancelled'].map(s=>'<option value="'+s+'" '+(o.status===s?'selected':'')+'>'+statusText(s)+'</option>').join('')+'</select></label><label>کد رهگیری ارسال<input name="shippingTracking" value="'+escapeHtml(o.shippingTracking||'')+'" maxlength="120"></label><label>یادداشت مدیر<input name="adminNote" value="'+escapeHtml(o.adminNote||'')+'" maxlength="500"></label><button class="primary" type="submit">ذخیره وضعیت</button></form></div>').join(''):'<div class="empty">هنوز سفارشی ثبت نشده است.</div>';
 $('adminOrders').querySelectorAll('.admin-order-form').forEach(form=>form.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(form);try{await api('/api/admin/orders/'+encodeURIComponent(form.dataset.id),{method:'PATCH',body:JSON.stringify({status:f.get('status'),shippingTracking:f.get('shippingTracking'),adminNote:f.get('adminNote')})});note('وضعیت سفارش ذخیره شد.');loadAdmin();}catch(err){note(err.message,true);}}));openPanel('adminSection');
 }catch(e){note(e.message,true);}}
$('adminRefresh').onclick=loadAdmin;$('ordersRefresh').onclick=loadMyOrders;
$('productForm').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.currentTarget);const payload={id:f.get('id'),name:f.get('name'),description:f.get('description'),priceToman:Number(f.get('priceToman')),stock:Number(f.get('stock')),unit:f.get('unit'),active:true};try{await api('/api/admin/products',{method:'POST',body:JSON.stringify(payload)});note('کالا ذخیره شد.');e.currentTarget.reset();await loadProducts();}catch(err){note(err.message,true);}});
const adminButton=document.createElement('button');adminButton.className='text-button';adminButton.type='button';adminButton.textContent='پنل مدیر';adminButton.onclick=loadAdmin;$('catalogSection').querySelector('.section-head').append(adminButton);
const ordersButton=document.createElement('button');ordersButton.className='text-button';ordersButton.type='button';ordersButton.textContent='سفارش‌های من';ordersButton.onclick=loadMyOrders;$('catalogSection').querySelector('.section-head').append(ordersButton);
loadProducts();renderCart();
