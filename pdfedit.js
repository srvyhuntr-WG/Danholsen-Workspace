'use strict';
/* ---------- PDF editor: open a PDF, tap any line of text, change it, save a new PDF ----------
   Reading uses the bundled pdf.js. Pages are drawn as pictures; every line of text is found and laid over
   the picture as a tappable box. When a line is changed, the old line is painted out with the page's own
   background colour and the new text is drawn in Public Sans. Saving rebuilds the PDF page by page with
   jsPDF (page picture + edits + an invisible text layer so the file stays searchable). */
(function(){
const PE=window.PE={};
let pj=null,st=null,addMode=false,act=null,io=null,hh=0,ASC=.95,DSC=.25,saveT=0;
const TI='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6V4h14v2M12 4v12M9 16h6M18 17v5M15.5 19.5h5"/></svg>',KEY='pdfdraft',$q=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LIB=async()=>{if(!pj){pj=await import('./pdf.min.mjs');pj.GlobalWorkerOptions.workerSrc='pdf.worker.min.mjs'}return pj};
const metrics=async()=>{try{await document.fonts.load('400 20px "Public Sans"');const c=document.createElement('canvas').getContext('2d');c.font='400 100px "Public Sans"';const m=c.measureText('Hg');if(m.fontBoundingBoxAscent){ASC=m.fontBoundingBoxAscent/100;DSC=m.fontBoundingBoxDescent/100}}catch{}};

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
 st={name,bytes,pdf,pages,edits:edits||{},added:added||[],hl:true,seq:(added||[]).length+1};
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
 for(const it of tc.items){if(!it.str||!it.str.trim())continue;const t=it.transform;if(Math.abs(t[1])>.01||Math.abs(t[2])>.01)continue;
  const sz=Math.hypot(t[0],t[1]),p=vp.convertToViewportPoint(t[4],t[5]);if(!(sz>1))continue;
  runs.push({s:it.str,x:p[0],b:p[1],w:it.width*(vp.scale||1),sz})}
 runs.sort((a,c)=>Math.abs(a.b-c.b)>Math.min(a.sz,c.sz)*.3?a.b-c.b:a.x-c.x);
 const lines=[];
 for(const r of runs){const l=lines[lines.length-1];
  if(l&&Math.abs(l.b-r.b)<=Math.min(l.sz,r.sz)*.3&&Math.abs(l.sz-r.sz)/l.sz<.25&&r.x>=l.x-1&&r.x-(l.x+l.w)<l.sz*.9){
   const gap=r.x-(l.x+l.w);l.s+=((gap>l.sz*.12&&!/\s$/.test(l.s)&&!/^\s/.test(r.s))?' ':'')+r.s;l.w=r.x+r.w-l.x}
  else lines.push({s:r.s,x:r.x,b:r.b,w:r.w,sz:r.sz})}
 P.blocks=lines.map((l,i)=>({id:'p'+P.n+'b'+i,x:l.x,b:l.b,w:l.w,sz:l.sz,s:l.s.replace(/\s+$/,''),bg:'#ffffff',fg:'#000000'}));
 return P.blocks}

/* ---- colours: the page's own background around the text, and the text colour ---- */
function hex(r,g,b){return'#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}
function sample(ctx,k,B){try{
 const x0=Math.max(0,Math.floor((B.x-2)*k)),y0=Math.max(0,Math.floor((B.b-ASC*B.sz)*k)),w=Math.min(ctx.canvas.width-x0,Math.ceil((B.w+4)*k)),h=Math.min(ctx.canvas.height-y0,Math.ceil((ASC+DSC)*B.sz*k));
 if(w<2||h<2)return;const d=ctx.getImageData(x0,y0,w,h).data,cnt={};let best='',bn=0;
 const q=v=>v>>4;const ring=(x,y)=>{const i=(y*w+x)*4,key=q(d[i])+','+q(d[i+1])+','+q(d[i+2]),c=cnt[key]=(cnt[key]||{n:0,r:0,g:0,b:0});c.n++;c.r+=d[i];c.g+=d[i+1];c.b+=d[i+2]};
 for(let x=0;x<w;x++){ring(x,0);ring(x,h-1)}for(let y=0;y<h;y++){ring(0,y);ring(w-1,y)}
 for(const key in cnt)if(cnt[key].n>bn){bn=cnt[key].n;best=key}
 const c=cnt[best];const br=Math.round(c.r/c.n),bg=Math.round(c.g/c.n),bb=Math.round(c.b/c.n);B.bg=hex(br,bg,bb);
 let far=0,fr=0,fg=0,fb=0;for(let i=0;i<d.length;i+=4){const dd=Math.abs(d[i]-br)+Math.abs(d[i+1]-bg)+Math.abs(d[i+2]-bb);if(dd>far){far=dd;fr=d[i];fg=d[i+1];fb=d[i+2]}}
 B.fg=far>90?hex(fr,fg,fb):((br+bg+bb)/3>128?'#000000':'#ffffff')}catch{}}

/* ---- screen ---- */
const ed=(id)=>st.edits[id]||(st.edits[id]={});
const sizeOf=(B,E)=>(E&&E.fs)||B.sz;
function place(el,k,x,b,sz){el.style.left=(x-1.5)*k+'px';el.style.top=(b-ASC*sz)*k+'px';el.style.fontSize=sz*k+'px';el.style.lineHeight=((ASC+DSC)*sz*k)+'px';el.style.height=((ASC+DSC)*sz*k)+'px'}
function paint(el,B,E){const k=el._k,sz=sizeOf(B,E);place(el,k,B.x,B.b,sz);el.style.minWidth=((B.w+3)*k)+'px';el.style.fontWeight=E&&E.b?'700':'400';
 const on=E&&E.t!==undefined;el.classList.toggle('ed',!!on);el.style.background=on?B.bg:'';el.style.color=on?B.fg:'transparent'}
function mkBlock(P,B,box,k){
 const el=document.createElement('div');el.className='pe-b';el.dataset.id=B.id;el._k=k;el._B=B;el._add=false;
 const E=st.edits[B.id];el.textContent=E&&E.t!==undefined?E.t:B.s;paint(el,B,E);box.appendChild(el);return el}
function mkAdded(P,A,box,k){
 const el=document.createElement('div');el.className='pe-b add ed';el.dataset.id=A.id;el._k=k;el._add=true;el._A=A;el.textContent=A.t;
 place(el,k,A.x,A.y,A.fs);el.style.fontWeight=A.bd?'700':'400';el.style.color='#000';el.style.minWidth='1.2em';box.appendChild(el);return el}
async function drawPage(P){
 const wrap=P.el,k=wrap.clientWidth/P.w,dpr=Math.min(2,window.devicePixelRatio||1),vs=Math.min(k*dpr,3600/Math.max(P.w,P.h));
 const vp=P.pg.getViewport({scale:vs});let cv=wrap.querySelector('canvas');
 if(!cv){cv=document.createElement('canvas');cv.className='pe-cv';wrap.insertBefore(cv,wrap.firstChild)}
 cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);
 const ctx=cv.getContext('2d',{willReadFrequently:true});
 try{await P.pg.render({canvasContext:ctx,viewport:vp}).promise}catch{return}
 if(!P.done){const bl=await extract(P),box=wrap.querySelector('.pe-ov');
  bl.forEach(B=>{sample(ctx,vp.scale,B);mkBlock(P,B,box,k)});
  st.added.filter(a=>a.p===P.n).forEach(a=>mkAdded(P,a,box,k));P.done=true}}
function freePage(P){const cv=P.el&&P.el.querySelector('canvas');if(cv){cv.width=0;cv.height=0}}
function layout(){
 const box=$q('#pepages');if(!box)return;box.innerHTML='';
 const W=Math.min(box.clientWidth||340,900);
 if(io)io.disconnect();
 io=new IntersectionObserver(es=>{es.forEach(e=>{const P=st.pages[+e.target.dataset.i];if(e.isIntersecting){if(!P.drawing){P.drawing=true;drawPage(P).finally(()=>{P.drawing=false})}}else if(!act||act.parentNode!==e.target.querySelector('.pe-ov'))freePage(P)})},{rootMargin:'900px 0px'});
 st.pages.forEach((P,i)=>{const w=document.createElement('div');w.className='pe-pg';w.dataset.i=i;w.style.width=W+'px';w.style.height=(W*P.h/P.w)+'px';
  w.innerHTML='<div class="pe-ov"></div><span class="pe-n">'+(i+1)+' / '+st.pages.length+'</span>';P.el=w;P.done=false;box.appendChild(w);io.observe(w)});
 box.classList.toggle('hl',st.hl)}

function setBar(){const on=!!act,b=$q('#pebar');if(!b)return;b.querySelectorAll('[data-pe=b],[data-pe=up],[data-pe=dn],[data-pe=del]').forEach(x=>x.disabled=!on);
 const E=act&&(act._add?act._A:st.edits[act.dataset.id]);const bb=b.querySelector('[data-pe=b]');if(bb)bb.classList.toggle('on',!!(E&&(act._add?E.bd:E.b)));
 const ad=b.querySelector('[data-pe=add]');if(ad)ad.classList.toggle('on',addMode);const hl=b.querySelector('[data-pe=hl]');if(hl)hl.classList.toggle('on',st.hl)}
function activate(el){
 if(act&&act!==el)deactivate();act=el;el.classList.add('act');
 const B=el._B;if(!el._add){const E=ed(B.id);if(E.t===undefined)E.t=B.s;paint(el,B,E)}
 el.setAttribute('contenteditable','plaintext-only');if(el.contentEditable!=='plaintext-only')el.setAttribute('contenteditable','true');
 el.focus();setBar()}
function deactivate(){
 if(!act)return;const el=act;act=null;el.classList.remove('act');el.removeAttribute('contenteditable');
 if(el._add){const A=el._A;A.t=el.textContent;if(!A.t.trim()){st.added=st.added.filter(x=>x!==A);el.remove()}}
 else{const B=el._B,E=st.edits[B.id];if(E){E.t=el.textContent;if(E.t===B.s&&!E.b&&!E.fs){delete st.edits[B.id]}paint(el,B,st.edits[B.id])}}
 setBar();save()}
function curE(){if(!act)return null;if(act._add)return act._A;return ed(act.dataset.id)}
function tool(k){
 if(k==='add'){addMode=!addMode;if(addMode)deactivate();toast(addMode?'Tap the page where the text should go':'Add text off');setBar();return}
 if(k==='hl'){st.hl=!st.hl;$q('#pepages').classList.toggle('hl',st.hl);setBar();return}
 if(k==='dl'){PE.export();return}
 if(k==='close'){deactivate();st=null;render();return}
 if(!act)return;const E=curE();
 if(k==='b'){const f=act._add?'bd':'b';E[f]=!E[f];act.style.fontWeight=E[f]?'700':'400'}
 else if(k==='up'||k==='dn'){const base=act._add?act._A.fs:sizeOf(act._B,E),n=Math.max(4,Math.min(80,Math.round((base+(k==='up'?.5:-.5))*2)/2));
  if(act._add){act._A.fs=n;place(act,act._k,act._A.x,act._A.y,n)}else{E.fs=n;paint(act,act._B,E)}}
 else if(k==='del'){act.textContent='';deactivate();return}
 setBar();save()}

/* ---- picking a place for new text ---- */
function onPageTap(ev){
 if(!addMode)return;const w=ev.target.closest('.pe-pg');if(!w||ev.target.closest('.pe-b'))return;
 const P=st.pages[+w.dataset.i],r=w.getBoundingClientRect(),k=r.width/P.w,x=(ev.clientX-r.left)/k,y=(ev.clientY-r.top)/k;
 const sz=(P.blocks&&P.blocks.length)?[...P.blocks.map(b=>b.sz)].sort((a,b)=>a-b)[Math.floor(P.blocks.length/2)]:11,
  A={id:'a'+(st.seq++),p:P.n,x:x,y:y+sz*.35,fs:Math.round(sz*2)/2,t:'Text',bd:false};
 st.added.push(A);const el=mkAdded(P,A,w.querySelector('.pe-ov'),k);addMode=false;activate(el);
 const s=getSelection(),rg=document.createRange();rg.selectNodeContents(el);s.removeAllRanges();s.addRange(rg);save()}

/* ---- saving the edited PDF ---- */
PE.export=async()=>{
 if(!st)return;deactivate();const btn=$q('[data-pe=dl]'),lab=btn&&btn.innerHTML;if(btn)btn.disabled=true;
 const prog=n=>{if(btn)btn.querySelector('span').textContent=n};
 try{
  const J=window.jspdf.jsPDF;let doc=null,ps=false;
  for(let i=0;i<st.pages.length;i++){
   prog('Page '+(i+1)+'/'+st.pages.length);await new Promise(r=>setTimeout(r,10));
   const P=st.pages[i],bl=await extract(P),vs=Math.min(2.4,3800/Math.max(P.w,P.h)),vp=P.pg.getViewport({scale:vs}),cv=document.createElement('canvas');
   cv.width=Math.round(vp.width);cv.height=Math.round(vp.height);const ctx=cv.getContext('2d',{willReadFrequently:true});
   await P.pg.render({canvasContext:ctx,viewport:vp}).promise;
   if(!P.done&&bl.some(B=>st.edits[B.id]))bl.forEach(B=>sample(ctx,vs,B));
   const o=P.w>P.h?'l':'p';
   if(!doc){doc=new J({unit:'pt',format:[P.w,P.h],orientation:o,compress:true});
    ps=!!(window.DW_FONT&&(()=>{try{doc.addFileToVFS('PublicSans-Regular.ttf',DW_FONT.r);doc.addFont('PublicSans-Regular.ttf','PublicSans','normal');doc.addFileToVFS('PublicSans-Bold.ttf',DW_FONT.b);doc.addFont('PublicSans-Bold.ttf','PublicSans','bold');return true}catch{return false}})())}
   else doc.addPage([P.w,P.h],o);
   doc.addImage(cv.toDataURL('image/jpeg',.9),'JPEG',0,0,P.w,P.h,undefined,'FAST');cv.width=cv.height=0;
   const font=(b,sz)=>{doc.setFont(ps?'PublicSans':'helvetica',b?'bold':'normal');doc.setFontSize(sz)},hx=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
   for(const B of bl){const E=st.edits[B.id];
    if(E&&E.t!==undefined){const sz=sizeOf(B,E),c=hx(B.bg),f=hx(B.fg);font(E.b,sz);let tw=0;try{tw=E.t?doc.getTextWidth(E.t):0}catch{}
     doc.setFillColor(c[0],c[1],c[2]);doc.rect(B.x-1.5,B.b-ASC*Math.max(B.sz,sz),Math.max(B.w,tw)+3,(ASC+DSC)*Math.max(B.sz,sz),'F');
     if(E.t){doc.setTextColor(f[0],f[1],f[2]);try{doc.text(E.t,B.x,B.b,{baseline:'alphabetic'})}catch{}}}
    else{try{font(false,B.sz);doc.text(B.s,B.x,B.b,{renderingMode:'invisible'})}catch{}}}
   for(const A of st.added.filter(a=>a.p===P.n)){if(!A.t)continue;font(A.bd,A.fs);doc.setTextColor(0,0,0);try{doc.text(A.t,A.x,A.y,{baseline:'alphabetic'})}catch{}}
  }
  const name=st.name.replace(/\.pdf$/i,'')+'-edited.pdf',blob=doc.output('blob'),f=new File([blob],name,{type:'application/pdf'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:name});return}catch(err){if(err.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast('Saved '+name);
 }catch(err){console.error(err);toast('Could not save the PDF')}
 finally{if(btn){btn.disabled=false;btn.innerHTML=lab}}};

/* ---- the view ---- */
PE.mount=async()=>{
 const m=$q('#pe');if(!m)return;
 if(!st){const d=await PE.draft();
  m.innerHTML=`<div class="pane pe-pick"><div class="ch"><span class="ci2">${CI.up}</span><div><h3>Edit a PDF</h3><small>Change the text in any PDF</small></div></div>
<label class="btn p wide pe-up">${CI.up}<span>Choose a PDF</span><input type="file" accept="application/pdf,.pdf" hidden id="pef"></label>
${d?`<div class="bkc"><div><b>${esc(d.name)}</b><small>Unfinished edits saved ${esc(new Date(d.at).toLocaleString())}</small></div><button class="btn" id="per" type="button">Continue</button></div><button class="btn wide" id="ped" type="button">Discard saved PDF</button>`:''}
<ul class="pe-tips"><li>Tap any line of text to change it. Use <b>B</b> and <b>A\u2212 A+</b> to adjust it.</li><li><b>Add text</b> places new text anywhere, handy for blank form fields.</li><li>Edits are saved on this device as you go. Tap <b>Save PDF</b> when you are done.</li><li>Scanned pages are pictures with no text to edit. New text uses the Public Sans font, and pages are saved as sharp images.</li></ul></div>`;return}
 m.innerHTML=`<div class="pe-tb" id="pebar" role="toolbar" aria-label="PDF tools">
<button data-pe="b" class="pe-t" aria-label="Bold" disabled><b>B</b></button><button data-pe="dn" class="pe-t" aria-label="Smaller text" disabled>A\u2212</button><button data-pe="up" class="pe-t" aria-label="Larger text" disabled>A+</button><button data-pe="del" class="pe-t" aria-label="Delete text" disabled>${CI.trash}</button><button data-pe="hl" class="pe-t on" aria-label="Highlight editable text">${CI.info}</button><i></i><button data-pe="add" class="pe-t w">${TI}<span>Add text</span></button><button data-pe="dl" class="pe-t p">${CI.down}<span>Save PDF</span></button></div>
<p class="pe-name"><span>${esc(st.name)} \u00b7 ${st.pages.length} page${st.pages.length==1?'':'s'}</span><button data-pe="close" class="lgbtn" type="button">Close</button></p><div id="pepages" class="pe-pages"></div>`;
 const tb=$q('.top');hh=tb?tb.offsetHeight:0;$q('#pebar').style.top=hh+'px';
 layout();setBar()};

document.addEventListener('pointerdown',ev=>{if(ev.target.closest&&ev.target.closest('#pebar button'))ev.preventDefault()});
document.addEventListener('click',ev=>{
 if(view!=='pdfed')return;
 const t=ev.target.closest('[data-pe]');if(t&&st){tool(t.dataset.pe);return}
 if(ev.target.closest('#per')){PE.resume();return}
 if(ev.target.closest('#ped')){if(confirm('Discard the saved PDF and its edits?'))PE.discard().then(()=>render());return}
 if(!st)return;
 if(addMode){onPageTap(ev);return}
 const b=ev.target.closest('.pe-b');if(b){if(b!==act)activate(b);return}
 if(act&&!ev.target.closest('#pebar'))deactivate()});
document.addEventListener('change',ev=>{if(ev.target.id==='pef'&&ev.target.files[0]){PE.load(ev.target.files[0]);ev.target.value=''}});
document.addEventListener('input',ev=>{if(act&&ev.target===act){if(act._add)act._A.t=act.textContent;else{const E=ed(act.dataset.id);E.t=act.textContent}save()}});
document.addEventListener('keydown',ev=>{if(act&&ev.target===act&&ev.key==='Enter'){ev.preventDefault();deactivate()}});
document.addEventListener('paste',ev=>{if(act&&ev.target===act){ev.preventDefault();const t=(ev.clipboardData||window.clipboardData).getData('text').replace(/\s+/g,' ');document.execCommand('insertText',false,t)}});
PE.leave=()=>{if(act)deactivate();addMode=false;if(io){io.disconnect();io=null}};
})();
