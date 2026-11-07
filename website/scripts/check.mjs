import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const required=[
 "website/public/index.html","website/public/admin.html","website/public/credits.html",
 "website/public/styles.css","website/public/admin.css","website/public/app.js","website/public/admin.js",
 "website/supabase/config.toml","website/supabase/functions/store-api/index.ts",
 "website/supabase/functions/store-api/deno.json","website/supabase/functions/store-api/import_map.json",
 "website/supabase/migrations/20261107154357_storefront_orders_admin_and_inventory.sql",
 "website/supabase/migrations/20261107155324_store_api_proxy_secret_guard.sql",
 "website/supabase/migrations/20261107160000_drop_duplicate_store_order_indexes.sql"
];
for(const file of required)if(!fs.existsSync(path.join(root,file)))throw new Error("Missing required file: "+file);
const edge=read("website/supabase/functions/store-api/index.ts");
const html=read("website/public/index.html"),adminHtml=read("website/public/admin.html");
const app=read("website/public/app.js"),admin=read("website/public/admin.js");
const migration=read("website/supabase/migrations/20261107154357_storefront_orders_admin_and_inventory.sql");
const credits=read("website/public/credits.html"),robots=read("website/public/robots.txt");
const config=read("website/supabase/config.toml");
const seedBlock=migration.split("ON CONFLICT (id) DO NOTHING;")[0];
const ids=[...seedBlock.matchAll(/\\('([a-z0-9-]+)','/g)].map(m=>m[1]);
if(ids.length!==13||new Set(ids).size!==13)throw new Error("Expected exactly 13 unique seeded products");
if(!edge.includes("STATIC_ASSETS")||!edge.includes("serveStatic"))throw new Error("Static storefront hosting missing");
if(!edge.includes("SUPABASE_SERVICE_ROLE_KEY")||!edge.includes("PUBLIC_API_KEY")||!edge.includes('req.headers.get("apikey")'))throw new Error("Supabase API access guard missing");
if(!edge.includes("PBKDF2")||!edge.includes("310000")||!edge.includes("HMAC")||!edge.includes("isAdmin"))throw new Error("Admin authentication protections missing");
if(!edge.includes("consume_store_rate_limit")||!config.includes("verify_jwt = false"))throw new Error("API rate limiting or custom authentication config missing");
const mapStart=edge.indexOf("const STATIC_ASSETS:Record<string,string>=")+ "const STATIC_ASSETS:Record<string,string>=".length;
const mapEnd=edge.indexOf(";\\nconst STATIC_TYPES",mapStart);
if(mapStart<0||mapEnd<0)throw new Error("Embedded static asset map cannot be parsed");
const embedded=JSON.parse(edge.slice(mapStart,mapEnd));
for(const name of ["index.html","admin.html","credits.html","styles.css","admin.css","app.js","admin.js"]){
 if(embedded[name]!==read("website/public/"+name))throw new Error("Deployed asset is stale: "+name);
}
if(!html.includes("?asset=styles.css")||!html.includes("?asset=app.js")||!adminHtml.includes("?asset=admin.js")||!adminHtml.includes("?asset=admin.css"))throw new Error("Static asset query routing missing");
if(!app.includes("/api/orders")||!app.includes("/api/order-lookup")||!app.includes('unavailable=p.stock!==null'))throw new Error("Customer cart/order or unconfirmed stock behavior missing");
if(!admin.includes("padna-admin-session")||!admin.includes("/api/admin/login"))throw new Error("Admin session flow missing");
if(!html.includes('<html lang="fa" dir="rtl">')||!adminHtml.includes('name="robots" content="noindex,nofollow"'))throw new Error("Persian RTL or admin noindex metadata missing");
if(!migration.includes("ENABLE ROW LEVEL SECURITY")||!migration.includes("confirm_store_order")||!migration.includes("transition_store_order"))throw new Error("Database security or order transaction logic missing");
if(!credits.includes("Pexels License")||!credits.includes("عکس خفر پادنا نیست")||!robots.includes("Disallow: /admin.html"))throw new Error("Photo credits or admin robots exclusion missing");
console.log("PASS: 13 products, bundled assets, Supabase API, admin auth, orders, stock and image disclosure.");
