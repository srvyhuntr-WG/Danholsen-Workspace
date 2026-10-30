/* Danholsen Workspace storage.
   Documents, logos and signatures live in IndexedDB, so they are no longer limited to the ~5 MB of localStorage.
   Small settings stay in localStorage. Existing data is moved across automatically on first run. */
(function(){
var BIG={'dw.docs':1,'dw.lib':1,'dw.sigs':1,'dw.logos':1},P='ls:',mem={},db=null,ok=false;
function open(){return new Promise(function(res,rej){
  var q;try{q=indexedDB.open('dw-bk',1)}catch(e){rej(e);return}
  q.onupgradeneeded=function(){if(!q.result.objectStoreNames.contains('k'))q.result.createObjectStore('k')};
  q.onsuccess=function(){db=q.result;db.onversionchange=function(){try{db.close()}catch(e){}db=null};res(db)};
  q.onerror=function(){rej(q.error)};q.onblocked=function(){rej(new Error('blocked'))}})}
function getDb(){return db?Promise.resolve(db):open()}
function put(k,v){return getDb().then(function(d){return new Promise(function(res,rej){
  var t=d.transaction('k','readwrite');t.objectStore('k').put(v,P+k);
  t.oncomplete=function(){res()};t.onerror=t.onabort=function(){rej(t.error||new Error('write failed'))}})})}
function readAll(){return getDb().then(function(d){return new Promise(function(res,rej){
  var r=d.transaction('k').objectStore('k').openCursor(IDBKeyRange.bound(P,P+'\uffff'));
  r.onsuccess=function(){var c=r.result;if(c){mem[String(c.key).slice(P.length)]=c.value;c.continue()}else res()};
  r.onerror=function(){rej(r.error)}})})}
function hydrate(){
  return readAll().catch(function(){return new Promise(function(r){setTimeout(r,800)}).then(readAll)}).then(function(){
    ok=true;var jobs=[];
    Object.keys(BIG).forEach(function(k){
      var s=null;try{s=localStorage.getItem(k)}catch(e){}
      if(mem[k]==null){
        if(s!=null){mem[k]=s;jobs.push(put(k,s).then(function(){try{localStorage.removeItem(k)}catch(e){}}).catch(function(){}))}
      }else if(s!=null){try{localStorage.removeItem(k)}catch(e){}}
    });
    return Promise.all(jobs)}).catch(function(){ok=false});
}
var S=window.DWSTORE={
  get:function(k){if(ok&&BIG[k])return mem[k]==null?null:mem[k];return localStorage.getItem(k)},
  set:function(k,s){
    if(ok&&BIG[k]){mem[k]=s;put(k,s).catch(function(){if(window.toast)toast('Could not save - your device storage is full')});return}
    localStorage.setItem(k,s)},
  bytes:function(){var n=0;Object.keys(mem).forEach(function(k){n+=(k.length+String(mem[k]).length)*2});return n},
  quota:function(){return navigator.storage&&navigator.storage.estimate?navigator.storage.estimate().then(function(e){return e&&e.quota?e.quota:null}).catch(function(){return null}):Promise.resolve(null)},
  wipe:function(){mem={}},
  /* Saved PDF copies: ArrayBuffers under 'pdf:<id>' in the same database (never mixed with the 'ls:' keys). */
  pdf:{
    put:function(id,buf){return getDb().then(function(d){return new Promise(function(res,rej){var t=d.transaction('k','readwrite');t.objectStore('k').put(buf,'pdf:'+id);t.oncomplete=function(){res()};t.onerror=t.onabort=function(){rej(t.error||new Error('write failed'))}})})},
    get:function(id){return getDb().then(function(d){return new Promise(function(res,rej){var r=d.transaction('k').objectStore('k').get('pdf:'+id);r.onsuccess=function(){res(r.result||null)};r.onerror=function(){rej(r.error)}})}).catch(function(){return null})},
    del:function(id){return getDb().then(function(d){return new Promise(function(res){var t=d.transaction('k','readwrite');t.objectStore('k').delete('pdf:'+id);t.oncomplete=t.onerror=t.onabort=function(){res()}})}).catch(function(){})}
  },
  ready:null
};
S.ready=hydrate();
})();
