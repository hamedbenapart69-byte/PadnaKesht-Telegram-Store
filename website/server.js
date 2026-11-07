import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),"public");
const PORT=Number(process.env.PORT||3000);
const MIME={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".txt":"text/plain; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon"};
const SECRET=process.env.STORE_PROXY_SECRET||"";
const SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const SUPABASE_ANON_KEY=process.env.SUPABASE_ANON_KEY||"";
const security={
 "X-Content-Type-Options":"nosniff","X-Frame-Options":"DENY",
 "Referrer-Policy":"strict-origin-when-cross-origin",
 "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
 "Content-Security-Policy":"default-src 'self'; img-src 'self' data: https://images.pexels.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
};
const json=(res,data,status=200,headers={})=>{res.writeHead(status,{...security,"content-type":"application/json; charset=utf-8","cache-control":"no-store",...headers});res.end(JSON.stringify(data));};
const cookie=(header,name)=>{const part=(header||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));if(!part)return "";try{return decodeURIComponent(part.slice(name.length+1));}catch{return "";}};
async function api(req,res,url){
 if(["POST","PUT","PATCH","DELETE"].includes(req.method)){
  const origin=req.headers.origin;
  if(origin&&origin!==`https://${req.headers.host}`&&origin!==`http://${req.headers.host}`)return json(res,{error:"درخواست نامعتبر است."},403);
 }
 if(!SECRET||!SUPABASE_URL||!SUPABASE_ANON_KEY)return json(res,{error:"تنظیمات امن سرویس کامل نشده است."},503);
 let body={};
 if(!["GET","HEAD"].includes(req.method)){
  let raw="";for await(const chunk of req){raw+=chunk;if(raw.length>65536)return json(res,{error:"حجم درخواست بیش از حد مجاز است."},413);}
  try{body=JSON.parse(raw||"{}");}catch{return json(res,{error:"اطلاعات ارسالی معتبر نیست."},400);}
 }
 const headers={"content-type":"application/json","apikey":SUPABASE_ANON_KEY,"x-admin-session":cookie(req.headers.cookie,"pk_admin"),"x-store-proxy-secret":SECRET,"x-client-ip":String(req.headers["x-forwarded-for"]||req.socket.remoteAddress||"unknown").split(",")[0].trim()};
 let upstream;
 try{upstream=await fetch(SUPABASE_URL+"/functions/v1/store-api",{method:"POST",headers,body:JSON.stringify({path:url.pathname,method:req.method,body}),redirect:"manual",cache:"no-store"});}
 catch{return json(res,{error:"ارتباط با سرویس ثبت سفارش برقرار نشد."},502);}
 let data={};try{data=await upstream.json();}catch{return json(res,{error:"پاسخ سرویس سفارش معتبر نیست."},502);}
 const extra={};
 if(url.pathname==="/api/admin/login"&&upstream.ok&&data.token){extra["Set-Cookie"]="pk_admin="+encodeURIComponent(data.token)+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800";delete data.token;}
 if(url.pathname==="/api/admin/logout")extra["Set-Cookie"]="pk_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
 return json(res,data,upstream.status,extra);
}
async function staticFile(req,res,url){
 if(!["GET","HEAD"].includes(req.method)){res.writeHead(405,security);return res.end("Method Not Allowed");}
 let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{return json(res,{error:"مسیر نامعتبر است."},400);}
 if(pathname==="/")pathname="/index.html";
 const target=path.resolve(ROOT,"."+pathname);
 if(!target.startsWith(ROOT+path.sep)&&target!==ROOT)return json(res,{error:"Not found"},404);
 try{
  const stat=await fs.stat(target);if(!stat.isFile())throw new Error("not file");
  const data=await fs.readFile(target);
  res.writeHead(200,{...security,"content-type":MIME[path.extname(target).toLowerCase()]||"application/octet-stream","content-length":data.length,"cache-control":path.extname(target)===".html"?"no-cache":"public, max-age=3600"});
  res.end(req.method==="HEAD"?undefined:data);
 }catch{res.writeHead(404,{...security,"content-type":"text/plain; charset=utf-8"});res.end("Not found");}
}
http.createServer(async(req,res)=>{
 const url=new URL(req.url||"/","http://localhost");
 try{if(url.pathname.startsWith("/api/"))await api(req,res,url);else await staticFile(req,res,url);}
 catch{json(res,{error:"خطای داخلی رخ داد. کمی بعد دوباره تلاش کنید."},500);}
}).listen(PORT,"0.0.0.0",()=>console.log("Padnakasht store listening on "+PORT));
