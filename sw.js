// Danholsen Workspace service worker
// Network-first: online users always get the newest files; the cached copy is used offline.
// BUILD is checked against version.json by the app, which then refreshes itself automatically.
const BUILD='44';
const C='wg-'+BUILD;
const PRE=['./', 'app.css', 'app.js', 'apple-touch-icon-precomposed.png', 'apple-touch-icon-v5.png', 'apple-touch-icon.png', 'barlow-condensed-latin-500-normal.woff2', 'barlow-condensed-latin-600-normal.woff2', 'barlow-condensed-latin-700-normal.woff2', 'danholsen-full.png', 'elegant.css', 'favicon-32-v5.png', 'favicon-32.png', 'favicon-v5.ico', 'favicon-v5.svg', 'favicon.ico', 'favicon.svg', 'fonts.css', 'icon-128-v5.png', 'icon-144-v5.png', 'icon-152-v5.png', 'icon-167-v5.png', 'icon-192-v5.png', 'icon-192.png', 'icon-256-v5.png', 'icon-384-v5.png', 'icon-48-v5.png', 'icon-512-v5.png', 'icon-512.png', 'icon-72-v5.png', 'icon-96-v5.png', 'icon-maskable-192-v5.png', 'icon-maskable-512-v5.png', 'icon-maskable-512.png', 'index.html', 'inter-latin-400-normal.woff2', 'inter-latin-500-normal.woff2', 'inter-latin-600-normal.woff2', 'inter-latin-700-normal.woff2', 'jspdf.umd.min.js', 'lato-latin-400-normal.woff2', 'lato-latin-700-normal.woff2', 'logo.js', 'mix.css', 'mobile.css', 'manifest.webmanifest', 'pdf.js', 'pdf.min.mjs', 'pdf.worker.min.mjs', 'premium.css', 'public-sans-latin-400-normal.woff', 'public-sans-latin-500-normal.woff', 'public-sans-latin-600-normal.woff', 'public-sans-latin-700-normal.woff', 'publicsans-pdf.js', 'workspace.css'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>Promise.all(PRE.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='skip')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||!e.request.url.startsWith('http'))return;
  e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{
    if(r.ok&&new URL(e.request.url).origin===location.origin){const c=r.clone();caches.open(C).then(x=>x.put(e.request,c))}
    return r;
  }).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))));
});
