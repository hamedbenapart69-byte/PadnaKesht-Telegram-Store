import fs from "node:fs";
import path from "node:path";
const root=process.cwd();
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const files={
  worker:read("website/src/index.js"),wrangler:read("website/wrangler.toml"),
  html:read("website/public/index.html"),adminHtml:read("website/public/admin.html"),
  app:read("website/public/app.js"),admin:read("website/public/admin.js"),
  css:read("website/public/styles.css"),adminCss:read("website/public/admin.css"),edge:read("website/supabase/functions/store-api/index.ts"),
  migration:read("website/supabase/migrations/20261107154357_storefront_orders_admin_and_inventory.sql"),
  proxyMigration:read("website/supabase/migrations/20261107155324_store_api_proxy_secret_guard.sql"),
  credits:read("website/public/credits.html"),robots:read("website/public/robots.txt"),
  config:read("website/supabase/config.toml")
};
const roles={
  architecture:()=>{
    need(files.worker.includes("/functions/v1/store-api"),"Worker must proxy the Supabase Edge Function");
    need(files.wrangler.includes('binding = "ASSETS"')&&files.wrangler.includes('run_worker_first = ["/api/*"]'),"Static assets/API routing missing");
    need(files.wrangler.includes("SUPABASE_URL")&&!/d1_databases|database_id/i.test(files.wrangler),"Unexpected D1 dependency");
    need(files.worker.includes("scheduled")&&files.worker.includes("keepDatabaseAwake"),"Free-tier database keepalive trigger missing");
  },
  security:()=>{
    need(files.edge.includes("SUPABASE_SERVICE_ROLE_KEY"),"Server-side service role not used");
    need(files.edge.includes("PBKDF2")&&files.edge.includes("310000"),"Password hashing parameters missing");
    need(files.edge.includes("HMAC")&&files.edge.includes("signSession")&&files.edge.includes("isAdmin"),"Signed admin session verification missing");
    need(files.edge.includes("consume_store_rate_limit")&&files.migration.includes("ENABLE ROW LEVEL SECURITY"),"Rate limit or RLS controls missing");
    need(files.worker.includes("STORE_PROXY_SECRET")&&files.edge.includes("x-store-proxy-secret")&&files.proxyMigration.includes("proxy_secret_hash"),"Private Worker proxy authentication missing");
    need(!files.wrangler.includes("service_role")&&!/ADMIN_PASSWORD\s*=/.test(files.worker+files.wrangler),"Private credential found in deploy config");
    need(!/on(click|load|error)=/i.test(files.html+files.adminHtml),"Inline HTML event handler found");
  },
  database:()=>{
    for(const token of ["price_confirmed","stock_confirmed","amount_confirmed","numeric(12,2)","store_admin_credentials","store_rate_limits"])need(files.migration.includes(token),"Missing database control: "+token);
    need(files.migration.includes("REVOKE ALL ON FUNCTION")&&files.migration.includes("GRANT EXECUTE"),"RPC permissions are not restricted");
  },
  orders:()=>{
    for(const token of ["/api/orders","/api/order-lookup","/api/admin/orders","confirm_store_order","transition_store_order"])need(files.edge.includes(token),"Order API contract missing: "+token);
    need(files.html.includes('id="checkout-form"')&&files.html.includes('id="track-form"'),"Checkout or tracking form missing");
    need(files.app.includes("order-lookup")&&files.app.includes("checkout-form"),"Customer order flow is incomplete");
  },
  inventory:()=>{
    need(files.migration.includes("stock=stock-v_qty"),"Atomic inventory reservation missing");
    need(files.migration.includes("stock=stock+v_qty"),"Inventory restoration on cancellation missing");
    need(files.migration.includes("MINIMUM_LOAR_CHEESE")&&files.edge.includes('id==="loar-cheese"'),"Minimum cheese quantity rule missing");
    need(files.edge.includes("stock_confirmed")&&files.edge.includes("price_confirmed"),"Unconfirmed stock/price guard missing");
  },
  accessibility:()=>{
    need(files.html.includes('<html lang="fa" dir="rtl">')&&files.adminHtml.includes('<html lang="fa" dir="rtl">'),"Persian RTL document metadata missing");
    need(files.html.includes('aria-live="polite"')&&files.html.includes('role="status"'),"Live status announcements missing");
    need(files.html.includes('alt="')&&files.adminHtml.includes('aria-label'),"Image alternatives or control labels missing");
    need(files.html.includes('<label')&&files.adminHtml.includes('<label'),"Form labels missing");
  },
  responsive:()=>{
    need(files.css.includes("@media(max-width:760px)")&&files.adminCss.includes("@media(max-width:680px)"),"Mobile layout breakpoints missing");
    need(files.css.includes("prefers-reduced-motion"),"Reduced-motion support missing");
    need(files.css.includes("grid-template-columns:repeat(2"),"Mobile product grid missing");
  },
  images:()=>{
    need(files.app.includes('class="image-note"')&&files.html.includes("عکس اختصاصی خفر نیست"),"Representative image disclosure missing");
    need(files.credits.includes("Pexels License")&&files.credits.includes("عکس خفر پادنا نیست"),"Photo provenance disclosure missing");
    need(files.worker.includes("images.pexels.com"),"Image host is not allowlisted in CSP");
    need(files.robots.includes("Disallow: /admin.html"),"Admin page indexing exclusion missing");
  },
  performance:()=>{
    need(files.app.includes('loading="lazy"'),"Lazy loading for catalogue images missing");
    need(files.worker.includes('"cache-control":"no-store"'),"Sensitive API responses must not be cached");
    need(!files.html.includes("fonts.googleapis.com")&&!files.html.includes("<script src=\"https://"),"Unneeded external frontend dependency found");
    need(files.worker.includes("X-Content-Type-Options")&&files.worker.includes("Referrer-Policy"),"Baseline security headers missing");
  },
  deployment:()=>{
    need(files.wrangler.includes('name = "padnakasht-store"')&&files.wrangler.includes('main = "src/index.js"'),"Worker deployment identity missing");
    need(files.wrangler.includes('crons = ["0 */8 * * *"]'),"Database keepalive schedule missing");
    need(files.wrangler.includes("sb_publishable_"),"Public Supabase publishable key missing");
    need(files.config.includes("verify_jwt = false")&&files.edge.includes("isAdmin"),"Edge Function custom-auth pairing missing");
  }
};
function need(ok,message){if(!ok)throw new Error(message);}
const role=process.argv[2];
if(!roles[role])throw new Error("Unknown reviewer: "+role);
roles[role]();
console.log("PASS independent reviewer: "+role);
