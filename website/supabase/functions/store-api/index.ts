import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const clean = (v: unknown, max = 500) => String(v ?? "").trim().slice(0, max);
const normalizeDigits = (v: unknown) => String(v ?? "")
  .replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const safeEqual = (a: string, b: string) => {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("");
const fromHex = (hex: string) => new Uint8Array((hex.match(/.{1,2}/g) || []).map(x => parseInt(x,16)));
const b64url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
};
const fromB64url = (value: string) => {
  const s = value.replace(/-/g,"+").replace(/_/g,"/");
  const padded = s + "=".repeat((4 - s.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
async function sha256(value: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));
}
async function derivePassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name:"PBKDF2",salt:fromHex(saltHex),iterations:310000,hash:"SHA-256"
  },key,256);
  return toHex(new Uint8Array(bits));
}
async function signSession(secretHex: string, payload: string) {
  const key = await crypto.subtle.importKey("raw",fromHex(secretHex),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload))));
}
async function credentials() {
  const {data,error} = await db.from("store_admin_credentials")
    .select("id,password_hash,password_salt,setup_token_hash,session_secret,proxy_secret_hash")
    .eq("id",1).single();
  if (error || !data) throw new Error("ADMIN_CREDENTIALS_UNAVAILABLE");
  return data;
}
async function isAdmin(token: string) {
  if (!token) return false;
  const c = await credentials();
  if (!c.password_hash || !c.password_salt) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = await signSession(c.session_secret,parts[0]);
  if (!safeEqual(parts[1],expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(parts[0])));
    return Number.isSafeInteger(data.exp) && data.exp > Date.now();
  } catch { return false; }
}
async function rateLimit(key: string, limit: number, seconds: number) {
  const {data,error} = await db.rpc("consume_store_rate_limit",{
    p_key:key,p_limit:limit,p_window_seconds:seconds
  });
  if (error) throw error;
  return data === true;
}
async function requestIp(req: Request) {
  const forwarded=req.headers.get("cf-connecting-ip")||req.headers.get("x-forwarded-for")||req.headers.get("x-real-ip")||"unknown";
  return await sha256(clean(forwarded.split(",")[0],100));
}
function errorMessage(error: unknown) {
  const m = String((error as Error)?.message || error || "");
  if (m.includes("ORDER_NOT_FOUND")) return "سفارش پیدا نشد.";
  if (m.includes("ORDER_STATUS_INVALID")) return "تغییر وضعیت سفارش مجاز نیست.";
  if (m.includes("PRODUCT_UNAVAILABLE")) return "قیمت یا موجودی یکی از کالاها تأیید نشده یا موجودی کافی نیست.";
  if (m.includes("MINIMUM_LOAR_CHEESE")) return "حداقل سفارش پنیر لوار نیم‌کیلوگرم است.";
  if (m.includes("INVALID_SHIPPING")) return "هزینه ارسال معتبر نیست.";
  return "درخواست انجام نشد؛ اطلاعات را بررسی کنید و دوباره تلاش کنید.";
}

async function handle(payload: any, req: Request) {
  const path = clean(payload?.path,160);
  const method = clean(payload?.method,12).toUpperCase();
  const body = payload?.body || {};
  const session = clean(req.headers.get("x-admin-session"),2000);
  const ipHash = await requestIp(req);
  const credential = await credentials();
  if (path === "/api/health" && method === "GET") {
    const {count,error} = await db.from("products").select("id",{count:"exact",head:true});
    if (error) throw error;
    return json({ok:true,service:"padnakasht-store-api",database:"connected",products:count||0});
  }

  if (path === "/api/products" && method === "GET") {
    const {data,error} = await db.from("products")
      .select("id,name,description,category,unit,price_toman,price_confirmed,stock,stock_confirmed,image_url,sort_order")
      .eq("active",true).order("sort_order",{ascending:true});
    if (error) throw error;
    return json({products:(data||[]).map((p:any)=>({
      id:p.id,name:p.name,description:p.description,category:p.category,unit:p.unit,
      price_toman:p.price_confirmed?Number(p.price_toman):null,
      stock:p.stock_confirmed?Number(p.stock):null,
      image:p.image_url||""
    }))});
  }

  if (path === "/api/orders" && method === "POST") {
    if (!await rateLimit("order:"+ipHash,8,3600)) return json({error:"تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید."},429);
    const customerName=clean(body.customerName,100);
    const phone=normalizeDigits(clean(body.phone,24));
    const city=clean(body.city,80), address=clean(body.address,500), notes=clean(body.notes,500);
    const deliveryMethod=body.deliveryMethod==="isfahan"?"isfahan":body.deliveryMethod==="post"?"post":"";
    if (customerName.length<2) return json({error:"نام و نام خانوادگی را وارد کنید."},400);
    if (!/^[+0-9\s()\-]{8,24}$/.test(phone)) return json({error:"شماره تماس معتبر وارد کنید."},400);
    if (city.length<2 || address.length<5 || !deliveryMethod) return json({error:"شهر، نشانی کامل و روش تحویل را بررسی کنید."},400);
    if (!Array.isArray(body.items) || body.items.length<1 || body.items.length>20) return json({error:"سبد خرید معتبر نیست."},400);

    const quantities=new Map<string,number>();
    for (const item of body.items) {
      const id=clean(item?.productId,60),qty=Number(item?.quantity);
      if (!id || !Number.isFinite(qty) || qty<=0 || qty>100 || Math.round(qty*100)!==qty*100) return json({error:"تعداد یکی از کالاها معتبر نیست."},400);
      if (id==="loar-cheese" && qty<0.5) return json({error:"حداقل سفارش پنیر لوار نیم‌کیلوگرم است."},400);
      quantities.set(id,(quantities.get(id)||0)+qty);
    }
    const ids=[...quantities.keys()];
    const {data:products,error}=await db.from("products")
      .select("id,name,unit,price_toman,price_confirmed,stock,stock_confirmed")
      .eq("active",true).in("id",ids);
    if (error) throw error;
    const byId=new Map((products||[]).map((p:any)=>[p.id,p]));
    if (byId.size!==ids.length) return json({error:"یکی از کالاها دیگر در فهرست فروش نیست؛ صفحه را تازه کنید."},409);
    const lines:any[]=[];let subtotal=0;let pricesKnown=true;
    for (const [id,quantity] of quantities) {
      const p:any=byId.get(id);
      if (p.stock_confirmed && Number(p.stock)<quantity) return json({error:"موجودی «"+p.name+"» برای این مقدار کافی نیست."},409);
      if (!p.price_confirmed) pricesKnown=false;
      else subtotal+=Math.round(Number(p.price_toman)*quantity);
      lines.push({productId:id,name:p.name,unit:p.unit,quantity,unitPriceToman:p.price_confirmed?Number(p.price_toman):null});
    }
    if (!pricesKnown || !Number.isSafeInteger(subtotal)) subtotal=0;
    const orderId="PK-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase();
    const {error:insertError}=await db.from("orders").insert({
      id:orderId,customer_name:customerName,phone,city,address,delivery_method:deliveryMethod,
      items:lines,items_json:lines,customer_note:notes,subtotal_toman:subtotal,
      shipping_toman:0,delivery_fee_toman:0,total_toman:0,amount_confirmed:false,status:"new"
    });
    if (insertError) throw insertError;
    return json({
      ok:true,
      order:{id:orderId,status:"new",subtotalToman:pricesKnown?subtotal:null,shippingToman:null,totalToman:null},
      message:"درخواست خرید ثبت شد. موجودی، قیمت نهایی و هزینه ارسال پیش از تأیید سفارش با شما هماهنگ می‌شود."
    },201);
  }

  if (path === "/api/order-lookup" && method === "POST") {
    const code=clean(body.code,30).toUpperCase(),phone=normalizeDigits(clean(body.phone,24));
    if (!code || !phone) return json({error:"کد سفارش و شماره تماس را وارد کنید."},400);
    const {data,error}=await db.from("orders")
      .select("id,phone,status,subtotal_toman,shipping_toman,total_toman,amount_confirmed,created_at,updated_at")
      .eq("id",code).eq("phone",phone).maybeSingle();
    if (error) throw error;
    if (!data) return json({error:"سفارشی با این کد و شماره تماس پیدا نشد."},404);
    return json({order:{
      id:data.id,status:data.status,
      subtotalToman:data.amount_confirmed?Number(data.subtotal_toman):null,
      shippingToman:data.amount_confirmed?Number(data.shipping_toman):null,
      totalToman:data.amount_confirmed?Number(data.total_toman):null,
      createdAt:data.created_at,updatedAt:data.updated_at
    }});
  }

  if (path === "/api/admin/session" && method === "GET") {
    const c=await credentials();
    if (!c.password_hash) return json({authenticated:false,setupRequired:true});
    return json({authenticated:await isAdmin(session),setupRequired:false});
  }

  if (path === "/api/admin/setup" && method === "POST") {
    if (!await rateLimit("setup:"+ipHash,5,3600)) return json({error:"تلاش‌های راه‌اندازی بیش از حد مجاز است."},429);
    const c=await credentials();
    if (c.password_hash) return json({error:"راه‌اندازی مدیر قبلاً انجام شده است."},409);
    const setupToken=clean(body.setupToken,200),password=String(body.password||"");
    if (password.length<12 || password.length>128) return json({error:"گذرواژه باید دست‌کم ۱۲ نویسه داشته باشد."},400);
    if (!c.setup_token_hash || !safeEqual(await sha256(setupToken),c.setup_token_hash)) return json({error:"کد راه‌اندازی معتبر نیست."},401);
    const salt=toHex(crypto.getRandomValues(new Uint8Array(16)));
    const passwordHash=await derivePassword(password,salt);
    const {error}=await db.from("store_admin_credentials").update({
      password_hash:passwordHash,password_salt:salt,setup_token_hash:null,updated_at:new Date().toISOString()
    }).eq("id",1);
    if (error) throw error;
    return json({ok:true,message:"گذرواژه مدیر با موفقیت تنظیم شد. اکنون وارد پنل شوید."});
  }

  if (path === "/api/admin/login" && method === "POST") {
    if (!await rateLimit("login:"+ipHash,5,900)) return json({error:"تلاش‌های ورود بیش از حد مجاز است. بعداً دوباره تلاش کنید."},429);
    const c=await credentials();
    if (!c.password_hash || !c.password_salt) return json({error:"ابتدا راه‌اندازی مدیر را انجام دهید."},409);
    const password=String(body.password||"");
    const candidate=await derivePassword(password,c.password_salt);
    if (!safeEqual(candidate,c.password_hash)) return json({error:"گذرواژه نادرست است."},401);
    const payload=b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));
    const signature=await signSession(c.session_secret,payload);
    return json({ok:true,token:payload+"."+signature});
  }

  if (path === "/api/admin/logout" && method === "POST") return json({ok:true});

  if (path.startsWith("/api/admin/")) {
    if (!await isAdmin(session)) return json({error:"برای دسترسی مدیر وارد شوید."},401);

    if (path === "/api/admin/products" && method === "GET") {
      const {data,error}=await db.from("products")
        .select("id,name,description,category,unit,price_toman,price_confirmed,stock,stock_confirmed,image_url,active,sort_order")
        .order("sort_order",{ascending:true});
      if (error) throw error;
      return json({products:(data||[]).map((p:any)=>({
        ...p,price_toman:p.price_confirmed?Number(p.price_toman):null,
        stock:p.stock_confirmed?Number(p.stock):null,image:p.image_url||""
      }))});
    }

    if (path === "/api/admin/orders" && method === "GET") {
      const {data,error}=await db.from("orders").select("*").order("created_at",{ascending:false}).limit(300);
      if (error) throw error;
      return json({orders:(data||[]).map((o:any)=>({
        ...o,items:o.items_json||o.items||[],
        subtotal_toman:o.amount_confirmed?Number(o.subtotal_toman):null,
        shipping_toman:o.amount_confirmed?Number(o.shipping_toman):null,
        total_toman:o.amount_confirmed?Number(o.total_toman):null
      }))});
    }

    const productMatch=path.match(/^\/api\/admin\/products\/([a-z0-9_-]{2,60})$/);
    if (method==="PUT" && productMatch) {
      const id=productMatch[1],name=clean(body.name,100),description=clean(body.description,500);
      const category=clean(body.category,60),unit=clean(body.unit,50),image=clean(body.image,500);
      const price=body.priceToman===null||body.priceToman===""?null:Number(body.priceToman);
      const stock=body.stock===null||body.stock===""?null:Number(body.stock);
      if(name.length<2||!unit||(price!==null&&(!Number.isSafeInteger(price)||price<1))||
        (stock!==null&&(!Number.isFinite(stock)||stock<0||stock>1000000))||
        (image && !(image.startsWith("/images/")||image.startsWith("https://images.pexels.com/photos/")))) {
        return json({error:"نام، واحد، قیمت، موجودی یا مسیر تصویر معتبر نیست."},400);
      }
      const update={
        name,description,category,unit,
        price_toman:price===null?0:price,price_confirmed:price!==null,
        stock:stock===null?0:stock,stock_confirmed:stock!==null,
        image_url:image||null,active:body.active!==false,updated_at:new Date().toISOString()
      };
      const {data,error}=await db.from("products").update(update).eq("id",id).select("id").maybeSingle();
      if(error)throw error;
      if(!data)return json({error:"محصول پیدا نشد."},404);
      return json({ok:true});
    }

    const orderMatch=path.match(/^\/api\/admin\/orders\/(PK-[A-F0-9]{8})$/);
    if(method==="PATCH"&&orderMatch){
      const id=orderMatch[1],status=clean(body.status,30),adminNote=clean(body.adminNote,500);
      if(status==="confirmed"){
        if(body.shippingToman===null||body.shippingToman===undefined||body.shippingToman==="")return json({error:"هزینه ارسال را مشخص کنید؛ برای ارسال رایگان عدد صفر وارد کنید."},400);
        const shipping=Number(body.shippingToman);
        if(!Number.isSafeInteger(shipping)||shipping<0)return json({error:"هزینه ارسال معتبر نیست."},400);
        const {data,error}=await db.rpc("confirm_store_order",{p_order_id:id,p_shipping_toman:shipping,p_admin_note:adminNote||null});
        if(error)return json({error:errorMessage(error)},409);
        return json(data||{ok:true});
      }
      const {data,error}=await db.rpc("transition_store_order",{p_order_id:id,p_status:status,p_admin_note:adminNote||null});
      if(error)return json({error:errorMessage(error)},409);
      return json(data||{ok:true,status});
    }
  }
  return json({error:"مسیر پیدا نشد."},404);
}

const PUBLIC_API_KEY="sb_publishable_Ttbile4UN76kwsZ0chw3DA_HfaqPUjA";
const STATIC_TYPES:Record<string,string>={
  "index.html":"text/html; charset=utf-8",
  "admin.html":"text/html; charset=utf-8",
  "credits.html":"text/html; charset=utf-8",
  "styles.css":"text/css; charset=utf-8",
  "admin.css":"text/css; charset=utf-8",
  "app.js":"text/javascript; charset=utf-8",
  "admin.js":"text/javascript; charset=utf-8"
};
const STATIC_HEADERS={
  "X-Content-Type-Options":"nosniff",
  "X-Frame-Options":"DENY",
  "Referrer-Policy":"strict-origin-when-cross-origin",
  "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":"default-src 'self'; img-src 'self' data: https://images.pexels.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};
async function serveStatic(req:Request){
  const url=new URL(req.url);
  const prefix="/functions/v1/store-api";
  let name=decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\\/+/, "")||"index.html";
  if(name.includes("/")||!Object.hasOwn(STATIC_TYPES,name))return new Response("Not found",{status:404,headers:STATIC_HEADERS});
  try{
    const content=await Deno.readTextFile(new URL("./public/"+name,import.meta.url));
    return new Response(req.method==="HEAD"?null:content,{status:200,headers:{...STATIC_HEADERS,"content-type":STATIC_TYPES[name],"cache-control":name.endsWith(".html")?"no-cache":"public, max-age=3600"}});
  }catch{return new Response("Not found",{status:404,headers:STATIC_HEADERS});}
}
Deno.serve(async (req: Request) => {
  if (!SUPABASE_URL || !SERVICE_KEY) return json({error:"سرویس پایگاه داده پیکربندی نشده است."},503);
  if(req.method==="GET"||req.method==="HEAD")return await serveStatic(req);
  if(req.method!=="POST")return json({error:"Method Not Allowed"},405);
  if(req.headers.get("apikey")!==PUBLIC_API_KEY)return json({error:"کلید عمومی درخواست معتبر نیست."},401);
  let payload:any;
  try { payload=await req.json(); } catch { return json({error:"درخواست معتبر نیست."},400); }
  try { return await handle(payload,req); }
  catch (error) { return json({error:errorMessage(error)},500); }
});
