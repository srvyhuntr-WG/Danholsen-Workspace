// Danholsen Workspace service worker
// Network-first: online users always get the newest files; the last copy seen online is used offline.
// Nothing in this file needs a version number. The app fingerprints its own files and refreshes
// itself when they change (see app.js), and the cache below is rebuilt from index.html on install.
const C='dw-app';
const EXTRA=['./','index.html','manifest.webmanifest','pdf.min.mjs','pdf.worker.min.mjs','danholsen-full.png','app.js','pdfedit.js'];
async function precache(){
  const c=await caches.open(C);
  const grab=u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{});
  const urls=new Set(EXTRA);
  try{
    const html=await (await fetch('index.html',{cache:'reload'})).text();
    for(const m of html.matchAll(/(?:href|src)="([^"#?]+)"/g))if(!/^(https?:|data:|\/\/)/.test(m[1]))urls.add(m[1]);
    const css=await (await fetch('fonts.css',{cache:'reload'})).text();
    for(const m of css.matchAll(/url\(([^)]+)\)/g))urls.add(m[1].replace(/['"]/g,''));
  }catch(_){}
  await Promise.all([...urls].map(grab));
}
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(precache())});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||!r.url.startsWith('http'))return;
  if(new URL(r.url).pathname.endsWith('/version.json'))return;
  e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{
    if(res.ok&&new URL(r.url).origin===location.origin){const copy=res.clone();caches.open(C).then(c=>c.put(r,copy))}
    return res;
  }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html'))));
});
