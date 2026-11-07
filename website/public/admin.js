(() => {
  const $=id=>document.getElementById(id);
  const escapeHtml=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const digits=n=>new Intl.NumberFormat("fa-IR").format(Number(n||0));
  const money=n=>n===null||n===undefined?"تأیید نشده":digits(n)+" تومان";
  const statusText=s=>({new:"در انتظار بررسی",reviewed:"در حال هماهنگی",confirmed:"تأیید شده",preparing:"در حال آماده‌سازی",shipped:"ارسال شده",completed:"تکمیل شده",cancelled:"لغو شده"})[s]||s;
  const API_ENDPOINT=new URL("./",window.location.href).toString();
  const PUBLIC_API_KEY="sb_publishable_Ttbile4UN76kwsZ0chw3DA_HfaqPUjA";
  const api=async(path,options={})=>{
    let body={};if(options.body){try{body=JSON.parse(options.body);}catch{body={};}}
    const token=sessionStorage.getItem("padna-admin-session")||"";
    const headers={"content-type":"application/json","apikey":PUBLIC_API_KEY};
    if(token)headers["x-admin-session"]=token;
    const response=await fetch(API_ENDPOINT,{method:"POST",headers,body:JSON.stringify({path,method:options.method||"GET",body})});
    let data={};try{data=await response.json();}catch{}
    if(!response.ok)throw new Error(data.error||"درخواست انجام نشد.");
    return data;
  };
  const feedback=(id,message,success=false)=>{const el=$(id);if(!el)return;el.textContent=message;el.classList.toggle("success",success);};
  function showDashboard(){
    $("login-card").hidden=true;$("setup-card").hidden=true;$("admin-dashboard").hidden=false;
    loadOrders();loadProducts();
  }
  function showLogin(){
    $("admin-dashboard").hidden=true;$("setup-card").hidden=true;$("login-card").hidden=false;
  }
  function showSetup(){
    $("admin-dashboard").hidden=true;$("login-card").hidden=true;$("setup-card").hidden=false;
  }
  async function checkSession(){
    try{
      const d=await api("/api/admin/session");
      if(d.authenticated)showDashboard();
      else if(d.setupRequired)showSetup();
      else showLogin();
    }catch(error){
      showLogin();feedback("login-feedback",error.message);
    }
  }
  $("setup-form").addEventListener("submit",async event=>{
    event.preventDefault();
    const form=event.currentTarget,fd=new FormData(form),button=form.querySelector("button");
    const password=String(fd.get("password")||""),confirm=String(fd.get("passwordConfirm")||"");
    if(password!==confirm){feedback("setup-feedback","گذرواژه و تکرار آن یکسان نیستند.");return;}
    button.disabled=true;button.textContent="در حال راه‌اندازی…";feedback("setup-feedback","");
    try{
      const data=await api("/api/admin/setup",{method:"POST",body:JSON.stringify({setupToken:fd.get("setupToken"),password})});
      form.reset();showLogin();feedback("login-feedback",data.message||"گذرواژه تنظیم شد؛ وارد شوید.",true);
    }catch(error){feedback("setup-feedback",error.message);}
    finally{button.disabled=false;button.textContent="راه‌اندازی پنل مدیریت";}
  });
  $("login-form").addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget,button=form.querySelector("button"),password=new FormData(form).get("password");
    button.disabled=true;feedback("login-feedback","در حال بررسی…");
    try{const data=await api("/api/admin/login",{method:"POST",body:JSON.stringify({password})});if(data.token)sessionStorage.setItem("padna-admin-session",data.token);form.reset();showDashboard();}
    catch(error){feedback("login-feedback",error.message);}
    finally{button.disabled=false;}
  });
  $("logout-button").addEventListener("click",async()=>{
    try{await api("/api/admin/logout",{method:"POST",body:"{}"});}catch{}
    sessionStorage.removeItem("padna-admin-session");
    showLogin();
  });
  document.querySelectorAll(".admin-tabs button").forEach(button=>button.addEventListener("click",()=>{
    document.querySelectorAll(".admin-tabs button").forEach(x=>x.classList.toggle("active",x===button));
    $("orders-panel").hidden=button.dataset.tab!=="orders";
    $("products-panel").hidden=button.dataset.tab!=="products";
  }));

  async function loadOrders(){
    $("orders-list").innerHTML='<p class="loading-state">در حال دریافت سفارش‌ها…</p>';
    try{
      const data=await api("/api/admin/orders");
      if(!data.orders.length){$("orders-list").innerHTML='<p class="loading-state">هنوز درخواستی ثبت نشده است.</p>';return;}
      $("orders-list").innerHTML=data.orders.map(o=>{
        const items=(o.items||[]).map(x=>escapeHtml(x.name)+" × "+digits(x.quantity)+" "+escapeHtml(x.unit)).join("، ");
        const delivery=o.delivery_method==="post"?"ارسال به شهرهای دیگر":"تحویل در اصفهان";
        return '<article class="admin-order"><div class="admin-order-head"><h3>'+escapeHtml(o.id)+' · '+escapeHtml(o.customer_name)+'</h3><span class="order-status">'+statusText(o.status)+'</span></div>'+
          '<p>'+escapeHtml(o.phone)+' · '+escapeHtml(o.city)+' · '+delivery+'</p><p>'+escapeHtml(o.address)+'</p><p>کالاها: '+items+'</p>'+
          (o.notes?'<p>توضیحات مشتری: '+escapeHtml(o.notes)+'</p>':'')+
          '<p>جمع کالاها: '+money(o.subtotal_toman)+' · ارسال: '+money(o.shipping_toman)+' · مبلغ نهایی: <b>'+money(o.total_toman)+'</b></p>'+
          '<form class="admin-order-form" data-id="'+escapeHtml(o.id)+'">'+
          '<label>وضعیت<select name="status">'+
          '<option value="reviewed" '+(o.status==="reviewed"?"selected":"")+'>در حال هماهنگی</option>'+
          '<option value="confirmed" '+(o.status==="confirmed"?"selected":"")+'>تأیید سفارش</option>'+
          '<option value="preparing" '+(o.status==="preparing"?"selected":"")+'>در حال آماده‌سازی</option>'+
          '<option value="shipped" '+(o.status==="shipped"?"selected":"")+'>ارسال شده</option>'+
          '<option value="completed" '+(o.status==="completed"?"selected":"")+'>تکمیل شده</option>'+
          '<option value="cancelled" '+(o.status==="cancelled"?"selected":"")+'>لغو سفارش</option></select></label>'+
          '<label>هزینه ارسال (تومان)<input name="shippingToman" type="number" min="0" step="1" value="'+(o.shipping_toman===null?"":escapeHtml(o.shipping_toman))+'" placeholder="برای تأیید سفارش"></label>'+
          '<label class="wide">یادداشت مدیر<textarea name="adminNote" rows="2" maxlength="500">'+escapeHtml(o.admin_note||"")+'</textarea></label>'+
          '<button class="button button-dark" type="submit">ذخیره تغییرات</button></form></article>';
      }).join("");
      $("orders-list").querySelectorAll(".admin-order-form").forEach(form=>form.addEventListener("submit",saveOrder));
    }catch(error){$("orders-list").innerHTML='<p class="form-feedback">'+escapeHtml(error.message)+'</p>';}
  }
  async function saveOrder(event){
    event.preventDefault();const form=event.currentTarget,fd=new FormData(form),button=form.querySelector("button");
    const shippingRaw=String(fd.get("shippingToman")||"").trim();
    const payload={status:fd.get("status"),shippingToman:shippingRaw===""?null:Number(shippingRaw),adminNote:fd.get("adminNote")};
    button.disabled=true;button.textContent="در حال ذخیره…";
    try{await api("/api/admin/orders/"+encodeURIComponent(form.dataset.id),{method:"PATCH",body:JSON.stringify(payload)});await loadOrders();}
    catch(error){alert(error.message);}
    finally{button.disabled=false;button.textContent="ذخیره تغییرات";}
  }
  async function loadProducts(){
    $("products-list").innerHTML='<p class="loading-state">در حال دریافت محصولات…</p>';
    try{
      const data=await api("/api/admin/products");
      $("products-list").innerHTML=(data.products||[]).map(p=>
        '<div class="product-admin-row"><img src="'+escapeHtml(p.image)+'" alt=""><div><strong>'+escapeHtml(p.name)+'</strong><small>قیمت: '+money(p.price_toman)+' · موجودی: '+(p.stock===null?"نامشخص":digits(p.stock))+' '+escapeHtml(p.unit)+'</small></div><button class="product-edit" type="button" data-edit="'+escapeHtml(p.id)+'">ویرایش</button></div>'+
        '<div class="product-editor" id="editor-'+escapeHtml(p.id)+'" hidden><h3>ویرایش '+escapeHtml(p.name)+'</h3>'+
        '<form class="admin-form" data-id="'+escapeHtml(p.id)+'">'+
        '<label>نام محصول<input name="name" value="'+escapeHtml(p.name)+'" required maxlength="100"></label>'+
        '<label>دسته‌بندی<input name="category" value="'+escapeHtml(p.category)+'" maxlength="60"></label>'+
        '<label>قیمت روز (تومان)<input name="priceToman" type="number" min="1" step="1" value="'+(p.price_toman===null?"":escapeHtml(p.price_toman))+'" placeholder="خالی = قیمت تأیید نشده"></label>'+
        '<label>موجودی<input name="stock" type="number" min="0" step="0.01" value="'+(p.stock===null?"":escapeHtml(p.stock))+'" placeholder="خالی = موجودی نامشخص"></label>'+
        '<label>واحد فروش<input name="unit" value="'+escapeHtml(p.unit)+'" maxlength="30" required></label>'+
        '<label>مسیر تصویر<input name="image" value="'+escapeHtml(p.image)+'" placeholder="/images/name.jpg"></label>'+
        '<label class="wide">توضیحات<textarea name="description" rows="2" maxlength="500">'+escapeHtml(p.description)+'</textarea></label>'+
        '<label><span><input name="active" type="checkbox" '+(p.active?"checked":"")+'> نمایش در فروشگاه</span></label>'+
        '<button class="button button-dark" type="submit">ذخیره محصول</button></form></div>'
      ).join("");
      $("products-list").querySelectorAll("[data-edit]").forEach(button=>button.addEventListener("click",()=>{
        const editor=$("editor-"+button.dataset.edit);editor.hidden=!editor.hidden;
      }));
      $("products-list").querySelectorAll(".admin-form").forEach(form=>form.addEventListener("submit",saveProduct));
    }catch(error){$("products-list").innerHTML='<p class="form-feedback">'+escapeHtml(error.message)+'</p>';}
  }
  async function saveProduct(event){
    event.preventDefault();const form=event.currentTarget,fd=new FormData(form),button=form.querySelector("button");
    const price=String(fd.get("priceToman")||"").trim(),stock=String(fd.get("stock")||"").trim();
    const payload={
      name:fd.get("name"),category:fd.get("category"),unit:fd.get("unit"),
      description:fd.get("description"),image:fd.get("image"),
      priceToman:price===""?null:Number(price),stock:stock===""?null:Number(stock),
      active:form.elements.active.checked
    };
    button.disabled=true;button.textContent="در حال ذخیره…";
    try{await api("/api/admin/products/"+encodeURIComponent(form.dataset.id),{method:"PUT",body:JSON.stringify(payload)});await loadProducts();}
    catch(error){alert(error.message);}
    finally{button.disabled=false;button.textContent="ذخیره محصول";}
  }
  $("orders-refresh").addEventListener("click",loadOrders);
  $("products-refresh").addEventListener("click",loadProducts);
  checkSession();
})();