(() => {
  const $ = id => document.getElementById(id);
  const state = { products:[], cart:new Map(), category:"all" };
  const digits = n => new Intl.NumberFormat("fa-IR").format(Number(n||0));
  const money = n => digits(n) + " تومان";
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const readCart = () => {
    try {
      const raw = JSON.parse(localStorage.getItem("padnakasht-cart") || "[]");
      state.cart = new Map(raw.filter(x => x && typeof x.id==="string" && Number(x.qty)>0).map(x => [x.id,Number(x.qty)]));
    } catch { state.cart = new Map(); }
  };
  const saveCart = () => localStorage.setItem("padnakasht-cart",JSON.stringify([...state.cart].map(([id,qty])=>({id,qty}))));
  const quantityStep = p => String(p.unit||"").includes("کیلوگرم") ? 0.5 : 1;
  const quantityLabel = n => digits(n);
  const statusText = status => ({
    new:"در انتظار بررسی",reviewed:"در حال هماهنگی",confirmed:"سفارش تأیید شد",
    preparing:"در حال آماده‌سازی",shipped:"ارسال شده",completed:"تکمیل شده",cancelled:"لغو شده"
  })[status] || "در حال بررسی";

  async function api(path,options={}) {
    const response = await fetch(path,{...options,credentials:"same-origin",headers:{"content-type":"application/json",...(options.headers||{})}});
    let data={}; try { data=await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || "درخواست انجام نشد.");
    return data;
  }
  function feedback(id,message,success=false) {
    const el=$(id); if(!el)return;
    el.textContent=message; el.classList.toggle("success",success);
  }
  function imageFallbacks(root) {
    root.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.parentElement.classList.add("image-missing");},{once:true}));
  }
  function renderFilters() {
    const categories=["all",...new Set(state.products.map(p=>p.category).filter(Boolean))];
    $("category-filters").innerHTML=categories.map(c=>'<button class="filter-chip '+(state.category===c?"active":"")+'" data-category="'+escapeHtml(c)+'" type="button">'+(c==="all"?"همه محصولات":escapeHtml(c))+"</button>").join("");
    $("category-filters").querySelectorAll("button").forEach(button=>button.addEventListener("click",()=>{
      state.category=button.dataset.category;renderFilters();renderProducts();
    }));
  }
  function renderProducts() {
    const list=state.products.filter(p=>state.category==="all"||p.category===state.category);
    $("catalog-count").textContent=digits(list.length)+" محصول";
    if(!list.length){$("product-grid").innerHTML='<div class="loading-state">در این گروه هنوز محصولی ثبت نشده است.</div>';return;}
    $("product-grid").innerHTML=list.map(p=>{
      const unavailable=p.stock!==null && Number(p.stock)<=0;
      const stockText=p.stock===null?"موجودی پس از ثبت درخواست بررسی می‌شود":(unavailable?"فعلاً ناموجود":"موجودی: "+digits(p.stock)+" "+escapeHtml(p.unit));
      const price=p.price_toman===null?"قیمت پس از هماهنگی":money(p.price_toman);
      return '<article class="product-card"><div class="product-photo"><img loading="lazy" src="'+escapeHtml(p.image||"")+'" alt="'+escapeHtml(p.name)+'"><span class="image-note">تصویر نمایشی</span></div>'+
        '<div class="product-category">'+escapeHtml(p.category||"محصول محلی")+'</div><h3>'+escapeHtml(p.name)+'</h3>'+
        '<p class="product-description">'+escapeHtml(p.description||"محصولی از تولیدکنندگان پادنا.")+'</p>'+
        '<div class="product-meta"><div class="product-price">'+price+'<small>به‌ازای هر '+escapeHtml(p.unit)+'</small></div><span class="stock-label">'+stockText+'</span></div>'+
        '<button class="add-button" data-add="'+escapeHtml(p.id)+'" type="button" '+(unavailable?"disabled":"")+'>افزودن به سبد</button></article>';
    }).join("");
    imageFallbacks($("product-grid"));
    $("product-grid").querySelectorAll("[data-add]").forEach(button=>button.addEventListener("click",()=>addToCart(button.dataset.add)));
  }
  function addToCart(id) {
    const product=state.products.find(p=>p.id===id); if(!product)return;
    const step=quantityStep(product), next=Number(((state.cart.get(id)||0)+step).toFixed(2));
    if(product.stock!==null && next>Number(product.stock)){toast("موجودی این محصول برای این مقدار کافی نیست.");return;}
    state.cart.set(id,next);saveCart();renderCart();toast("به سبد خرید اضافه شد.");
  }
  function toast(message) {
    let el=$("toast");
    if(!el){el=document.createElement("div");el.id="toast";el.className="toast";document.body.appendChild(el);}
    el.textContent=message;el.classList.add("visible");
    window.clearTimeout(toast.timer);toast.timer=window.setTimeout(()=>el.classList.remove("visible"),2600);
  }
  function cartItems() {
    return [...state.cart.entries()].map(([id,qty])=>({product:state.products.find(p=>p.id===id),qty})).filter(x=>x.product);
  }
  function renderCart() {
    const items=cartItems();
    const count=items.reduce((sum,x)=>sum+x.qty,0);
    $("cart-count").textContent=digits(count);
    $("cart-lines").innerHTML=items.length?items.map(({product:p,qty})=>{
      return '<div class="cart-line"><div><strong>'+escapeHtml(p.name)+'</strong><small>'+quantityLabel(qty)+' '+escapeHtml(p.unit)+'</small></div>'+
        '<div class="qty-control"><button type="button" data-dec="'+escapeHtml(p.id)+'" aria-label="کم کردن">−</button><b>'+quantityLabel(qty)+'</b><button type="button" data-inc="'+escapeHtml(p.id)+'" aria-label="زیاد کردن">+</button></div></div>';
    }).join(""):'<div class="empty-cart">هنوز محصولی انتخاب نکرده‌اید.</div>';
    const allPriced=items.length && items.every(x=>x.product.price_toman!==null);
    const subtotal=items.reduce((sum,x)=>sum+Math.round(Number(x.product.price_toman||0)*x.qty),0);
    $("cart-subtotal").textContent=allPriced?money(subtotal):"پس از تأیید قیمت";
    $("checkout-open").disabled=!items.length;
    $("cart-lines").querySelectorAll("[data-dec]").forEach(button=>button.addEventListener("click",()=>{
      const p=state.products.find(x=>x.id===button.dataset.dec),step=quantityStep(p),next=Number(((state.cart.get(p.id)||0)-step).toFixed(2));
      if(next<=0)state.cart.delete(p.id);else state.cart.set(p.id,next);
      saveCart();renderCart();
    }));
    $("cart-lines").querySelectorAll("[data-inc]").forEach(button=>button.addEventListener("click",()=>addToCart(button.dataset.inc)));
  }
  function openDrawer() {
    $("drawer-backdrop").hidden=false;$("cart-drawer").classList.add("open");$("cart-drawer").setAttribute("aria-hidden","false");document.body.classList.add("no-scroll");
  }
  function closeDrawer() {
    $("cart-drawer").classList.remove("open");$("cart-drawer").setAttribute("aria-hidden","true");$("drawer-backdrop").hidden=true;document.body.classList.remove("no-scroll");
  }
  function openModal(id) { $(id).hidden=false;document.body.classList.add("no-scroll"); }
  function closeModal(id) { $(id).hidden=true;document.body.classList.remove("no-scroll"); }
  function showSuccess(data) {
    $("success-code").textContent=data.order.id;
    $("success-message").textContent=data.message;
    closeModal("checkout-modal");closeDrawer();openModal("success-modal");
  }
  async function loadProducts() {
    try {
      const data=await api("/api/products");
      state.products=data.products||[];
      state.cart=new Map([...state.cart].filter(([id])=>state.products.some(p=>p.id===id)));
      saveCart();renderFilters();renderProducts();renderCart();
    } catch(error) {
      $("product-grid").innerHTML='<div class="loading-state">دریافت فهرست محصولات انجام نشد. کمی بعد صفحه را تازه کنید.</div>';
      $("catalog-count").textContent="اتصال برقرار نشد";
    }
  }

  $("cart-open").addEventListener("click",openDrawer);
  $("cart-close").addEventListener("click",closeDrawer);
  $("drawer-backdrop").addEventListener("click",closeDrawer);
  $("checkout-open").addEventListener("click",()=>{
    if(!state.cart.size)return;
    openModal("checkout-modal");
  });
  $("checkout-close").addEventListener("click",()=>closeModal("checkout-modal"));
  $("checkout-modal").addEventListener("click",event=>{if(event.target===$("checkout-modal"))closeModal("checkout-modal");});
  $("success-close").addEventListener("click",()=>{closeModal("success-modal");window.scrollTo({top:0,behavior:"smooth"});});
  $("success-modal").addEventListener("click",event=>{if(event.target===$("success-modal"))closeModal("success-modal");});
  $("copy-order-code").addEventListener("click",async()=>{
    try{await navigator.clipboard.writeText($("success-code").textContent);toast("کد سفارش کپی شد.");}
    catch{toast("کد سفارش را به‌صورت دستی کپی کنید.");}
  });

  $("checkout-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,button=form.querySelector('button[type="submit"]');
    const fd=new FormData(form);
    const payload={
      customerName:fd.get("customerName"),phone:fd.get("phone"),city:fd.get("city"),
      address:fd.get("address"),deliveryMethod:fd.get("deliveryMethod"),notes:fd.get("notes"),
      items:cartItems().map(x=>({productId:x.product.id,quantity:x.qty}))
    };
    button.disabled=true;button.textContent="در حال ثبت درخواست…";feedback("checkout-feedback","");
    try{
      const data=await api("/api/orders",{method:"POST",body:JSON.stringify(payload)});
      state.cart.clear();saveCart();renderCart();form.reset();showSuccess(data);
    }catch(error){feedback("checkout-feedback",error.message);}
    finally{button.disabled=false;button.textContent="ثبت درخواست خرید";}
  });

  $("track-form").addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget,fd=new FormData(form),button=form.querySelector("button");
    button.disabled=true;feedback("track-feedback","در حال بررسی…");
    try{
      const data=await api("/api/order-lookup",{method:"POST",body:JSON.stringify({code:fd.get("code"),phone:fd.get("phone")})});
      const o=data.order;
      let amount=o.totalToman===null?"مبلغ نهایی هنوز تأیید نشده":money(o.totalToman);
      feedback("track-feedback","وضعیت: "+statusText(o.status)+" · "+amount,true);
    }catch(error){feedback("track-feedback",error.message);}
    finally{button.disabled=false;}
  });

  readCart();renderCart();loadProducts();
})();