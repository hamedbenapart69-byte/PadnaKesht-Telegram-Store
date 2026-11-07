import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "website/wrangler.toml",
  "website/src/index.js",
  "website/public/index.html",
  "website/public/admin.html",
  "website/public/app.js",
  "website/public/admin.js",
  "website/public/styles.css",
  "website/public/admin.css",
  "website/public/credits.html",
  "website/public/robots.txt",
  "website/supabase/config.toml",
  "website/supabase/functions/store-api/index.ts",
  "website/supabase/functions/store-api/deno.json",
  "website/supabase/migrations/20261107154357_storefront_orders_admin_and_inventory.sql"
];
for (const file of required) {
  if (!fs.existsSync(path.join(root,file))) throw new Error("Missing required file: "+file);
}
const read = file => fs.readFileSync(path.join(root,file),"utf8");
const wrangler=read("website/wrangler.toml");
const worker=read("website/src/index.js");
const html=read("website/public/index.html");
const adminHtml=read("website/public/admin.html");
const app=read("website/public/app.js");
const admin=read("website/public/admin.js");
const css=read("website/public/styles.css");
const edge=read("website/supabase/functions/store-api/index.ts");
const migration=read("website/supabase/migrations/20261107154357_storefront_orders_admin_and_inventory.sql");
const credits=read("website/public/credits.html");
const robots=read("website/public/robots.txt");

const productIds=[...migration.matchAll(/\('([a-z0-9-]+)','/g)].map(m=>m[1]);
if(productIds.length!==13)throw new Error("Expected 13 seeded products, found "+productIds.length);
if(new Set(productIds).size!==productIds.length)throw new Error("Duplicate product IDs in migration");
if(!wrangler.includes('name = "padnakasht-store"'))throw new Error("Worker name mismatch");
if(!wrangler.includes('crons = ["0 */8 * * *"]'))throw new Error("Supabase keepalive cron missing");
if(!wrangler.includes("sb_publishable_"))throw new Error("Public Supabase publishable key missing");
if(wrangler.includes("service_role")||wrangler.includes("D1")||wrangler.includes("d1_databases"))throw new Error("Private key or unused D1 configuration found");
if(!edge.includes("SUPABASE_SERVICE_ROLE_KEY")||!edge.includes("verify"))throw new Error("Edge Function service-role access missing");
if(!read("website/supabase/config.toml").includes("verify_jwt = false"))throw new Error("Edge Function custom-auth config missing");
if(!html.includes("/app.js")||!html.includes("/styles.css")||!html.includes("تصویر نمایشی"))throw new Error("Storefront scripts/styles/photo disclosure missing");
if(!adminHtml.includes('id="setup-form"')||!adminHtml.includes('name="setupToken"')||!adminHtml.includes('name="passwordConfirm"'))throw new Error("One-time admin setup flow missing");
if(!adminHtml.includes('name="robots" content="noindex,nofollow"'))throw new Error("Admin noindex metadata missing");
if(!app.includes("/api/orders")||!app.includes("/api/order-lookup")||!app.includes("image-note"))throw new Error("Cart, order or photo disclosure flow missing");
if(!edge.includes("confirm_store_order")||!edge.includes("transition_store_order")||!edge.includes("consume_store_rate_limit"))throw new Error("Order confirmation, stock or rate-limit RPC missing");
if(!migration.includes("ENABLE ROW LEVEL SECURITY")||!migration.includes("REVOKE ALL ON FUNCTION"))throw new Error("Database access controls missing");
if(!css.includes("[hidden]{display:none!important}")||!css.includes(".no-scroll"))throw new Error("Modal visibility or scroll styles missing");
if(!credits.includes("Pexels License")||!credits.includes("عکس اختصاصی خفر نیست"))throw new Error("Photo credits/transparency missing");
if(!robots.includes("Disallow: /admin.html"))throw new Error("Admin page robots exclusion missing");
if(/on(click|load|error)=/i.test(html+adminHtml))throw new Error("Inline event handlers are not allowed");
if(/ADMIN_PASSWORD\s*=\s*["']/.test(edge+worker+wrangler))throw new Error("Hard-coded admin password found");

console.log("Storefront checks passed: "+productIds.length+" products, Cloudflare config, Supabase API, admin setup, order workflow, image disclosure.");
