import 'dotenv/config';
import express from 'express';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const dbPath = path.resolve(process.env.DATABASE_PATH || './data/store.sqlite');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    price_toman INTEGER NOT NULL CHECK(price_toman >= 0), unit TEXT NOT NULL DEFAULT 'عدد',
    stock REAL NOT NULL DEFAULT 0 CHECK(stock >= 0), active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY, telegram_user_id TEXT NOT NULL, customer_name TEXT NOT NULL,
    phone TEXT NOT NULL, city TEXT NOT NULL, address TEXT NOT NULL,
    delivery_method TEXT NOT NULL, items_json TEXT NOT NULL, subtotal_toman INTEGER NOT NULL,
    shipping_toman INTEGER NOT NULL, total_toman INTEGER NOT NULL, status TEXT NOT NULL,
    payment_tracking TEXT, payment_note TEXT, shipping_tracking TEXT, admin_note TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, actor_id TEXT NOT NULL,
    action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`);

const now = () => new Date().toISOString();
const adminIds = new Set((process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
const money = v => Number.isSafeInteger(v) && v >= 0;
const products = () => db.prepare('SELECT id,name,description,price_toman,unit,stock FROM products WHERE active=1 ORDER BY name').all();

function parseTelegramInitData(raw) {
  if (!process.env.BOT_TOKEN) throw new Error('BOT_TOKEN_NOT_CONFIGURED');
  if (!raw || raw.length > 8192) throw new Error('INVALID_INIT_DATA');
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  const authDate = Number(params.get('auth_date'));
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash) || !Number.isFinite(authDate)) throw new Error('INVALID_INIT_DATA');
  if (Math.abs(Date.now() / 1000 - authDate) > 3600) throw new Error('EXPIRED_INIT_DATA');
  const checkString = [...params.entries()].filter(([key]) => key !== 'hash').map(([key, value]) => [key, value]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, value]) => key + '=' + value).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(process.env.BOT_TOKEN).digest();
  const expected = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  const a = Buffer.from(hash, 'hex'); const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('INVALID_SIGNATURE');
  const userText = params.get('user');
  if (!userText) throw new Error('MISSING_TELEGRAM_USER');
  const user = JSON.parse(userText);
  if (!user?.id) throw new Error('MISSING_TELEGRAM_USER');
  return { id: String(user.id), name: String(user.first_name || 'مشتری').slice(0, 80), username: String(user.username || '').slice(0, 80) };
}
function auth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    if (!header.startsWith('tma ')) return res.status(401).json({ error: 'برای ادامه، فروشگاه را از داخل تلگرام باز کنید.' });
    req.telegramUser = parseTelegramInitData(header.slice(4));
    next();
  } catch (e) {
    const status = e.message === 'BOT_TOKEN_NOT_CONFIGURED' ? 503 : 401;
    res.status(status).json({ error: status === 503 ? 'تنظیمات امنیتی سرور کامل نیست.' : 'اعتبار نشست تلگرام تأیید نشد؛ فروشگاه را دوباره باز کنید.' });
  }
}
function admin(req, res, next) {
  if (!adminIds.size) return res.status(503).json({ error: 'شناسه مدیر در تنظیمات سرور تعیین نشده است.' });
  if (!adminIds.has(req.telegramUser.id)) return res.status(403).json({ error: 'دسترسی مدیر مجاز نیست.' });
  next();
}
function audit(orderId, actorId, action, detail='') {
  db.prepare('INSERT INTO audit_log(order_id,actor_id,action,detail,created_at) VALUES(?,?,?,?,?)').run(orderId, actorId, action, detail, now());
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'padnakasht-telegram-store', database: 'connected', telegramAuthConfigured: Boolean(process.env.BOT_TOKEN), adminConfigured: adminIds.size > 0 }));
app.get('/api/config', (_req, res) => res.json({
  brand: 'پادناکِشت', slogan: 'از دل طبیعت دنا',
  delivery: { isfahan: true, post: true, feeToman: 0, label: 'ارسال رایگان' }
}));
app.get('/api/products', (_req, res) => res.json({ products: products() }));

app.post('/api/orders', auth, (req, res) => {
  const { phone, city, address, deliveryMethod, items } = req.body || {};
  if (typeof phone !== 'string' || !/^[+0-9۰-۹\s()-]{8,20}$/.test(phone)) return res.status(400).json({ error: 'شماره تماس معتبر وارد کنید.' });
  if (typeof city !== 'string' || city.trim().length < 2 || city.length > 80) return res.status(400).json({ error: 'شهر را وارد کنید.' });
  if (typeof address !== 'string' || address.trim().length < 5 || address.length > 500) return res.status(400).json({ error: 'نشانی کامل وارد کنید.' });
  if (!['isfahan', 'post'].includes(deliveryMethod)) return res.status(400).json({ error: 'روش ارسال معتبر نیست.' });
  // Owner-confirmed policy: delivery is free for both Isfahan and other cities.
  const shipping = 0;
  if (!process.env.CARD_HOLDER_NAME || !process.env.CARD_NUMBER) return res.status(503).json({ error: 'اطلاعات کارت هنوز توسط مدیر تنظیم نشده است؛ سفارش فعلاً ثبت نمی‌شود.' });
  if (!Array.isArray(items) || items.length < 1 || items.length > 40) return res.status(400).json({ error: 'سبد خرید معتبر نیست.' });
  const catalog = new Map(products().map(p => [p.id, p]));
  const normalized = [];
  let subtotal = 0;
  for (const item of items) {
    const p = catalog.get(String(item?.productId || ''));
    const qty = Number(item?.quantity);
    if (!p || !Number.isFinite(qty) || qty <= 0 || qty > p.stock || qty > 1000) return res.status(400).json({ error: 'کالا یا تعداد انتخاب‌شده معتبر نیست یا موجودی کافی نیست.' });
    const price = Number(p.price_toman);
    const line = Math.round(price * qty);
    if (!Number.isSafeInteger(line) || line <= 0 || !Number.isSafeInteger(subtotal + line)) return res.status(400).json({ error: 'مبلغ سفارش معتبر نیست.' });
    subtotal += line;
    normalized.push({ productId: p.id, name: p.name, unit: p.unit, quantity: qty, unitPriceToman: price, lineTotalToman: line });
  }
  const total = subtotal + shipping;
  if (!Number.isSafeInteger(total) || total <= 0) return res.status(400).json({ error: 'مبلغ نهایی معتبر نیست.' });
  const id = 'PK-' + crypto.randomBytes(5).toString('hex').toUpperCase();
  const timestamp = now();
  try {
    const createOrder = db.transaction(() => {
      // Re-check and reserve stock inside the same transaction to avoid overselling.
      for (const line of normalized) {
        const result = db.prepare('UPDATE products SET stock=stock-?,updated_at=? WHERE id=? AND active=1 AND stock>=?').run(line.quantity, timestamp, line.productId, line.quantity);
        if (result.changes !== 1) throw new Error('STOCK_CHANGED');
      }
      db.prepare(`INSERT INTO orders(id,telegram_user_id,customer_name,phone,city,address,delivery_method,items_json,subtotal_toman,shipping_toman,total_toman,status,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, req.telegramUser.id, req.telegramUser.name, phone.trim(), city.trim(), address.trim(), deliveryMethod, JSON.stringify(normalized), subtotal, shipping, total, 'awaiting_payment', timestamp, timestamp);
      audit(id, req.telegramUser.id, 'order_created', 'سفارش ثبت شد؛ در انتظار تأیید پرداخت و موجودی رزرو شد');
    });
    createOrder();
  } catch (e) {
    if (e.message === 'STOCK_CHANGED') return res.status(409).json({ error: 'موجودی کالا تغییر کرده است؛ سبد خرید را به‌روزرسانی کنید.' });
    throw e;
  }
  // Card details are returned only from the order-creation/checkout response.
  res.status(201).json({
    order: { id, items: normalized, subtotalToman: subtotal, shippingToman: shipping, totalToman: total, status: 'awaiting_payment' },
    payment: { method: 'card_transfer', cardHolderName: process.env.CARD_HOLDER_NAME || null, cardNumber: process.env.CARD_NUMBER || null, configured: Boolean(process.env.CARD_HOLDER_NAME && process.env.CARD_NUMBER) },
    message: 'پس از کارت‌به‌کارت، کد پیگیری را ثبت کنید. سفارش تا تأیید مدیر پرداخت‌شده محسوب نمی‌شود.'
  });
});

app.post('/api/orders/:id/payment-reference', auth, (req, res) => {
  const ref = String(req.body?.trackingCode || '').trim();
  if (ref.length < 4 || ref.length > 120) return res.status(400).json({ error: 'کد پیگیری معتبر وارد کنید.' });
  const order = db.prepare('SELECT id,telegram_user_id,status FROM orders WHERE id=?').get(req.params.id);
  if (!order || order.telegram_user_id !== req.telegramUser.id) return res.status(404).json({ error: 'سفارش پیدا نشد.' });
  if (order.status !== 'awaiting_payment') return res.status(409).json({ error: 'وضعیت سفارش اجازه ثبت کد پرداخت را نمی‌دهد.' });
  db.prepare('UPDATE orders SET payment_tracking=?,status=?,updated_at=? WHERE id=?').run(ref, 'payment_submitted', now(), order.id);
  audit(order.id, req.telegramUser.id, 'payment_reference_submitted', 'کد پیگیری ثبت شد؛ پرداخت هنوز تأیید نشده است');
  res.json({ ok: true, status: 'payment_submitted', message: 'کد ثبت شد؛ پس از بررسی واریز توسط مدیر نتیجه اعلام می‌شود.' });
});

app.get('/api/my-orders', auth, (req, res) => {
  const rows = db.prepare('SELECT id,items_json,subtotal_toman,shipping_toman,total_toman,status,payment_tracking,shipping_tracking,created_at FROM orders WHERE telegram_user_id=? ORDER BY created_at DESC LIMIT 50').all(req.telegramUser.id);
  res.json({ orders: rows.map(o => ({ id:o.id, items:JSON.parse(o.items_json), subtotalToman:o.subtotal_toman, shippingToman:o.shipping_toman, totalToman:o.total_toman, status:o.status, paymentTracking:o.payment_tracking, shippingTracking:o.shipping_tracking, createdAt:o.created_at })) });
});

app.get('/api/admin/orders', auth, admin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 300').all();
  res.json({ orders: rows.map(o => ({ id:o.id,customerName:o.customer_name,telegramUserId:o.telegram_user_id,phone:o.phone,city:o.city,address:o.address,deliveryMethod:o.delivery_method,items:JSON.parse(o.items_json),subtotalToman:o.subtotal_toman,shippingToman:o.shipping_toman,totalToman:o.total_toman,status:o.status,paymentTracking:o.payment_tracking,shippingTracking:o.shipping_tracking,adminNote:o.admin_note,createdAt:o.created_at,updatedAt:o.updated_at })) });
});
app.post('/api/admin/products', auth, admin, (req, res) => {
  const { id, name, description='', priceToman, unit='عدد', stock=0, active=true } = req.body || {};
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{2,60}$/.test(id) || typeof name !== 'string' || name.trim().length < 2 || name.length > 100 || !money(priceToman) || priceToman === 0 || !Number.isFinite(stock) || stock < 0 || stock > 1000000 || typeof unit !== 'string' || unit.length > 20) return res.status(400).json({ error: 'اطلاعات کالا معتبر نیست.' });
  db.prepare(`INSERT INTO products(id,name,description,price_toman,unit,stock,active,updated_at) VALUES(?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,price_toman=excluded.price_toman,unit=excluded.unit,stock=excluded.stock,active=excluded.active,updated_at=excluded.updated_at`)
    .run(id,name.trim(),String(description).slice(0,500),priceToman,unit,stock,active ? 1 : 0,now());
  res.json({ ok:true, product:db.prepare('SELECT * FROM products WHERE id=?').get(id) });
});
const allowedStatuses = new Set(['payment_confirmed','preparing','shipped','completed','cancelled']);
app.patch('/api/admin/orders/:id', auth, admin, (req, res) => {
  const { status, shippingTracking='', adminNote='' } = req.body || {};
  if (!allowedStatuses.has(status)) return res.status(400).json({ error: 'وضعیت انتخاب‌شده معتبر نیست.' });
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'سفارش پیدا نشد.' });
  if (status === 'payment_confirmed' && !['awaiting_payment','payment_submitted'].includes(order.status)) return res.status(409).json({ error: 'این سفارش در وضعیت قابل تأیید پرداخت نیست.' });
  if (['preparing','shipped','completed'].includes(status) && !['payment_confirmed','preparing','shipped'].includes(order.status)) return res.status(409).json({ error: 'ابتدا پرداخت را دستی تأیید کنید.' });
  if (order.status === 'cancelled' && status !== 'cancelled') return res.status(409).json({ error: 'سفارش لغوشده قابل بازگردانی به جریان ارسال نیست؛ سفارش جدید ثبت کنید.' });
  if (status === 'cancelled' && ['shipped','completed'].includes(order.status)) return res.status(409).json({ error: 'سفارش ارسال‌شده یا تکمیل‌شده از این پنل قابل لغو نیست؛ بررسی دستی لازم است.' });
  const changeStatus = db.transaction(() => {
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const lines = JSON.parse(order.items_json);
      for (const line of lines) db.prepare('UPDATE products SET stock=stock+?,updated_at=? WHERE id=?').run(line.quantity, now(), line.productId);
    }
    db.prepare('UPDATE orders SET status=?,shipping_tracking=?,admin_note=?,updated_at=? WHERE id=?').run(status,String(shippingTracking).slice(0,120),String(adminNote).slice(0,500),now(),order.id);
    audit(order.id,req.telegramUser.id,'status_changed',order.status+' -> '+status);
  });
  changeStatus();
  res.json({ ok:true, id:order.id, status });
});
app.get('/api/admin/audit/:id', auth, admin, (req, res) => res.json({ events:db.prepare('SELECT actor_id,action,detail,created_at FROM audit_log WHERE order_id=? ORDER BY id').all(req.params.id) }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((_req, res) => res.status(404).json({ error: 'مسیر پیدا نشد.' }));
app.use((err, _req, res, _next) => {
  console.error('request_error', err?.message || 'unknown');
  if (res.headersSent) return;
  res.status(500).json({ error: 'خطای داخلی سرور رخ داد.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log('PadnaKesht Telegram Store listening on port ' + port));
