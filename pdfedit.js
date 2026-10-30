'use strict';
/* ---------- PDF editor: open a PDF, tap any line of text, change it, save a new PDF ----------
   Reading uses the bundled pdf.js. Pages are drawn as pictures; every line of text is found and laid over
   the picture as a tappable box. When a line is changed, the old line is painted out with the page's own
   background colour and the new text is drawn in Public Sans. Saving rebuilds the PDF page by page with
   jsPDF (page picture + edits + an invisible text layer so the file stays searchable). */
(function(){
const PE=window.PE={};
let pj=null,st=null,addMode=false,act=null,io=null,hh=0,ASC=.95,DSC=.25,saveT=0;
const UI='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',RI='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/></svg>',TI='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6V4h14v2M12 4v12M9 16h6M18 17v5M15.5 19.5h5"/></svg>',KEY='pdfdraft',$q=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LIB=async()=>{if(!pj){pj=await import('./pdf.min.mjs');pj.GlobalWorkerOptions.workerSrc='pdf.worker.min.mjs'}return pj};
const metrics=async()=>{try{await document.fonts.load('400 20px "Public Sans"');const c=document.createElement('canvas').getContext('2d');c.font='400 100px "Public Sans"';const m=c.measureText('Hg');if(m.fontBoundingBoxAscent){ASC=m.fontBoundingBoxAscent/100;DSC=m.fontBoundingBoxDescent/100}}catch{}};

/* ---- text encoding for saved PDFs: Public Sans for everything it has, Helvetica for the few Western symbols it lacks ---- */
const ENC=(()=>{const m={};try{const td=new TextDecoder('windows-1252');for(let b=32;b<256;b++){if(b===127||b===129||b===141||b===143||b===144||b===157)continue;m[td.decode(new Uint8Array([b]))]=b}}catch{for(let b=32;b<127;b++)m[String.fromCharCode(b)]=b;for(let b=160;b<256;b++)m[String.fromCharCode(b)]=b}return m})();
const NOPS=new Set([128,130,131,132,134,135,136,137,138,139,140,142,152,153,154,155,156,158,159]);
function toRuns(t,bold){const runs=[],bad=new Set();let shown='';
 for(const ch of String(t)){let b=ENC[ch];if(b===undefined){if(ch!=='\n'&&ch!=='\r')bad.add(ch);b=63;}
  const f=NOPS.has(b)?(bold?'DWF4':'DWF3'):(bold?'DWF2':'DWF1'),c=String.fromCharCode(b);shown+=NOPS.has(b)?ch:c;
  const l=runs[runs.length-1];if(l&&l.f===f)l.t+=c;else runs.push({f,t:c})}
 return{runs,bad,shown}}
let MD=null;
function measurer(){if(MD)return MD;const J=window.jspdf.jsPDF,d=new J({unit:'pt'});
 try{d.addFileToVFS('PublicSans-Regular.ttf',DW_FONT.r);d.addFont('PublicSans-Regular.ttf','PublicSans','normal');d.addFileToVFS('PublicSans-Bold.ttf',DW_FONT.b);d.addFont('PublicSans-Bold.ttf','PublicSans','bold')}catch{}
 return MD=d}
function twidth(t,bold,sz){const d=measurer(),r=toRuns(t,bold);let w=0;
 for(const x of r.runs){const ps=x.f==='DWF1'||x.f==='DWF2';try{d.setFont(ps?'PublicSans':'helvetica',bold?'bold':'normal')}catch{d.setFont('helvetica',bold?'bold':'normal')}d.setFontSize(sz);try{w+=d.getTextWidth(x.t)}catch{}}
 return w}
let FNT=null;
function fontSet(){if(FNT)return FNT;const d=measurer(),b64=s=>{const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u},o={};
 for(const[k,src,bold]of[['DWF1',DW_FONT.r,false],['DWF2',DW_FONT.b,true]]){d.setFont('PublicSans',bold?'bold':'normal');d.setFontSize(1000);const w=[];
  for(let c=32;c<256;c++){const ch=String.fromCharCode(c);let v=0;if(!NOPS.has(c)&&c!==127&&c!==129&&c!==141&&c!==143&&c!==144&&c!==157){try{v=d.getTextWidth(ch)}catch{}}w.push(v)}
  o[k]={ttf:b64(src),widths:w,bold}}
 return FNT=o}
const nsp=s=>String(s).replace(/\s+/g,'');

/* ---- undo / redo ---- */
let hist=[],fut=[],lastSnap='';
const snap=()=>JSON.stringify({e:st.edits,a:st.added});
function histReset(){hist=[];fut=[];lastSnap=st?snap():''}
function commit(){if(!st)return;const s=snap();if(s!==lastSnap){hist.push(lastSnap);if(hist.length>80)hist.shift();fut=[];lastSnap=s}}
function rebuild(){act=null;st.pages.forEach(P=>{if(!P.el||!P.done)return;const box=P.el.querySelector('.pe-ov'),k=P.el.clientWidth/P.w;if(!box)return;box.innerHTML='';(P.blocks||[]).forEach(B=>mkBlock(P,B,box,k));st.added.filter(x=>x.p===P.n).forEach(x=>mkAdded(P,x,box,k))})}
function undoRedo(back){if(!st)return;deactivate();commit();const from=back?hist:fut,to=back?fut:hist;if(!from.length)return;to.push(lastSnap);lastSnap=from.pop();const o=JSON.parse(lastSnap);st.edits=o.e;st.added=o.a;rebuild();setBar();save()}

/* ---- draft kept on this device so a half-edited PDF survives closing the app ---- */
const flush=async()=>{if(!st)return;try{await idbSet('pdfedits',{edits:st.edits,added:st.added,at:Date.now()})}catch{}};
function save(){clearTimeout(saveT);saveT=setTimeout(flush,700)}
addEventListener('pagehide',()=>{clearTimeout(saveT);flush()});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(saveT);flush()}});
PE.draft=async()=>{try{const d=await idbGet(KEY);if(!d)return null;const e=(await idbGet('pdfedits'))||{};d.edits=e.edits||{};d.added=e.added||[];d.at=e.at||d.at;return d}catch{return null}};
PE.discard=async()=>{try{await idbSet(KEY,null);await idbSet('pdfedits',null)}catch{}st=null;act=null};

/* ---- load ---- */
async function open(bytes,name,edits,added){
 const lib=await LIB();await metrics();
 const pdf=await lib.getDocument({data:bytes.slice(0)}).promise;
 const pages=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),v=pg.getViewport({scale:1});pages.push({n:i,pg,w:v.width,h:v.height,blocks:null,el:null,done:false})}
 st={name,bytes,pdf,pages,edits:edits||{},added:added||[],hl:true,flat:false,seq:(added||[]).length+1};histReset();
 if(!edits&&!added){try{await idbSet(KEY,{name,bytes:bytes.buffer.slice(0),at:Date.now()});await idbSet('pdfedits',null)}catch{}}}
PE.load=async file=>{
 if(!file)return;if(!/pdf$/i.test(file.type)&&!/\.pdf$/i.test(file.name)){toast('Please choose a PDF file');return}
 toast('Opening PDF\u2026');
 try{await open(new Uint8Array(await file.arrayBuffer()),file.name);view='pdfed';render()}
 catch(err){console.error(err);toast(String(err&&err.name)==='PasswordException'?'This PDF is password protected':'That PDF could not be opened')}};
PE.resume=async()=>{const d=await PE.draft();if(!d)return;
 try{await open(new Uint8Array(d.bytes),d.name,d.edits||{},d.added||[]);render()}catch{toast('The saved PDF could not be opened');}};

/* ---- text lines: merge pdf.js runs that sit on one baseline into one editable line ---- */
async function extract(P){
 if(P.blocks)return P.blocks;
 const vp=P.pg.getViewport({scale:1}),tc=await P.pg.getTextContent(),runs=[];
 const vt=vp.transform;
 for(const it of tc.items){if(!it.str||!it.str.trim())continue;const t=it.transform;
  /* keep only text that reads left to right and upright on screen (this also works on pages stored rotated) */
  const dx=vt[0]*t[0]+vt[2]*t[1],dy=vt[1]*t[0]+vt[3]*t[1],ux=vt[0]*t[2]+vt[2]*t[3],uy=vt[1]*t[2]+vt[3]*t[3];
  if(!(dx>0)||Math.abs(dy)>Math.abs(dx)*.02||!(uy<0)||Math.abs(ux)>Math.abs(uy)*.02)continue;
  const sz=Math.hypot(t[0],t[1]),p=vp.convertToViewportPoint(t[4],t[5]);if(!(sz>1))continue;
  runs.push({s:it.str,x:p[0],b:p[1],w:it.width*(vp.scale||1),sz,fn:it.fontName})}
 runs.sort((a,c)=>Math.abs(a.b-c.b)>Math.min(a.sz,c.sz)*.3?a.b-c.b:a.x-c.x);
 const lines=[];
 for(const r of runs){const l=lines[lines.length-1];
  if(l&&Math.abs(l.b-r.b)<=Math.min(l.sz,r.sz)*.3&&Math.abs(l.sz-r.sz)/l.sz<.25&&r.x>=l.x-1&&r.x-(l.x+l.w)<l.sz*.9){
   const gap=r.x-(l.x+l.w);l.s+=((gap>l.sz*.12&&!/\s$/.test(l.s)&&!/^\s/.test(r.s))?' ':'')+r.s;l.w=r.x+r.w-l.x}
  else lines.push({s:r.s,x:r.x,b:r.b,w:r.w,sz:r.sz,fn:r.fn})}
 P.blocks=lines.map((l,i)=>({id:'p'+P.n+'b'+i,fn:l.fn,x:l.x,b:l.b,w:l.w,sz:l.sz,s:l.s.replace(/\s+$/,''),bg:'#ffffff',fg:'#000000'}));
 return P.blocks}

/* ---- bold: lines that were bold in the original stay bold when edited ---- */
const isB=(B,E)=>E&&E.b!==undefined?!!E.b:!!(B&&B.bd);
function fontBold(P,bl){try{const seen={};for(const B of bl){if(B.bdSet)continue;let v=seen[B.fn];if(v===undefined){v=false;try{if(P.pg.commonObjs.has(B.fn)){const f=P.pg.commonObjs.get(B.fn);v=/bold|black|heavy|demi/i.test(String((f&&f.name)||''))||!!(f&&f.bold)}}catch{}seen[B.fn]=v}B.bd=v;B.bdSet=1}}catch{}}
/* ---- colours: the page's own background around the text, and the text colour ---- */
function hex(r,g,b){return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}
function sample(img,k,B){try{
 const IW=img.width,x0=Math.max(0,Math.floor((B.x-2)*k)),y0=Math.max(0,Math.floor((B.b-ASC*B.sz)*k)),w=Math.min(IW-x0,Math.ceil((B.w+4)*k)),h=Math.min(img.height-y0,Math.ceil((ASC+DSC)*B.sz*k));
 if(w<2||h<2)return;const D=img.data,cnt={};let best='',bn=0;
 const q=v=>v>>4;const ring=(x,y)=>{const i=((y0+y)*IW+x0+x)*4,key=q(D[i])+','+q(D[i+1])+','+q(D[i+2]),c=cnt[key]=(cnt[key]||{n:0,r:0,g:0,b:0});c.n++;c.r+=D[i];c.g+=D[i+1];c.b+=D[i+2]};
 for(let x=0;x<w;x++){ring(x,0);ring(x,h-1)}for(let y=0;y<h;y++){ring(0,y);ring(w-1,y)}
 for(const key in cnt)if(cnt[key].n>bn){bn=cnt[key].n;best=key}
 const c=cnt[best];const br=Math.round(c.r/c.n),bg=Math.round(c.g/c.n),bb=Math.round(c.b/c.n);B.bg=hex(br,bg,bb);
 let far=0,fr=0,fg=0,fb=0;for(let y=0;y<h;y++){let i=((y0+y)*IW+x0)*4;for(let x=0;x<w;x++,i+=4){const dd=Math.abs(D[i]-br)+Math.abs(D[i+1]-bg)+Math.abs(D[i+2]-bb);if(dd>far){far=dd;fr=D[i];fg=D[i+1];fb=D[i+2]}}}
 B.fg=far>90?hex(fr,fg,fb):((br+bg+bb)/3>128?'#000000':'#ffffff')}catch{}}

/* ---- screen ---- */
const ed=(id)=>st.edits[id]||(st.edits[id]={});
const sizeOf=(B,E)=>(E&&E.fs)||B.sz;
function place(el,k,x,b,sz){el.style.left=(x-1.5)*k+'px';el.style.top=(b-ASC*sz)*k+'px';el.style.fontSize=sz*k+'px';el.style.lineHeight=((ASC+DSC)*sz*k)+'px';el.style.height=((ASC+DSC)*sz*k)+'px'}
function paint(el,B,E){const k=el._k,sz=sizeOf(B,E);place(el,k,B.x,B.b,sz);el.style.minWidth=((B.w+3)*k)+'px';el.style.fontWeight=isB(B,E)?'700':'400';
 const on=E&&E.t!==undefined;el.classList.toggle('ed',!!on);el.style.background=on?B.bg:'';el.style.color=on?B.fg:'transparent'}
function mkBlock(P,B,box,k){
 const el=document.createElement('div');el.className='pe-b';el.dataset.id=B.id;el._k=k;el._B=B;el._add=false;
 const E=st.edits[B.id];el.textContent=E&&E.t!==undefined?E.t:B.s;paint(el,B,E);box.appendChild(el);return el}
function mkAdded(P,A,box,k){
 const el=document.createElement('div');el.className='pe-b add ed';el.dataset.id=A.id;el._k=k;el._add=true;el._A=A;el.textContent=A.t;
 place(el,k,A.x,A.y,A.fs);el.style.fontWeight=A.bd?'700':'400';el.style.color='#000';el.style.minWidth='1.2em';box.appendChild(el);return el}
/* pages are drawn one at a time (nearest to the middle of the screen first) into an off-screen canvas that is swapped in
   when finished, so scrolling never stalls on several renders at once and a page never shows half drawn */
let dq=[],dbusy=false;
function want(P){if(P.q||P.rd)return;P.q=1;dq.push(P);pump()}
function pump(){if(dbusy)return;dq=dq.filter(P=>{const ok=P.vis&&P.el&&P.el.isConnected;if(!ok)P.q=0;return ok});if(!dq.length)return;
 const c=innerHeight/2;let bi=0,bd=1e9;
 dq.forEach((P,i)=>{const r=P.el.getBoundingClientRect(),d=Math.abs((r.top+r.bottom)/2-c);if(d<bd){bd=d;bi=i}});
 const P=dq.splice(bi,1)[0];P.q=0;dbusy=true;
 drawPage(P).catch(()=>{}).finally(()=>{dbusy=false;pump()})}
async function drawPage(P){
 const wrap=P.el,k=wrap.clientWidth/P.w,dpr=Math.min(2,window.devicePixelRatio||1),vs=Math.min(k*dpr,3600/Math.max(P.w,P.h));
 const vp=P.pg.getViewport({scale:vs}),off=document.createElement('canvas');off.className='pe-cv';
 off.width=Math.round(vp.width);off.height=Math.round(vp.height);
 const ctx=off.getContext('2d');
 try{P.task=P.pg.render({canvasContext:ctx,viewport:vp});await P.task.promise}catch{P.task=null;off.width=off.height=0;return}
 P.task=null;
 if(!P.el||!P.el.isConnected||wrap!==P.el){off.width=off.height=0;return}
 if(!P.vis){off.width=off.height=0;return}
 let bl=null,box=null;
 if(!P.done){bl=await extract(P);box=wrap.querySelector('.pe-ov');
  if(!bl.length&&!wrap.querySelector('.pe-note')){const n=document.createElement('div');n.className='pe-note';n.textContent='No editable text found on this page (a scan, a picture or sideways text). Use Add text to write on it.';wrap.appendChild(n)}
  fontBold(P,bl);
  if(bl.length){let img=null;try{img=ctx.getImageData(0,0,off.width,off.height)}catch{}if(img)bl.forEach(B=>sample(img,vp.scale,B))}
  const kk=wrap.clientWidth/P.w;bl.forEach(B=>mkBlock(P,B,box,kk));
  st.added.filter(a=>a.p===P.n).forEach(a=>mkAdded(P,a,box,kk));P.done=true}
 const old=wrap.querySelector('canvas');if(old){old.width=old.height=0;old.replaceWith(off)}else wrap.insertBefore(off,wrap.firstChild);
 P.rd=true;requestAnimationFrame(()=>off.classList.add('rd'))}
function freePage(P){if(P.task){try{P.task.cancel()}catch{}P.task=null}const cv=P.el&&P.el.querySelector('canvas');if(cv){cv.width=0;cv.height=0;cv.classList.remove('rd')}P.rd=false}
function layout(){
 const box=$q('#pepages');if(!box)return;box.innerHTML='';
 const W=Math.min(box.clientWidth||340,900);
 if(io)io.disconnect();dq=[];
 io=new IntersectionObserver(es=>{es.forEach(e=>{const P=st.pages[+e.target.dataset.i];P.vis=e.isIntersecting;
  if(e.isIntersecting)want(P);
  else if(!act||act.parentNode!==e.target.querySelector('.pe-ov'))freePage(P)})},{rootMargin:'600px 0px'});
 st.pages.forEach((P,i)=>{const w=document.createElement('div');w.className='pe-pg';w.dataset.i=i;w.style.width=W+'px';w.style.height=(W*P.h/P.w)+'px';
  w.innerHTML='<div class="pe-ov"></div><span class="pe-n">'+(i+1)+' / '+st.pages.length+'</span>';P.el=w;P.done=false;P.rd=false;P.vis=false;P.q=0;P.task=null;box.appendChild(w);io.observe(w)});
 box.classList.toggle('hl',st.hl)}

function setBar(){const m=$q('#pe'),b=$q('#pebar');if(!m||!b)return;const on=!!act,all=x=>m.querySelectorAll(x);
 b.classList.toggle('fmt',on);
 all('[data-pe=b],[data-pe=up],[data-pe=dn],[data-pe=del]').forEach(x=>x.disabled=!on);
 const E=act&&(act._add?act._A:st.edits[act.dataset.id]);all('[data-pe=b]').forEach(bb=>bb.classList.toggle('on',act?(act._add?!!(E&&E.bd):isB(act._B,E)):false));
 const dirty=!!(act&&snap()!==lastSnap);all('[data-pe=undo]').forEach(un=>un.disabled=!hist.length&&!dirty);all('[data-pe=redo]').forEach(rd=>rd.disabled=!fut.length);
 all('[data-pe=add]').forEach(ad=>ad.classList.toggle('on',addMode));all('[data-pe=hl]').forEach(hl=>hl.classList.toggle('on',st.hl))}
function activate(el){
 if(act&&act!==el)deactivate();act=el;el.classList.add('act');
 const B=el._B;if(!el._add){const E=ed(B.id);if(E.t===undefined)E.t=B.s;paint(el,B,E)}
 el.setAttribute('contenteditable','plaintext-only');if(el.contentEditable!=='plaintext-only')el.setAttribute('contenteditable','true');
 el.focus();setBar()}
function deactivate(){
 if(!act)return;const el=act;act=null;el.classList.remove('act');el.removeAttribute('contenteditable');
 if(el._add){const A=el._A;A.t=el.textContent;if(!A.t.trim()){st.added=st.added.filter(x=>x!==A);el.remove()}else warnChars(A.t)}
 else{const B=el._B,E=st.edits[B.id];if(E){E.t=el.textContent;if(E.t===B.s&&(E.b===undefined||E.b===!!B.bd)&&!E.fs){delete st.edits[B.id]}else warnChars(E.t);paint(el,B,st.edits[B.id])}}
 commit();setBar();save()}
function warnChars(t){const r=toRuns(t,false);if(r.bad.size)toast('These characters cannot be saved in the PDF and will show as ?:  '+[...r.bad].slice(0,6).join(' '))}
function curE(){if(!act)return null;if(act._add)return act._A;return ed(act.dataset.id)}
function tool(k){
 if(k==='add'){addMode=!addMode;if(addMode)deactivate();toast(addMode?'Tap the page where the text should go':'Add text off');setBar();return}
 if(k==='hl'){st.hl=!st.hl;$q('#pepages').classList.toggle('hl',st.hl);setBar();return}
 if(k==='dl'){PE.export();return}
 if(k==='done'){deactivate();return}
 if(k==='undo'){undoRedo(true);return}if(k==='redo'){undoRedo(false);return}
 if(k==='close'){deactivate();st=null;render();return}
 if(!act)return;const E=curE();
 if(k==='b'){const f=act._add?'bd':'b',now=act._add?!!E.bd:isB(act._B,E);E[f]=!now;act.style.fontWeight=E[f]?'700':'400'}
 else if(k==='up'||k==='dn'){const base=act._add?act._A.fs:sizeOf(act._B,E),n=Math.max(4,Math.min(80,Math.round((base+(k==='up'?.5:-.5))*2)/2));
  if(act._add){act._A.fs=n;place(act,act._k,act._A.x,act._A.y,n)}else{E.fs=n;paint(act,act._B,E)}}
 else if(k==='del'){act.textContent='';deactivate();return}
 commit();setBar();save()}

/* ---- picking a place for new text ---- */
function onPageTap(ev){
 if(!addMode)return;const w=ev.target.closest('.pe-pg');if(!w||ev.target.closest('.pe-b'))return;
 const P=st.pages[+w.dataset.i],r=w.getBoundingClientRect(),k=r.width/P.w,x=(ev.clientX-r.left)/k,y=(ev.clientY-r.top)/k;
 const sz=(P.blocks&&P.blocks.length)?[...P.blocks.map(b=>b.sz)].sort((a,b)=>a-b)[Math.floor(P.blocks.length/2)]:11,
  A={id:'a'+(st.seq++),p:P.n,x:x,y:y+sz*.35,fs:Math.round(sz*2)/2,t:'Text',bd:false};
 st.added.push(A);const el=mkAdded(P,A,w.querySelector('.pe-ov'),k);addMode=false;activate(el);
 const s=getSelection(),rg=document.createRange();rg.selectNodeContents(el);s.removeAllRanges();s.addRange(rg);save()}

/* ---- saving the edited PDF ----
   Normal save: the original PDF is kept byte for byte and the edits are appended to it (sharp text, small file, original fonts).
   The result is re-opened and checked; if anything looks wrong, or "remove old text completely" is on, the pages are saved as pictures instead. */
const rgb=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
async function samplePage(P,bl){const vs=Math.min(2.4,3800/Math.max(P.w,P.h)),vp=P.pg.getViewport({scale:vs}),cv=document.createElement('canvas');
 cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const ctx=cv.getContext('2d',{willReadFrequently:true});
 await P.pg.render({canvasContext:ctx,viewport:vp}).promise;fontBold(P,bl);{const img=ctx.getImageData(0,0,cv.width,cv.height);bl.forEach(B=>sample(img,vs,B))}cv.width=cv.height=0}
async function buildVector(prog){
 const lib=await LIB();if(!window.PDFInc)throw new Error('engine missing');
 const edits=[],need=[];
 for(let i=0;i<st.pages.length;i++){
  const P=st.pages[i],bl=await extract(P),ad=st.added.filter(a=>a.p===P.n&&a.t&&a.t.trim()),ch=bl.filter(B=>st.edits[B.id]&&st.edits[B.id].t!==undefined);
  if(!ch.length&&!ad.length)continue;prog('Page '+(i+1)+'/'+st.pages.length);await new Promise(r=>setTimeout(r,10));
  if(!P.done&&ch.length)await samplePage(P,bl);
  const m=P.pg.getViewport({scale:1}).transform,det=m[0]*m[3]-m[1]*m[2];if(!det)throw new Error('matrix');
  const ctm=[m[3]/det,-m[1]/det,-m[2]/det,m[0]/det,(m[2]*m[5]-m[3]*m[4])/det,(m[1]*m[4]-m[0]*m[5])/det],rects=[],texts=[],chk=[];
  for(const B of ch){const E=st.edits[B.id],sz=sizeOf(B,E),bold=isB(B,E),tw=E.t?twidth(E.t,bold,sz):0,ca=Math.max(B.sz,sz);
   rects.push({x:B.x-1.5,y:B.b-ASC*ca,w:Math.max(B.w,tw)+3,h:(ASC+DSC)*ca,c:rgb(B.bg)});
   if(E.t.trim()){const r=toRuns(E.t,bold);texts.push({x:B.x,y:B.b,sz,c:rgb(B.fg),runs:r.runs});chk.push(r.shown)}}
  for(const A of ad){const r=toRuns(A.t,!!A.bd);texts.push({x:A.x,y:A.y,sz:A.fs,c:[0,0,0],runs:r.runs});chk.push(r.shown)}
  edits.push({idx:i,ctm,rects,texts});need.push({n:i+1,chk})}
 if(!edits.length)throw new Error('nothing to save');
 prog('Saving\u2026');
 const out=await PDFInc.apply(st.bytes,edits,fontSet());
 /* check the new file: same pages, and every new line can be read back */
 const doc=await lib.getDocument({data:out.slice(0)}).promise;
 try{if(doc.numPages!==st.pages.length)throw new Error('page count');
  for(const q of need){const pg=await doc.getPage(q.n),tc=await pg.getTextContent(),txt=nsp(tc.items.map(x=>x.str).join(''));
   for(const t of q.chk){if(!txt.includes(nsp(t)))throw new Error('text not found: '+t.slice(0,30))}}}
 finally{try{doc.destroy()}catch{}}
 return out}
async function buildFlat(prog){
 const J=window.jspdf.jsPDF;let doc=null,ps=false;
 for(let i=0;i<st.pages.length;i++){
  prog('Page '+(i+1)+'/'+st.pages.length);await new Promise(r=>setTimeout(r,10));
  const P=st.pages[i],bl=await extract(P),vs=Math.min(2.4,3800/Math.max(P.w,P.h)),vp=P.pg.getViewport({scale:vs}),cv=document.createElement('canvas');
  cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const ctx=cv.getContext('2d',{willReadFrequently:true});
  await P.pg.render({canvasContext:ctx,viewport:vp}).promise;
  if(!P.done&&bl.some(B=>st.edits[B.id])){const img=ctx.getImageData(0,0,cv.width,cv.height);bl.forEach(B=>sample(img,vs,B))}
  const o=P.w>P.h?'l':'p';
  if(!doc){doc=new J({unit:'pt',format:[P.w,P.h],orientation:o,compress:true});
   ps=!!(window.DW_FONT&&(()=>{try{doc.addFileToVFS('PublicSans-Regular.ttf',DW_FONT.r);doc.addFont('PublicSans-Regular.ttf','PublicSans','normal');doc.addFileToVFS('PublicSans-Bold.ttf',DW_FONT.b);doc.addFont('PublicSans-Bold.ttf','PublicSans','bold');return true}catch{return false}})())}
  else doc.addPage([P.w,P.h],o);
  doc.addImage(cv.toDataURL('image/jpeg',.92),'JPEG',0,0,P.w,P.h,undefined,'FAST');cv.width=cv.height=0;
  const font=(b,sz)=>{doc.setFont(ps?'PublicSans':'helvetica',b?'bold':'normal');doc.setFontSize(sz)},hx=rgb;
  const clean=t=>[...String(t)].map(ch=>{const b=ENC[ch];return b===undefined||NOPS.has(b)?'?':ch}).join('');
  for(const B of bl){const E=st.edits[B.id];
   if(E&&E.t!==undefined){const sz=sizeOf(B,E),c=hx(B.bg),f=hx(B.fg),tx=clean(E.t);font(isB(B,E),sz);let tw=0;try{tw=tx?doc.getTextWidth(tx):0}catch{}
    doc.setFillColor(c[0],c[1],c[2]);doc.rect(B.x-1.5,B.b-ASC*Math.max(B.sz,sz),Math.max(B.w,tw)+3,(ASC+DSC)*Math.max(B.sz,sz),'F');
    if(tx){doc.setTextColor(f[0],f[1],f[2]);try{doc.text(tx,B.x,B.b,{baseline:'alphabetic'})}catch{}}}
   else{try{font(false,B.sz);doc.text(B.s,B.x,B.b,{renderingMode:'invisible'})}catch{}}}
  for(const A of st.added.filter(a=>a.p===P.n)){if(!A.t)continue;font(A.bd,A.fs);doc.setTextColor(0,0,0);try{doc.text(clean(A.t),A.x,A.y,{baseline:'alphabetic'})}catch{}}}
 return doc.output('blob')}
async function deliver(blob,name,note){
 const f=new File([blob],name,{type:'application/pdf'});
 if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:name});return}catch(err){if(err.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Saved '+name+(note||''))}
function showDone(name,fn){const o=$q('#pedone');if(o)o.remove();
 const d=document.createElement('div');d.id='pedone';d.className='pe-done';d.setAttribute('role','status');
 d.innerHTML='<div class="pdt"><b>PDF saved</b><small>'+esc(name)+'</small></div><button type="button" class="btn" data-pd="more">Keep editing</button><button type="button" class="btn p" data-pd="home">Done</button>';
 d._go=fn||(()=>PE.discard().then(()=>dwGo('home')));document.body.appendChild(d)}
PE.showDone=showDone;
PE.export=async()=>{
 if(!st||PE.busy)return;deactivate();PE.busy=true;const btn=$q('[data-pe=dl]'),lab=btn&&btn.innerHTML;if(btn)btn.disabled=true;
 const prog=n=>{if(btn&&btn.querySelector('span'))btn.querySelector('span').textContent=n};
 const name=st.name.replace(/\.pdf$/i,'')+'-edited.pdf';
 try{
  let blob=null,note='';
  if(!st.flat){try{blob=new Blob([await buildVector(prog)],{type:'application/pdf'})}catch(err){console.warn('in-place save not used:',err);blob=null;note=' (as pictures)'}}
  if(!blob)blob=await buildFlat(prog);
  await deliver(blob,name,note);showDone(name);
 }catch(err){console.error(err);toast('Could not save the PDF')}
 finally{PE.busy=false;if(btn){btn.disabled=false;btn.innerHTML=lab}}};

/* ---- the view ---- */
PE.mount=async()=>{
 const m=$q('#pe');if(!m)return;
 if(!st){const d=await PE.draft();
  m.innerHTML=`<div class="pane pe-pick"><div class="ch"><span class="ci2">${CI.up}</span><div><h3>Edit a PDF</h3><small>Change the text in any PDF</small></div></div>
<label class="btn p wide pe-up">${CI.up}<span>Choose a PDF</span><input type="file" accept="application/pdf,.pdf" hidden id="pef"></label>
${d?`<div class="bkc"><div><b>${esc(d.name)}</b><small>Unfinished edits saved ${esc(new Date(d.at).toLocaleString())}</small></div><button class="btn" id="per" type="button">Continue</button></div><button class="btn wide" id="ped" type="button">Discard saved PDF</button>`:''}
<ul class="pe-tips"><li>Tap any line of text to change it. Use <b>B</b> and <b>A\u2212 A+</b> to adjust it.</li><li><b>Add text</b> places new text anywhere, handy for blank form fields.</li><li>Edits are saved on this device as you go. Tap <b>Save PDF</b> when you are done: your original PDF is kept sharp and only your changes are added.</li><li>Made a mistake? Use the undo and redo arrows.</li><li>Scanned pages are pictures with no text to edit. New text uses the Public Sans font, and pages are saved as sharp images.</li></ul></div>`;return}
 m.innerHTML=`<p class="pe-name"><span>${esc(st.name)} \u00b7 ${st.pages.length} page${st.pages.length==1?'':'s'}</span><button data-pe="hl" class="lgbtn on" type="button" aria-label="Highlight editable text">Highlight</button><button data-pe="close" class="lgbtn" type="button">Close</button></p><label class="pe-opt"><input type="checkbox" id="peflat"${st.flat?' checked':''}><span><b>Remove old text completely</b><small>Saves every page as a picture. Use this only if the old wording must not be recoverable.</small></span></label><div id="pepages" class="pe-pages"></div>
<div class="pe-dock" id="pebar" role="toolbar" aria-label="PDF tools">
<div class="pd-g pd-idle"><button data-pe="undo" class="pe-t" aria-label="Undo" disabled>${UI}</button><button data-pe="redo" class="pe-t" aria-label="Redo" disabled>${RI}</button><i class="sep"></i><button data-pe="add" class="pe-t" aria-label="Add text">${TI}<span>Add text</span></button><button data-pe="dl" class="pe-t p" aria-label="Save PDF">${CI.down}<span>Save</span></button></div>
<div class="pd-g pd-fmt"><button data-pe="b" class="pe-t" aria-label="Bold" disabled><b>B</b></button><button data-pe="dn" class="pe-t" aria-label="Smaller text" disabled>A\u2212</button><button data-pe="up" class="pe-t" aria-label="Larger text" disabled>A+</button><button data-pe="del" class="pe-t" aria-label="Delete text" disabled>${CI.trash}</button><i class="sep"></i><button data-pe="undo" class="pe-t" aria-label="Undo" disabled>${UI}</button><button data-pe="done" class="pe-t p" aria-label="Done"><span>Done</span></button></div></div>`;
 layout();setBar();dockPos()};

/* the dock rides above the on-screen keyboard (iPhone keeps fixed bars behind it) */
let kbOn=false;const b0=()=>kbOn;
function dockPos(){const b=$q('#pebar');if(!b)return;const v=window.visualViewport;let kb=0;if(v)kb=Math.max(0,Math.round(innerHeight-v.height-v.offsetTop));kbOn=kb>0;b.style.setProperty('--kb',kb+'px')}
if(window.visualViewport){let t=0;const f=()=>{t=0;dockPos()},s2=()=>{if(!t)t=requestAnimationFrame(f)};visualViewport.addEventListener('resize',s2);visualViewport.addEventListener('scroll',()=>{if(visualViewport.offsetTop>=2||b0())s2()})}

/* ---- the top bar stays pinned at the top while the document scrolls beneath it (v69) ---- */
(function(){const t=$q('.top');if(t)t.classList.remove('hide')})();

document.addEventListener('pointerdown',ev=>{if(ev.target.closest&&ev.target.closest('#pebar button'))ev.preventDefault()});
document.addEventListener('click',ev=>{
 const pd=ev.target.closest&&ev.target.closest('#pedone [data-pd]');
 if(pd){const o=$q('#pedone');if(pd.dataset.pd==='more'){if(o)o.remove();return}
  if(o){const g=o._go;o.remove();g()}return}
 if(view!=='pdfed')return;
 const t=ev.target.closest('[data-pe]');if(t&&st){tool(t.dataset.pe);return}
 if(ev.target.closest('#per')){PE.resume();return}
 if(ev.target.closest('#ped')){if(confirm('Discard the saved PDF and its edits?'))PE.discard().then(()=>render());return}
 if(!st)return;
 if(addMode){onPageTap(ev);return}
 const b=ev.target.closest('.pe-b');if(b){if(b!==act)activate(b);return}
 if(act&&!ev.target.closest('#pebar'))deactivate()});
document.addEventListener('change',ev=>{if(ev.target.id==='peflat'&&st){st.flat=ev.target.checked;return}if(ev.target.id==='pef'&&ev.target.files[0]){PE.load(ev.target.files[0]);ev.target.value=''}});
document.addEventListener('input',ev=>{if(act&&ev.target===act){if(act._add)act._A.t=act.textContent;else{const E=ed(act.dataset.id);E.t=act.textContent}save()}});
document.addEventListener('keydown',ev=>{if(act&&ev.target===act&&ev.key==='Enter'){ev.preventDefault();deactivate()}});
document.addEventListener('paste',ev=>{if(act&&ev.target===act){ev.preventDefault();const t=(ev.clipboardData||window.clipboardData).getData('text').replace(/\s+/g,' ');document.execCommand('insertText',false,t)}});
PE.leave=()=>{{const o=$q('#pedone');if(o)o.remove()}if(act)deactivate();addMode=false;dq=[];if(io){io.disconnect();io=null}if(st)st.pages.forEach(P=>{if(P.task){try{P.task.cancel()}catch{}P.task=null}P.vis=false})};
})();
