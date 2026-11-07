const INITIAL_PRODUCTS = [
  ["kashk","کشک","کشک محلی؛ قیمت و موجودی پس از تأیید ثبت می‌شود.","لبنیات","کیلوگرم","https://images.pexels.com/photos/10809146/pexels-photo-10809146.jpeg?cs=srgb&dl=pexels-eliftekkaya-10809146.jpg&fm=jpg",10],
  ["walnut-kernel","مغز گردو","مغز گردوی تولیدکنندگان پادنا.","خشکبار","کیلوگرم","https://images.pexels.com/photos/36418624/pexels-photo-36418624.jpeg?cs=srgb&dl=pexels-edita-brus-2027796741-36418624.jpg&fm=jpg",20],
  ["grape-molasses","شیره انگور","شیره انگور؛ بدون افزودنی طبق توضیح محصول.","شیره‌ها","کیلوگرم","https://images.pexels.com/photos/21193087/pexels-photo-21193087.jpeg?cs=srgb&dl=pexels-andres-alaniz-461433202-21193087.jpg&fm=jpg",30],
  ["apple-molasses","شیره سیب","شیره سیب تهیه‌شده در پادنا.","شیره‌ها","کیلوگرم","https://images.pexels.com/photos/14833258/pexels-photo-14833258.jpeg?cs=srgb&dl=pexels-nogman-14833258.jpg&fm=jpg",40],
  ["vinegar","سرکه","سرکه محلی؛ حجم بطری هنگام تأیید سفارش مشخص می‌شود.","چاشنی‌ها","بطری ۱٫۵ لیتری","https://images.pexels.com/photos/7493940/pexels-photo-7493940.jpeg?cs=srgb&dl=pexels-roman-odintsov-7493940.jpg&fm=jpg",50],
  ["honey","عسل","عسل عرضه‌شده از تولیدکنندگان منطقه.","عسل و فرآورده‌ها","کیلوگرم","https://images.pexels.com/photos/5634203/pexels-photo-5634203.jpeg?cs=srgb&dl=pexels-adonyi-foto-5634203.jpg&fm=jpg",60],
  ["beans","لوبیا","لوبیای تولید منطقه پادنا.","حبوبات","کیلوگرم","https://images.pexels.com/photos/5228850/pexels-photo-5228850.jpeg?cs=srgb&dl=pexels-leeloothefirst-5228850.jpg&fm=jpg",70],
  ["loar-cheese","پنیر لوار","پنیر لوار محلی؛ حداقل سفارش نیم‌کیلوگرم.","لبنیات","کیلوگرم","https://images.pexels.com/photos/19460144/pexels-photo-19460144.jpeg?cs=srgb&dl=pexels-jaralol-19460144.jpg&fm=jpg",80],
  ["tahini","ارده","ارده کنجد.","چاشنی‌ها","کیلوگرم","https://images.pexels.com/photos/8951047/pexels-photo-8951047.jpeg?cs=srgb&dl=pexels-ivan-s-8951047.jpg&fm=jpg",90],
  ["abghooreh","آبغوره","آبغوره تهیه‌شده از غوره سبز.","چاشنی‌ها","بطری","https://images.pexels.com/photos/7656754/pexels-photo-7656754.jpeg?cs=srgb&dl=pexels-cup-of-couple-7656754.jpg&fm=jpg",100],
  ["date-molasses","شیره خرما","شیره خرما.","شیره‌ها","کیلوگرم","https://images.pexels.com/photos/20520971/pexels-photo-20520971.jpeg?cs=srgb&dl=pexels-visualstoriesbytugba-20520971.jpg&fm=jpg",110],
  ["fig","انجیر","انجیر خشک منطقه.","خشکبار","کیلوگرم","https://images.pexels.com/photos/4499221/pexels-photo-4499221.jpeg?cs=srgb&dl=pexels-shkrabaanthony-4499221.jpg&fm=jpg",120],
  ["mulberry","توت خشک","توت خشک محلی.","خشکبار","کیلوگرم","https://images.pexels.com/photos/4499220/pexels-photo-4499220.jpeg?cs=srgb&dl=pexels-shkrabaanthony-4499220.jpg&fm=jpg",130]
];

let schemaReady = false;
const now = () => new Date().toISOString();
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra }
});
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const isInt = (value, min = 0) => Number.isSafeInteger(value) && value >= min;

function parseCookie(header, name) {
  const part = (header || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}
function b64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function adminSession(request, env) {
  if (!env.ADMIN_SESSION_SECRET) return false;
  const token = parseCookie(request.headers.get("cookie"), "pk_admin");
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const payload = parts[0], signature = parts[1];
  const expected = await hmac(env.ADMIN_SESSION_SECRET, payload);
  if (!safeEqual(signature, expected)) return false;
  try {
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return Number.isSafeInteger(data.exp) && data.exp > Date.now();
  } catch { return false; }
}
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
function securityHeaders(headers = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; img-src 'self' data: https://images.pexels.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...headers
  };
}
async function ensureSchema(db) {
  if (schemaReady) return;
  const ddl = [
    "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY,name TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',category TEXT NOT NULL DEFAULT '',unit TEXT NOT NULL DEFAULT 'عدد',price_toman INTEGER,stock REAL,image TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,sort_order INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY,customer_name TEXT NOT NULL,phone TEXT NOT NULL,city TEXT NOT NULL,address TEXT NOT NULL,delivery_method TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',items_json TEXT NOT NULL,subtotal_toman INTEGER,shipping_toman INTEGER,total_toman INTEGER,status TEXT NOT NULL DEFAULT 'new',admin_note TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,hits INTEGER NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)",
    "CREATE TRIGGER IF NOT EXISTS order_confirm_guard BEFORE UPDATE OF status ON orders WHEN NEW.status='confirmed' AND OLD.status!='confirmed' BEGIN SELECT CASE WHEN EXISTS (SELECT 1 FROM json_each(NEW.items_json) AS item LEFT JOIN products AS p ON p.id=json_extract(item.value,'$.productId') WHERE p.id IS NULL OR p.price_toman IS NULL OR p.stock IS NULL OR p.stock < CAST(json_extract(item.value,'$.quantity') AS REAL)) THEN RAISE(ABORT,'STOCK_OR_PRICE_UNAVAILABLE') END; END",
    "CREATE TRIGGER IF NOT EXISTS order_confirm_reserve AFTER UPDATE OF status ON orders WHEN NEW.status='confirmed' AND OLD.status!='confirmed' BEGIN UPDATE products SET stock=stock-(SELECT CAST(json_extract(item.value,'$.quantity') AS REAL) FROM json_each(NEW.items_json) AS item WHERE json_extract(item.value,'$.productId')=products.id),updated_at=NEW.updated_at WHERE id IN (SELECT json_extract(item.value,'$.productId') FROM json_each(NEW.items_json) AS item); END",
    "CREATE TRIGGER IF NOT EXISTS order_cancel_restore AFTER UPDATE OF status ON orders WHEN NEW.status='cancelled' AND OLD.status IN ('confirmed','preparing') BEGIN UPDATE products SET stock=stock+(SELECT CAST(json_extract(item.value,'$.quantity') AS REAL) FROM json_each(NEW.items_json) AS item WHERE json_extract(item.value,'$.productId')=products.id),updated_at=NEW.updated_at WHERE id IN (SELECT json_extract(item.value,'$.productId') FROM json_each(NEW.items_json) AS item); END"
  ];
  try {
    await db.batch(ddl.map(s => db.prepare(s)));
    const stamp = now();
    await db.batch(INITIAL_PRODUCTS.map(p => db.prepare(
      "INSERT OR IGNORE INTO products(id,name,description,category,unit,price_toman,stock,image,active,sort_order,updated_at) VALUES(?,?,?,?,?,NULL,NULL,?,1,?,?)"
    ).bind(p[0],p[1],p[2],p[3],p[4],p[5],p[6],stamp)));
    schemaReady = true;
  } catch (error) {
    schemaReady = false;
    throw error;
  }
}
async function hashText(value) {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}
async function rateLimit(db, key, limit, windowMs) {
  const time = Date.now();
  const row = await db.prepare("SELECT window_start,hits FROM rate_limits WHERE key=?").bind(key).first();
  if (!row || time - row.window_start >= windowMs) {
    await db.prepare("INSERT INTO rate_limits(key,window_start,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,hits=1").bind(key,time).run();
    return true;
  }
  if (row.hits >= limit) return false;
  await db.prepare("UPDATE rate_limits SET hits=hits+1 WHERE key=?").bind(key).run();
  return true;
}
async function audit(db, orderId, action, detail = "") {
  await db.prepare("INSERT INTO audit_log(order_id,actor,action,detail,created_at) VALUES(?,?,?,?,?)")
    .bind(orderId,"admin",action,clean(detail,500),now()).run();
}
async function handleApi(request, env) {
  if (!env.DB) return json({ error: "پایگاه داده به سرویس متصل نشده است." }, 503);
  await ensureSchema(env.DB);
  const url = new URL(request.url), path = url.pathname, method = request.method;

  if (method === "GET" && path === "/api/health") return json({ ok:true,service:"padnakasht-store",database:"connected" });

  if (method === "GET" && path === "/api/products") {
    const result = await env.DB.prepare("SELECT id,name,description,category,unit,price_toman,stock,image FROM products WHERE active=1 ORDER BY sort_order,name").all();
    return json({ products:result.results || [] },200,{"cache-control":"public, max-age=60, s-maxage=60"});
  }

  if (method === "POST" && path === "/api/orders") {
    if (!sameOrigin(request)) return json({error:"درخواست نامعتبر است."},403);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await rateLimit(env.DB,"order:"+await hashText(ip),8,3600000)) return json({error:"تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید."},429);
    let body;
    try { body = await request.json(); } catch { return json({error:"اطلاعات ارسالی معتبر نیست."},400); }
    const customerName = clean(body.customerName,100), phone = clean(body.phone,24);
    const city = clean(body.city,80), address = clean(body.address,500), notes = clean(body.notes,500);
    const deliveryMethod = body.deliveryMethod === "isfahan" ? "isfahan" : body.deliveryMethod === "post" ? "post" : "";
    if (customerName.length < 2) return json({error:"نام و نام خانوادگی را وارد کنید."},400);
    if (!/^[+0-9۰-۹\\s()\\-]{8,24}$/.test(phone)) return json({error:"شماره تماس معتبر وارد کنید."},400);
    if (city.length < 2 || address.length < 5 || !deliveryMethod) return json({error:"شهر، نشانی کامل و روش تحویل را بررسی کنید."},400);
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return json({error:"سبد خرید معتبر نیست."},400);

    const quantities = new Map();
    for (const item of body.items) {
      const id = clean(item?.productId,60), qty = Number(item?.quantity);
      if (!id || !Number.isFinite(qty) || qty <= 0 || qty > 100 || Math.round(qty*100) !== qty*100) return json({error:"تعداد یکی از کالاها معتبر نیست."},400);
      quantities.set(id,(quantities.get(id)||0)+qty);
    }
    if (quantities.size > 20) return json({error:"تعداد کالاهای انتخابی بیش از حد مجاز است."},400);
    const ids = [...quantities.keys()], placeholders = ids.map(()=>"?").join(",");
    const found = await env.DB.prepare("SELECT id,name,unit,price_toman,stock FROM products WHERE active=1 AND id IN ("+placeholders+")").bind(...ids).all();
    const byId = new Map((found.results||[]).map(p=>[p.id,p]));
    if (byId.size !== ids.length) return json({error:"یکی از کالاها دیگر در فهرست فروش نیست؛ صفحه را تازه کنید."},409);

    const lines = [];
    let subtotal = 0, pricesKnown = true;
    for (const [id,quantity] of quantities) {
      const p = byId.get(id);
      if (p.stock !== null && Number(p.stock) < quantity) return json({error:"موجودی «"+p.name+"» برای این تعداد کافی نیست."},409);
      if (p.price_toman === null) pricesKnown = false;
      else subtotal += Math.round(Number(p.price_toman)*quantity);
      lines.push({productId:id,name:p.name,unit:p.unit,quantity,unitPriceToman:p.price_toman===null?null:Number(p.price_toman)});
    }
    if (!pricesKnown || !Number.isSafeInteger(subtotal)) subtotal = null;
    const id = "PK-"+crypto.randomUUID().replace(/-/g,"").slice(0,8).toUpperCase(), stamp = now();
    await env.DB.prepare("INSERT INTO orders(id,customer_name,phone,city,address,delivery_method,notes,items_json,subtotal_toman,shipping_toman,total_toman,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,NULL,NULL,'new',?,?)")
      .bind(id,customerName,phone,city,address,deliveryMethod,notes,JSON.stringify(lines),subtotal,stamp,stamp).run();
    return json({ok:true,order:{id,status:"new",subtotalToman:subtotal,shippingToman:null,totalToman:null},message:"درخواست خرید ثبت شد. موجودی، قیمت نهایی و هزینه ارسال پیش از تأیید سفارش با شما هماهنگ می‌شود."},201);
  }

  if (method === "POST" && path === "/api/order-lookup") {
    let body;
    try { body = await request.json(); } catch { return json({error:"اطلاعات معتبر نیست."},400); }
    const code = clean(body.code,30).toUpperCase(), phone = clean(body.phone,24);
    if (!code || !phone) return json({error:"کد سفارش و شماره تماس را وارد کنید."},400);
    const order = await env.DB.prepare("SELECT id,phone,status,subtotal_toman,shipping_toman,total_toman,created_at,updated_at FROM orders WHERE id=?").bind(code).first();
    if (!order || order.phone !== phone) return json({error:"سفارشی با این کد و شماره تماس پیدا نشد."},404);
    return json({order:{id:order.id,status:order.status,subtotalToman:order.subtotal_toman,shippingToman:order.shipping_toman,totalToman:order.total_toman,createdAt:order.created_at,updatedAt:order.updated_at}});
  }

  if (method === "POST" && path === "/api/admin/login") {
    if (!sameOrigin(request)) return json({error:"درخواست نامعتبر است."},403);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await rateLimit(env.DB,"login:"+await hashText(ip),5,900000)) return json({error:"تلاش‌های ورود بیش از حد مجاز است. بعداً دوباره تلاش کنید."},429);
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) return json({error:"ورود مدیر هنوز در تنظیمات امن میزبان پیکربندی نشده است."},503);
    let body;
    try { body = await request.json(); } catch { return json({error:"درخواست معتبر نیست."},400); }
    const candidate = clean(body.password,200);
    const expected = await hmac(env.ADMIN_SESSION_SECRET,"admin-password:"+env.ADMIN_PASSWORD);
    const supplied = await hmac(env.ADMIN_SESSION_SECRET,"admin-password:"+candidate);
    if (!safeEqual(expected,supplied)) return json({error:"گذرواژه نادرست است."},401);
    const payload = b64url(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})));
    const signature = await hmac(env.ADMIN_SESSION_SECRET,payload);
    return json({ok:true},200,{"Set-Cookie":"pk_admin="+encodeURIComponent(payload+"."+signature)+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800"});
  }

  if (method === "GET" && path === "/api/admin/session") return json({authenticated:await adminSession(request,env)});

  if (path.startsWith("/api/admin/")) {
    if (!sameOrigin(request)) return json({error:"درخواست نامعتبر است."},403);
    if (!await adminSession(request,env)) return json({error:"برای دسترسی مدیر وارد شوید."},401);
    if (method === "POST" && path === "/api/admin/logout") return json({ok:true},200,{"Set-Cookie":"pk_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0"});

    if (method === "GET" && path === "/api/admin/products") {
      const rows = await env.DB.prepare("SELECT * FROM products ORDER BY sort_order,name").all();
      return json({products:rows.results||[]});
    }
    if (method === "GET" && path === "/api/admin/orders") {
      const rows = await env.DB.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 300").all();
      return json({orders:(rows.results||[]).map(o=>({...o,items:JSON.parse(o.items_json)}))});
    }

    const productMatch = path.match(/^\\/api\\/admin\\/products\\/([a-z0-9_-]{2,60})$/);
    if (method === "PUT" && productMatch) {
      let body;
      try { body = await request.json(); } catch { return json({error:"اطلاعات کالا معتبر نیست."},400); }
      const id = productMatch[1], name = clean(body.name,100), description = clean(body.description,500);
      const category = clean(body.category,60), unit = clean(body.unit,30), image = clean(body.image,240);
      const price = body.priceToman === null || body.priceToman === "" ? null : Number(body.priceToman);
      const stock = body.stock === null || body.stock === "" ? null : Number(body.stock);
      const active = body.active === false ? 0 : 1;
      if (name.length<2 || !unit || (price!==null && !isInt(price,1)) || (stock!==null && (!Number.isFinite(stock)||stock<0||stock>1000000)) || (image && !(image.startsWith("/images/") || image.startsWith("https://images.pexels.com/photos/")))) return json({error:"نام، واحد، قیمت، موجودی یا مسیر تصویر معتبر نیست."},400);
      await env.DB.prepare("UPDATE products SET name=?,description=?,category=?,unit=?,price_toman=?,stock=?,image=?,active=?,updated_at=? WHERE id=?")
        .bind(name,description,category,unit,price,stock,image,active,now(),id).run();
      return json({ok:true});
    }

    const orderMatch = path.match(/^\\/api\\/admin\\/orders\\/(PK-[A-F0-9]{8})$/);
    if (method === "PATCH" && orderMatch) {
      let body;
      try { body = await request.json(); } catch { return json({error:"اطلاعات سفارش معتبر نیست."},400); }
      const id = orderMatch[1], order = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
      if (!order) return json({error:"سفارش پیدا نشد."},404);
      const status = clean(body.status,30), allowed = new Set(["reviewed","confirmed","preparing","shipped","completed","cancelled"]);
      if (!allowed.has(status)) return json({error:"وضعیت انتخاب‌شده معتبر نیست."},400);
      const adminNote = clean(body.adminNote ?? order.admin_note,500), stamp = now();

      if (status==="confirmed") {
        if (!["new","reviewed"].includes(order.status)) return json({error:"این سفارش در وضعیت قابل تأیید نیست."},409);
        const shipping = Number(body.shippingToman);
        if (!isInt(shipping,0)) return json({error:"هزینه ارسال را به تومان و به‌صورت عدد صحیح وارد کنید."},400);
        const items = JSON.parse(order.items_json), ids = items.map(x=>x.productId), placeholders = ids.map(()=>"?").join(",");
        const rows = await env.DB.prepare("SELECT id,name,unit,price_toman,stock FROM products WHERE id IN ("+placeholders+")").bind(...ids).all();
        const products = new Map((rows.results||[]).map(p=>[p.id,p]));
        let subtotal = 0; const priced = [];
        for (const item of items) {
          const p = products.get(item.productId);
          if (!p || p.price_toman===null || p.stock===null || Number(p.stock)<Number(item.quantity)) return json({error:"قیمت یا موجودی یکی از کالاها هنوز تأیید نشده یا موجودی کافی نیست."},409);
          const line = Math.round(Number(p.price_toman)*Number(item.quantity));
          if (!Number.isSafeInteger(line)) return json({error:"محاسبه مبلغ سفارش معتبر نیست."},400);
          subtotal += line; priced.push({...item,name:p.name,unit:p.unit,unitPriceToman:Number(p.price_toman)});
        }
        const total = subtotal + shipping;
        if (!Number.isSafeInteger(total)) return json({error:"مبلغ نهایی معتبر نیست."},400);
        try {
          const result = await env.DB.prepare("UPDATE orders SET items_json=?,subtotal_toman=?,shipping_toman=?,total_toman=?,status='confirmed',admin_note=?,updated_at=? WHERE id=? AND status IN ('new','reviewed')")
            .bind(JSON.stringify(priced),subtotal,shipping,total,adminNote,stamp,id).run();
          if (result.meta?.changes!==1) return json({error:"وضعیت سفارش هم‌زمان تغییر کرده است؛ فهرست را تازه کنید."},409);
        } catch (error) {
          if (String(error.message||error).includes("STOCK_OR_PRICE_UNAVAILABLE")) return json({error:"موجودی یا قیمت یکی از کالاها تغییر کرده است؛ سفارش تأیید نشد."},409);
          throw error;
        }
        await audit(env.DB,id,"confirmed","مبلغ نهایی: "+total+" تومان؛ هزینه ارسال: "+shipping+" تومان");
        return json({ok:true,status:"confirmed",totalToman:total});
      }

      if (status==="reviewed" && !["new","reviewed"].includes(order.status)) return json({error:"تغییر وضعیت مجاز نیست."},409);
      if (status==="preparing" && order.status!=="confirmed") return json({error:"ابتدا سفارش را تأیید کنید."},409);
      if (status==="shipped" && order.status!=="preparing") return json({error:"ابتدا سفارش را آماده کنید."},409);
      if (status==="completed" && order.status!=="shipped") return json({error:"ابتدا سفارش را ارسال‌شده ثبت کنید."},409);
      if (status==="cancelled" && ["shipped","completed","cancelled"].includes(order.status)) return json({error:"سفارش ارسال‌شده، تکمیل‌شده یا لغوشده قابل لغو نیست."},409);
      const result = await env.DB.prepare("UPDATE orders SET status=?,admin_note=?,updated_at=? WHERE id=? AND status=?")
        .bind(status,adminNote,stamp,id,order.status).run();
      if (result.meta?.changes!==1) return json({error:"سفارش هم‌زمان تغییر کرده است؛ فهرست را تازه کنید."},409);
      await audit(env.DB,id,"status_changed",order.status+" -> "+status);
      return json({ok:true,status});
    }
  }
  return json({error:"مسیر پیدا نشد."},404);
}

export default {
  async fetch(request,env) {
    const headers = securityHeaders();
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        const response = await handleApi(request,env);
        const merged = new Headers(response.headers);
        for (const [key,value] of Object.entries(headers)) merged.set(key,value);
        return new Response(response.body,{status:response.status,headers:merged});
      }
      if (request.method!=="GET" && request.method!=="HEAD") return new Response("Method Not Allowed",{status:405,headers});
      const assetResponse = await env.ASSETS.fetch(request);
      const merged = new Headers(assetResponse.headers);
      for (const [key,value] of Object.entries(headers)) merged.set(key,value);
      return new Response(assetResponse.body,{status:assetResponse.status,headers:merged});
    } catch {
      return json({error:"خطای داخلی رخ داد. لطفاً کمی بعد دوباره تلاش کنید."},500,headers);
    }
  }
};
