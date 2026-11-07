const json = (data,status=200,extra={}) => new Response(JSON.stringify(data),{
  status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}
});
function parseCookie(header,name){
  const part=(header||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="));
  return part?decodeURIComponent(part.slice(name.length+1)):"";
}
function sameOrigin(request){
  const origin=request.headers.get("origin");
  return !origin||origin===new URL(request.url).origin;
}
function securityHeaders(headers={}){
  return {
    "X-Content-Type-Options":"nosniff",
    "X-Frame-Options":"DENY",
    "Referrer-Policy":"strict-origin-when-cross-origin",
    "Permissions-Policy":"camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy":"default-src 'self'; img-src 'self' data: https://images.pexels.com; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...headers
  };
}
async function apiProxy(request,env){
  const url=new URL(request.url),path=url.pathname,method=request.method;
  if(["POST","PUT","PATCH","DELETE"].includes(method)&&!sameOrigin(request))return json({error:"درخواست نامعتبر است."},403);
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.STORE_PROXY_SECRET)return json({error:"تنظیمات امن اتصال پایگاه داده کامل نشده است."},503);
  let body={};
  if(!["GET","HEAD"].includes(method)){
    try{body=await request.json();}catch{return json({error:"اطلاعات ارسالی معتبر نیست."},400);}
  }
  const adminToken=parseCookie(request.headers.get("cookie"),"pk_admin");
  const headers={
    "content-type":"application/json",
    "apikey":env.SUPABASE_ANON_KEY,
    "x-admin-session":adminToken,
    "x-store-proxy-secret":env.STORE_PROXY_SECRET,
    "x-client-ip":request.headers.get("CF-Connecting-IP")||"unknown"
  };
  let upstream;
  try{
    upstream=await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/store-api",{
      method:"POST",headers,body:JSON.stringify({path,method,body}),redirect:"manual",cache:"no-store"
    });
  }catch{
    return json({error:"ارتباط با سرویس ثبت سفارش برقرار نشد."},502);
  }
  let data={};
  try{data=await upstream.json();}catch{return json({error:"پاسخ سرویس سفارش معتبر نیست."},502);}
  const responseHeaders={};
  if(path==="/api/admin/login"&&upstream.ok&&data.token){
    responseHeaders["Set-Cookie"]="pk_admin="+encodeURIComponent(data.token)+"; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800";
    delete data.token;
  }
  if(path==="/api/admin/logout"){
    responseHeaders["Set-Cookie"]="pk_admin=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
  }
  return json(data,upstream.status,responseHeaders);
}
async function keepDatabaseAwake(env){
  if(!env.SUPABASE_URL||!env.SUPABASE_ANON_KEY||!env.STORE_PROXY_SECRET)return;
  try{
    await fetch(env.SUPABASE_URL.replace(/\/$/,"")+"/functions/v1/store-api",{
      method:"POST",
      headers:{"content-type":"application/json","apikey":env.SUPABASE_ANON_KEY,"x-store-proxy-secret":env.STORE_PROXY_SECRET},
      body:JSON.stringify({path:"/api/health",method:"GET",body:{}}),
      cache:"no-store"
    });
  }catch{}
}
export default {
  async fetch(request,env){
    const headers=securityHeaders();
    try{
      const url=new URL(request.url);
      if(url.pathname.startsWith("/api/")){
        const response=await apiProxy(request,env);
        const merged=new Headers(response.headers);
        for(const [key,value] of Object.entries(headers))merged.set(key,value);
        return new Response(response.body,{status:response.status,headers:merged});
      }
      if(request.method!=="GET"&&request.method!=="HEAD")return new Response("Method Not Allowed",{status:405,headers});
      const asset=await env.ASSETS.fetch(request);
      const merged=new Headers(asset.headers);
      for(const [key,value] of Object.entries(headers))merged.set(key,value);
      return new Response(asset.body,{status:asset.status,headers:merged});
    }catch{
      return json({error:"خطای داخلی رخ داد. کمی بعد دوباره تلاش کنید."},500,headers);
    }
  },
  async scheduled(controller,env,ctx){
    ctx.waitUntil(keepDatabaseAwake(env));
  }
};
