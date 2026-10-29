'use strict';
/* ---------- storage / state ---------- */
const $=s=>document.querySelector(s),LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},SV=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{toast('Storage full - remove unused logos or documents')}};
const fkey=d=>((d.pf||(d.d&&d.d.proj))||'').trim()||'Unfiled';
let docs=LS('dw.docs',[]),theme=LS('dw.theme','auto'),ME=LS('dw.me',{}),lgs=0,lv='',view='home',cur=null,pane='form',fld=null,ret='home',pvB=null,projs=LS('dw.proj',[]),ct=LS('dw.ct',{});
const eff=()=>theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme,TC=()=>eff()==='dark'?'#000000':'#FFFFFF';
const RELAY_URL='https://script.google.com/macros/s/AKfycbzpA-xXhKiRGUWXdWjo86tUsDbJqf3whW7h4z5JRILA6CKg8N-Qbd0PzBqVIl2HXldd/exec',RELAY_KEY='dw-8581750528ec08a1';
let AU=Object.assign({on:false,remind:true},LS('dw.auto',{}));
const bkJSON=()=>JSON.stringify({app:'danholsen-workspace',v:2,at:new Date().toISOString(),docs,lib,sigs,sigdef:sigDef,sigauto:sigAuto,msgs}),bkName=()=>`danholsen-backup-${new Date().toISOString().slice(0,10)}.json`,DAY=864e5,lastBk=()=>LS('dw.lastbk',0)||0;
const bnr=()=>{if(!AU.remind||!docs.length)return'';const lb=lastBk();if(Date.now()-lb<DAY)return'';return`<button class="bkbn" id="bkn"><span><b>Back up your documents</b><small>${lb?'Last backup '+ago(lb)+'.':'No backup yet.'} Tap to save or send a copy.</small></span><i>Back up</i></button>`};
const e=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const J={left:'flex-start',center:'center',right:'flex-end'},uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const mk=a=>Object.fromEntries(a.map(([k,l,df])=>[k,{l,df:df||''}]));
const D=['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];

/* ---------- templates (one schema drives editor + A4 output) ---------- */
const SIGN=(t,p,n)=>({k:'sg',t,n:4,f:[p+'n',p+'d',p+'t',p+'s']});
const TPL={
jcf:{n:'Job Completion Form',d:'Client sign-off with satisfaction ratings',no:'Form No. 06-01-F9 Rev: 01',
F:mk([['no','JCF No'],['client','Client name'],['loc','Job location'],['date','Date of completion'],['work','Work performed'],['po','PO nos.'],['contact','Contact / phone'],
['r1','Executed job as per approved project quality plan and operational'],['r2','Job completed promptly'],['r3','Job-site left clean'],['r4','Was our staff friendly'],['r5','Overall, workers\' performance'],['r6','Job reports sent to client'],
['an','Name'],['ad','Designation'],['at','Date'],['as','Sign']]),
S:[{k:'jh',f:['no']},{k:'lr',f:['client','loc','date','work','po','contact']},
{k:'rt',t:'Notice of completion',ctr:1,o:['Not satisfied','Somewhat satisfied','Satisfied','Very satisfied'],f:['r1','r2','r3','r4','r5','r6']},
{k:'tb',key:'jobs',c:[['Type',3],['Diameter',2],['Location',4],['Job performed',3]],rows:[['','','','']]},
{k:'sl',t:'I have reviewed the job and it has been completed to my satisfaction:',f:['an','at','ad','as']}]},

trn:{n:'Document Transmittal Form',d:'Formal issue of reports with sender / receiver sign-off',no:'',
F:mk([['no','Transmittal no.'],['date','Transmittal date'],['proj','Project name'],['con','Contract no.'],['loc','Location'],['to','To'],['from','From','Danholsen Global Services Limited'],['att','Attention'],['by','Prepared by'],['addr','Address'],['des','Designation'],['rem','Remarks','These documents are issued for your approval and records.'],
['sn','Name'],['sd','Designation'],['st','Date'],['ss','Signature'],['rn','Name'],['rd','Designation'],['rt','Date'],['rs','Signature']]),
S:[{k:'g',n:4,f:[['no',2],['date',2],['proj',2],['con',2],['loc',4],['to',2],['from',2],['att',2],['by',2],['addr',2],['des',2]]},
{k:'ck',t:'Purpose of transmittal',key:'pur',o:['For approval','For review & comment','For information','As requested','For records'],df:[0,4]},
{k:'tb',key:'docs',c:[['Item',1],['Document title / description',6],['Doc. no.',4],['Rev.',1],['Date',2],['Pages',1],['Format',1.4]],rows:[['1','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},{k:'bx',cols:[{t:'Danholsen Global Services Limited (Sender)',f:['sn','sd','st','ss']},{t:'Client (Receiver)',f:['rn','rd','rt','rs']}]}]},

tsh:{n:'Weekly Timesheet',d:'Personnel and equipment days per week',no:'',
F:mk([['wk','Week'],['from','From'],['to','To'],['client','Client'],['con','Contract number'],['loc','Location'],['proj','Project name'],
['an','Name'],['ap','Position'],['at','Date'],['as','Signature'],['bn','Name'],['bp','Position'],['bt','Date'],['bs','Signature']]),
S:[{k:'g',n:4,f:[['wk',1],['from',2],['to',1],['client',2],['con',2],['loc',2],['proj',2]]},
{k:'tb',t:'Personnel and equipment',key:'eq',c:[['Equipment / personnel',6],['Qty',1.2],...D.map(x=>[x,1.2]),['Total days',1.6]],rows:[['','','','','','','','','','']]},
{k:'bx',cols:[{t:'Danholsen',f:['an','ap','at','as']},{t:'Client',f:['bn','bp','bt','bs']}]}]},

mpi:{n:'Magnetic Particle Examination Report',d:'MPI examination report to AWS / ASME practice',no:'',
F:mk([['date','Report date'],['no','Report number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['code','Code / specification','AWS D1.1:2020'],['cs','Client specification','AWS D1.1'],['acc','Acceptance standard','AWS D1.1'],['proc','NDE procedure','DGS-NDT-02-PR-02'],['mat','Material','CARBON STEEL'],['thk','Thickness (mm)'],['surf','Surface condition','Grinding, Wire brush'],
['ind','Magnetic field indicator','Pie gauge'],['lit','Lighting','Natural; light meter > 1000 lux'],['tmp','Part temperature','Ambient'],['dem','Demagnetisation','No'],['meth','Magnetisation method','Electromagnet yoke (AC)'],['mfr','Yoke manufacturer','Gammatec'],['blk','Lifting block','4.5 kg'],['leg','Leg spacing','150mm'],['flow','Flow direction'],['ser','Serial no.','1408064'],
['pc','Contrast paint colour','White'],['ps','Suspension','Non-aqueous'],['pm','Manufacturer / model','MR72 / MR CHEMIE'],['pb','Batch no.'],['ic','Ink / powder colour','Black'],['is','Suspension','Non-aqueous'],['im','Manufacturer / model','MR76S / MR CHEMIE'],['ib','Batch no.'],
['dwg','Engineering dwg no.'],['wps','WPS no.'],['jt','Joint / weld type'],['item','Item inspected'],['rem','Remarks'],
['td','Test date'],['tn','Name'],['tl','Level'],['ts','Signature'],['o1','Sign-off column 1','CLIENT'],['cn','Name'],['cd','Date'],['cx','Signature'],['o2','Sign-off column 2'],['dn','Name'],['dd','Date'],['dx','Signature'],['o3','Sign-off column 3'],['en','Name'],['ed','Date'],['ex','Signature']]),
S:[{k:'g',n:4,f:[['date',2],['no',2],['client',1],['con',1],['proj',1],['loc',1],['code',1],['cs',1],['acc',1],['proc',1],['mat',1],['thk',1],['surf',2]]},
{k:'ck',t:'Examination stage',key:'stg',o:['As welded','Before PWHT','After PWHT','After hydro test','Other'],df:[]},
{k:'g',n:4,t:'Conditions',f:['ind','lit','tmp','dem']},
{k:'g',n:4,t:'Magnetisation and consumables',f:['meth','mfr','ser','blk','leg','flow','pc','ps','pm','pb','ic','is','im','ib']},
{k:'g',n:4,t:'Part / weld examined',f:['dwg','wps','jt','item']},
{k:'tb',t:'Examination results',key:'res',c:[['Item',3],['Joint no.',2],['Welder ID',3],['Defect',1.5],['Accept',1.5],['Reject',1.5],['Comment',1.5]],rows:[['','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},{k:'sx',leadL:'Test date',lead:'td',th:'DGSL NDT technician',tech:['tn','tl','ts'],P:[['o1','cn','cd','cx'],['o2','dn','dd','dx'],['o3','en','ed','ex']]}]},

ut:{n:'Ultrasonic Testing Examination Report',d:'UT weld examination with probe settings and defect log',no:'',
F:mk([['date','Report date'],['no','Report number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['code','Code / specification','AWS D1.1:2020'],['cs','Client specification','AWS D1.1'],['acc','Acceptance standard','AWS D1.1'],['proc','NDE procedure','AWS D1.1'],['mat','Material','CARBON STEEL'],['thk','Thickness (mm)'],['eq','UT flaw detector','SONATEST D10+'],['ser','Detector serial no.','1007735'],['blk','Calibration blocks','V1 & V2 BLOCK'],['dac','DAC reference block','1.5mm DIA. SDH'],['tmp','Test piece temperature','AMBIENT'],['cpl','Couplant','GREASE'],['s0','0 degree probe sensitivity','2ND BWE TO 80% FSH'],['sa','Angle probe ref. sensitivity','DAC FROM 1.5mm SDH'],['ss','Angle scan sensitivity','DAC + TRANSFER VALUE + 6DB'],['comp','Component'],['dwg','Engineering drg no.'],['job','Job card no.'],['wd','Weld date'],['wps','WPS no.'],['it','Item type'],['ev','Evaluation'],['rem','Comments'],
['td','Test date'],['tn','Name'],['tl','Level'],['ts','Signature'],['o1','Sign-off column 1','CLIENT'],['cn','Name'],['cd','Date'],['cx','Signature'],['o2','Sign-off column 2'],['dn','Name'],['dd','Date'],['dx','Signature'],['o3','Sign-off column 3'],['en','Name'],['ed','Date'],['ex','Signature']]),
S:[{k:'g',n:4,f:[['date',2],['no',2],['client',1],['con',1],['proj',1],['loc',1],['code',1],['cs',1],['acc',1],['proc',1],['mat',1],['thk',1],['eq',1],['ser',1]]},
{k:'g',n:4,t:'Calibration and sensitivity',f:['blk','dac','tmp','cpl','s0','sa','ss','comp']},
{k:'tb',t:'Probe settings',key:'prb',c:[['Probe angle',2],['Frequency (MHz)',2],['Size (mm)',1.5],['Ref. level (dB)',2],['Transfer correction',2],['Scan sensitivity',2],['Test range (mm)',2]],rows:[['0 Degree','-','-','-','-','-','-'],['45 Degree','4','10','48','+6dB','54dB','100'],['60 Degree','4','10','52','+6dB','58dB','100'],['70 Degree','4','10','54','+6dB','60dB','100']]},
{k:'g',n:4,t:'Weld details',f:['dwg','job','wd','wps',['it',2],['ev',2]]},
{k:'nt',x:'The following welds have been examined in conformance with the requirements of AWS D1.1:2020.'},
{k:'tb',t:'Defects recorded',key:'def',c:[['Welder ID',2.8],['Weld no.',1.6],['Plate (mm)',2.4],['Location',1.4],['Length',1.2],['Depth',1.2],['Type',1.2],['Evaluation',1.8],['Remarks',1.4]],rows:[['','','','','','','','','']]},
{k:'tx',t:'Comments',f:'rem'},{k:'sx',leadL:'Test date',lead:'td',th:'DGSL NDT technician',tech:['tn','tl','ts'],P:[['o1','cn','cd','cx'],['o2','dn','dd','dx'],['o3','en','ed','ex']]}]}
};
const secs=t=>TPL[t].S;
docs.forEach(x=>{const T=TPL[x&&x.t];if(T&&x.d)Object.entries(T.F).forEach(([k,f])=>{if(x.d[k]===undefined)x.d[k]=f.df})});
/* ---------- header logos: every document carries its own list (Danholsen first by default) ---------- */
const DG=window.DG_URI||'danholsen-full.png',MAXLG=6;
let lib=LS('dw.lib',null),legacyLg=null;
let sigs=LS('dw.sigs',[]),sgk=null,sigDef=LS('dw.sigdef',null),sigAuto=LS('dw.sigauto',false);
const defSig=()=>sigs.find(x=>x.id===sigDef)||null,
 DS={trn:'ss',tsh:'as',mpi:'ts',ut:'ts'},   /* the Danholsen-side signature field of each template (the Job Completion Form is signed by the client) */
 sgName=(x,i)=>x.n||('Signature '+(i+1)),
 setDef=id=>{sigDef=id||null;SV('dw.sigdef',sigDef)},
 delSig=id=>{sigs=sigs.filter(x=>x.id!==id);SV('dw.sigs',sigs);if(sigDef===id)setDef(null)},
 autoSign=d=>{const s=defSig(),k=DS[d.t];if(sigAuto&&s&&k)(d.sg=d.sg||{})[k]={id:s.id,s:100}};   /* default signature, saved on this device */   /* saved signature images (transparent PNG) + the field the signature panel is editing */
const legacyOf=(ol,oz)=>{const out=[];if(Array.isArray(ol))ol.forEach((src,i)=>{if(!src)return;let id='dg';if(src!==DG&&src!=='danholsen-full.png'){const f=lib.find(x=>x.src===src);id=f?f.id:uid();if(!f)lib.push({id,src})}out.push({id,s:(oz&&oz[i])||100})});return out};
if(!lib){lib=[];legacyLg=legacyOf(LS('dw.logos',null),LS('dw.lsz',[]));SV('dw.lib',lib)}
const dfLg=()=>legacyLg&&legacyLg.length?JSON.parse(JSON.stringify(legacyLg)):[{id:'dg',s:100}];
docs.forEach(x=>{if(x&&!Array.isArray(x.lg))x.lg=dfLg()});
const lgItems=doc=>(doc.lg||[]).map(l=>({id:l.id,s:l.s||100,src:l.id==='dg'?DG:(lib.find(x=>x.id===l.id)||{}).src})).filter(l=>l.src);
function newDoc(t){const T=TPL[t],d={};Object.entries(T.F).forEach(([k,f])=>d[k]=f.df);
 T.S.forEach(s=>{if(s.k==='tb')d[s.key]=JSON.parse(JSON.stringify(s.rows));if(s.k==='ck')d[s.key]=[...(s.df||[])];if(s.k==='rt')s.f.forEach(k=>d[k]='')});
 return{id:uid(),t,title:T.n,d,a:{},lg:[{id:'dg',s:100}],u:Date.now(),b:JSON.stringify([T.n,d])}}

/* ---------- A4 sheet renderer (mirrors the original Danholsen forms) ---------- */
const ST={jcf:'jcf',trn:'trn',tsh:'tsh',mpi:'rep',ut:'rep'};
/* Reports: every label / heading / column title can be reworded and grid fields can be added or removed.
   The edits live on the document (doc.o text, doc.cf custom fields, doc.hide removed fields) and are merged
   into a copy of the template here, so the preview AND the PDF both read the same resolved template. */
function resolveTpl(doc){const T0=TPL[doc.t];if(ST[doc.t]!=='rep')return T0;
 const o=doc.o||{},cf=doc.cf||[],hid=new Set(doc.hide||[]),T=JSON.parse(JSON.stringify(T0));
 Object.keys(T.F).forEach(k=>{if(o['L:'+k]!=null)T.F[k].l=o['L:'+k]});
 cf.forEach(c=>{T.F[c.k]={l:o['L:'+c.k]??'New field',df:''}});
 T.S.forEach((x,si)=>{
  if(x.t!=null){x.t0=x.t;if(o['S:'+si]!=null)x.t=o['S:'+si]}
  if(x.k==='g'){x.fx=doc.t==='mpi'&&x.t0==='Magnetisation and consumables';
   if(!x.fx){x.f=x.f.filter(f=>!hid.has(Array.isArray(f)?f[0]:f));cf.filter(c=>c.si===si).forEach(c=>x.f.push(c.k))}}
  if(x.k==='tb')x.c=x.c.map((c,i)=>[o[`C:${x.key}:${i}`]??c[0],c[1],c[0]]);
  if(x.k==='nt'&&o['N:'+si]!=null)x.x=o['N:'+si];
  if(x.k==='ck')x.o=x.o.map((t,i)=>o[`K:${x.key}:${i}`]??t);
  if(x.k==='sx'){if(o['X:leadL:'+si]!=null)x.leadL=o['X:leadL:'+si];if(o['X:th:'+si]!=null)x.th=o['X:th:'+si]}});
 return T}
const PIN=['sl','bx','sx'];   /* name / signing blocks sit at the foot of the page, like the PDF */
const dflt=(doc,k)=>k==='h:t'?({jcf:'left',trn:'center',tsh:'right'}[doc.t]||'center'):k.includes('.')?'center':(ST[doc.t]==='rep'?'center':'left');
function sheet(doc){const T=resolveTpl(doc),d=doc.d,st=ST[doc.t],A=k=>doc.a[k]||dflt(doc,k),ttl=e(doc.title||T.n),
 oe=k=>st==='rep'?` data-ed="o:${k}"`:'',
 fb=(x,si)=>{if(st!=='rep'||x.k!=='g'||x.fx)return'';const ks=(TPL[doc.t].S[si].f||[]).map(f=>Array.isArray(f)?f[0]:f),n=(doc.hide||[]).filter(k=>ks.includes(k)).length;return`<button class="addrow" data-addf="${si}">+ Add field</button>${n?`<button class="addrow" data-restf="${si}">Restore ${n} removed field${n>1?'s':''}</button>`:''}`};
 const fms=key=>{const f=doc.fm&&doc.fm[key];if(!f)return'';return(f.b!=null?`font-weight:${f.b?700:400};`:'')+(f.s?`font-size:calc(1em + ${(f.s*1.333).toFixed(1)}px);`:'')},
  sgi=k=>{const g=doc.sg&&doc.sg[k],it=g&&sigs.find(x=>x.id===g.id);return it?{c:' sgi',s:`--sg:url('${it.src}');--sgh:${g.s||100};--sgp:${A(k)};`}:{c:'',s:''}};
 const isSg=k=>/^sign/i.test((T.F[k]||{}).l||'');
 const v=(k,x='')=>{const g=sgi(k);return`<div class="v ${x}${g.c}" data-ed="f:${k}" data-al="${k}"${x==='t'?' data-ml="1"':''} style="justify-content:${J[A(k)]};text-align:${A(k)};${fms(k)}${g.s}">${e(d[k])}</div>`};
 const rows=s=>{const it=s.f.map(x=>Array.isArray(x)?[...x]:[x,1]),R=[];let r=[],t=0;
  it.forEach(x=>{if(t+x[1]>s.n){r[r.length-1][1]+=s.n-t;R.push(r);r=[];t=0}r.push(x);t+=x[1]});
  if(r.length){r[r.length-1][1]+=s.n-t;R.push(r)}return R};
 const sec=(s,si)=>{const h=(st==='rep'?s.t0!=null:s.t)?`<div class="sh${s.ctr?' ctr':''}"${oe('S:'+si)}>${e(s.t)}</div>`:'';
  if(s.k==='jh')return'';
  if(s.k==='lr')return s.f.map(k=>`<div class="lr"><b>${e(T.F[k].l)}:</b>${v(k)}</div>`).join('');
  if(s.k==='g'&&st==='rep')return h+`<div class="rbs"${s.fx?' data-nf="1"':` data-gs="${si}"`}>${rows(s).map(r=>`<div class="rg" style="--n:${s.n}">${r.map(([k,sp])=>`<div class="rl"${oe('L:'+k)} style="grid-column:span ${sp}">${e(T.F[k].l)}</div>`).join('')}</div><div class="rg" style="--n:${s.n}">${r.map(([k,sp])=>`<div class="rv" style="grid-column:span ${sp}">${v(k)}</div>`).join('')}</div>`).join('')}</div>${fb(s,si)}`;
  if(s.k==='g')return h+`<div class="g" style="grid-template-columns:repeat(${s.n},1fr)">${rows(s).flat().map(([k,sp])=>`<div class="c" style="grid-column:span ${sp};--sp:${sp}"><div class="l">${e(T.F[k].l)}</div>${v(k)}</div>`).join('')}</div>`;
  if(s.k==='tx')return h+`<div class="g" style="grid-template-columns:1fr"><div class="c" style="min-height:15mm">${v(s.f,'t')}</div></div>`;
  if(s.k==='nt')return`<div${oe('N:'+si)} style="font-weight:700;text-align:center;padding:3px 0">${e(s.x)}</div>`;
  if(s.k==='ck')return h+`<div class="ck">${s.o.map((o,i)=>{const on=(d[s.key]||[]).includes(i);return`<span class="cki" data-ck="${s.key}" data-i="${i}"><span class="bx${on?' on':''}">${on?'\u2713':''}</span><span${oe(`K:${s.key}:${i}`)}>${e(o)}</span></span>`}).join('')}</div>`;
  if(s.k==='rt')return h+`<table class="tb"><colgroup><col style="width:10mm"><col>${s.o.map(()=>'<col style="width:25mm">').join('')}</colgroup><tr><th>S/N</th><th>Description</th>${s.o.map(o=>`<th>${e(o)}</th>`).join('')}</tr>${s.f.map((k,i)=>`<tr><td style="text-align:center;font-weight:700">${i+1}</td><td style="font-weight:700;text-transform:uppercase">${e(T.F[k].l)}</td>${s.o.map((o,j)=>`<td class="rc" data-rate="${k}" data-j="${j}" style="text-align:center"><span class="o ${String(d[k])===String(j)?'on':''}"></span></td>`).join('')}</tr>`).join('')}</table>`;
  if(s.k==='tb'){const tot=s.c.map(c=>c[0]).findIndex(l=>/^total/i.test(l)),sm=s.c.reduce((a,b)=>a+b[1],0);
   return h+`<table class="tb"><colgroup>${s.c.map(c=>`<col style="width:${(c[1]*100/sm).toFixed(2)}%">`).join('')}</colgroup><tr>${s.c.map((c,i)=>`<th${oe(`C:${s.key}:${i}`)}>${e(c[0])}</th>`).join('')}</tr>${d[s.key].map((r,ri)=>`<tr data-rr="${s.key}:${ri}">${s.c.map((c,i)=>{let x=r[i]??'';if(i===tot&&!x)x=r.filter(y=>/^[\u221A\u2713x]$/i.test(y)).length||'';return`<td data-ed="r:${s.key}:${ri}:${i}" data-key="${s.key}" data-ri="${ri}" data-ci="${i}" data-al="${s.key}.${i}"${i===tot?' data-tot="1"':''} style="text-align:${A(s.key+'.'+i)};${fms('c:'+s.key+':'+i)}">${e(x)}</td>`}).join('')}</tr>`).join('')}</table><button class="addrow" data-add="${s.key}">+ Add row</button>`}
  if(s.k==='sg')return h+`<div class="sg" style="--n:${s.n}">${s.f.map(k=>`<div><div class="l">${e(T.F[k].l)}</div><div class="ln" data-ed="f:${k}" data-al="${k}" style="justify-content:${J[A(k)]}">${e(d[k])}</div></div>`).join('')}</div>`;
  if(s.k==='sl')return h+`<div class="sl">${s.f.map(k=>{const g=sgi(k);return`<div${isSg(k)?' class="sgr"':''}>${e(T.F[k].l)}:<span class="ln${g.c}" data-ed="f:${k}" data-al="${k}" style="justify-content:${J[A(k)]};${fms(k)}${g.s}">${e(d[k])}</span></div>`}).join('')}</div>`;
  if(s.k==='sx'){const hd=k=>`<div class="sxh"><div class="v" data-ed="f:${k}" data-al="${k}" style="justify-content:center;text-align:center;${fms(k)}">${e(d[k])}</div></div>`,fl=k=>`<div${isSg(k)?' class="sgr"':''}><b><span${oe('L:'+k)}>${e(T.F[k].l)}</span>:</b>${v(k)}</div>`;
   return`<div class="sxg"><div class="sxh"${oe('X:leadL:'+si)}>${e(s.leadL)}</div><div class="sxh"${oe('X:th:'+si)}>${e(s.th)}</div>${s.P.map(p=>hd(p[0])).join('')}<div class="sxl">${v(s.lead)}</div>${[0,1,2].map(r=>fl(s.tech[r])+s.P.map(p=>fl(p[1+r])).join('')).join('')}</div>`}
  if(s.k==='bx')return`<div class="bxs">${s.cols.map(c=>`<div><div class="bh">${e(c.t)}</div>${c.f.map(k=>`<div class="br${isSg(k)?' sgr':''}"><b>${e(T.F[k].l)}:</b>${v(k)}</div>`).join('')}</div>`).join('')}</div>`;
  return''};
 const LI=lgItems(doc),n=LI.length,nl=Math.ceil(n/2),nr=n-nl,cw=n?Math.min(25,78/n):0,tw=100-cw*n,
  li=l=>`<div class="slot" data-lgo="1"><img src="${l.src}" alt="" draggable="false" style="max-height:${(14*l.s/100).toFixed(1)}mm;max-width:${l.s}%"></div>`,
  lg=st==='rep'?`<div class="rh" style="grid-template-columns:${nl?`repeat(${nl},minmax(0,${cw}fr)) `:''}minmax(0,${tw}fr)${nr?` repeat(${nr},minmax(0,${cw}fr))`:''}">${LI.slice(0,nl).map(li).join('')}<div class="rt"><h2 data-ed="t" data-ml="">${ttl}</h2></div>${LI.slice(nl).map(li).join('')}</div>`:`<div class="logos">${n?LI.map(li).join(''):'<div class="slot" data-lgo="1"></div>'}</div>`;
 const head={jcf:`<div class="bar"></div><div class="jt"><h2 data-ed="t" data-ml="">${ttl}</h2><span>JCF NO: <u data-ed="f:no" data-al="no">${e(d.no)}</u></span></div>`,trn:`<div class="ob"><h2 data-ed="t" data-ml="">${ttl}</h2></div>`,tsh:`<div class="tt"><h2 data-ed="t" data-ml="">${ttl}</h2></div>`,rep:''}[st];
 return`<div class="sheet st-${st}"><table class="wrap2"><thead><tr><td></td></tr></thead><tbody><tr><td><div class="body">${lg}${head}${T.S.map((x,i)=>PIN.includes(x.k)?'':sec(x,i)).join('')}<div class="bot">${T.S.map((x,i)=>PIN.includes(x.k)?sec(x,i):'').join('')}<div class="ft"><span>${e(T.no)}</span><span>${st==='jcf'?'':e(d.no||'')}</span></div></div></div></td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table></div>`}

/* ---------- editor ---------- */
/* ---------- in-place editor: tap text on the page, edit there ---------- */
const AI={left:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h10M4 18h14"/></svg>',center:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 12h10M5 18h14"/></svg>',right:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 12h10M6 18h14"/></svg>'};
let act=null;
/* ---- undo: one snapshot per change (a field edit counts once, however many keystrokes) ---- */
let hist=[];
const snap=()=>JSON.stringify({title:cur.title,d:cur.d,a:cur.a,o:cur.o,cf:cur.cf,hide:cur.hide,lg:cur.lg,sg:cur.sg,fm:cur.fm});
const updUndo=()=>{const tb=$('[data-tb="undo"]');if(tb)tb.disabled=!hist.length;const b=$('#undo');if(b){b.disabled=!hist.length;b.textContent=hist.length?'Undo \u00b7 '+hist.length:'Undo'}};
function pushH(){hist.push(snap());if(hist.length>80)hist.shift();updUndo()}
function undo(){if(!hist.length||!cur){toast('Nothing to undo');return}
 const x=JSON.parse(hist.pop());cur.title=x.title;cur.d=x.d;cur.a=x.a;cur.o=x.o;cur.cf=x.cf;cur.hide=x.hide;cur.lg=x.lg;cur.sg=x.sg;cur.fm=x.fm;
 act=null;const t=$('#ttl');if(t)t.value=cur.title;paint();setBar();if($('#lgp'))lgPanel();updUndo();toast('Undone')}

const PT=(()=>{const d=document.createElement('div');d.contentEditable='plaintext-only';return d.contentEditable==='plaintext-only'})();
let zm=1,svt;const mark=s=>{const el=$('#sv');if(el){el.className='sv '+s;el.textContent=s==='w'?'Saving\u2026':'Saved'}};
const queue=()=>{mark('w');clearTimeout(svt);svt=setTimeout(()=>{SV('dw.docs',docs);mark('ok')},300)};
let sro;
/* The sheet is always laid out at its true A4 width (same as the PDF) and then scaled with transform,
   inside a wrapper that has the scaled size. CSS zoom made iOS keep small text too big, so table headings overlapped. */
const fit=()=>{const g=$('#stage'),w=g&&g.querySelector('.shw'),s=w&&w.querySelector('.sheet');if(!s)return;
 const cs=getComputedStyle(g),av=g.clientWidth-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0),W=s.offsetWidth||794,k=Math.min(1,av/W)*zm;
 s.style.zoom='';s.style.transform=Math.abs(k-1)<.001?'':`scale(${k})`;s.style.setProperty('--k',k.toFixed(4));
 w.style.width=(W*k)+'px';w.style.height=(s.offsetHeight*k)+'px';
 if(window.ResizeObserver){if(sro)sro.disconnect();sro=new ResizeObserver(()=>{const h=s.offsetHeight*k;if(Math.abs(parseFloat(w.style.height)-h)>.5)w.style.height=h+'px'});sro.observe(s)}};
function fitThumbs(){document.querySelectorAll('.mini').forEach(m=>{const s=m.firstElementChild;if(s)s.style.transform=`scale(${m.clientWidth/794})`})}
async function exportBk(){const name=`danholsen-backup-${new Date().toISOString().slice(0,10)}.json`,blob=new Blob([bkJSON()],{type:'application/json'}),f=new File([blob],name,{type:'application/json'});
 if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:'Danholsen backup'});SV('dw.lastbk',Date.now());render();return}catch(err){if(err.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);SV('dw.lastbk',Date.now());toast('Backup downloaded');render()}
function importBk(file){const r=new FileReader();r.onload=()=>{let d;try{d=JSON.parse(r.result)}catch{}
 if(!d||d.app!=='danholsen-workspace'||!Array.isArray(d.docs)){toast('That is not a Danholsen backup file');return}
 if(!confirm(`Import ${d.docs.length} document(s)? Existing documents are kept; matching ones are updated if the backup is newer.`))return;
 let leg=null;if(Array.isArray(d.lib))d.lib.forEach(l=>{if(l&&l.id&&l.src&&!lib.some(x=>x.id===l.id))lib.push({id:l.id,src:l.src})});
 else if(Array.isArray(d.logos))leg=legacyOf(d.logos,d.lsz);
 if(d.msgs&&typeof d.msgs==='object'){msgs=Object.assign({},msgs,d.msgs);SV('dw.msgs',msgs)}
 if(Array.isArray(d.sigs))d.sigs.forEach(l=>{if(l&&l.id&&l.src&&!sigs.some(x=>x.id===l.id))sigs.push({id:l.id,src:l.src,n:l.n})});SV('dw.sigs',sigs);if(!sigDef&&d.sigdef&&sigs.some(x=>x.id===d.sigdef))setDef(d.sigdef);if(d.sigauto&&!sigAuto){sigAuto=true;SV('dw.sigauto',true)}
 SV('dw.lib',lib);
 const m=new Map(docs.map(x=>[x.id,x]));d.docs.forEach(x=>{if(x&&x.id&&TPL[x.t]){if(!Array.isArray(x.lg))x.lg=leg&&leg.length?JSON.parse(JSON.stringify(leg)):[{id:'dg',s:100}];const o=m.get(x.id);if(!o||(x.u||0)>(o.u||0))m.set(x.id,x)}});docs=[...m.values()];SV('dw.docs',docs);
 render();toast('Backup imported')};r.readAsText(file)}
document.addEventListener('change',ev=>{const i=ev.target;if(i.dataset.bk&&i.files[0]){importBk(i.files[0]);i.value=''}});
/* headings, titles and labels: apply the bold / size / alignment chosen in the editor */
function hfmt(g){g.querySelectorAll('[data-ed]').forEach(el=>{const id=el.dataset.ed;if(id!=='t'&&id[0]!=='o')return;const key='h:'+(id==='t'?'t':id.slice(2));el.dataset.al=key;const f=cur.fm&&cur.fm[key],al=cur.a[key];
  if(f){if(f.b!=null)el.style.fontWeight=f.b?700:400;if(f.s)el.style.fontSize=(parseFloat(getComputedStyle(el).fontSize)+f.s*1.333).toFixed(2)+'px'}
  if(al){el.style.textAlign=al;el.style.justifyContent=J[al];if(id==='t'||getComputedStyle(el).display==='inline'){el.style.display='block';el.style.width='100%'}}})}
function paint(){const g=$('#stage');g.innerHTML='<div class="shw">'+sheet(cur)+'</div>';hfmt(g);fit();cur.u=Date.now();SV('dw.docs',docs);mark('ok')}
function off(el){el.removeAttribute('contenteditable');el.classList.remove('on')}
function activate(el){if(act&&act.el.isConnected&&act.el!==el)off(act.el);
 act={el,pre:snap()};el.setAttribute('contenteditable',PT?'plaintext-only':'true');el.classList.add('on');el.focus({preventScroll:true});
 const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);
 setBar();setTimeout(()=>el.scrollIntoView({block:'center',behavior:'smooth'}),260)}
function done(){if(act&&act.el.isConnected){off(act.el);act.el.blur()}act=null;SV('dw.docs',docs);setBar()}
let ebx=false,ebs=false;   /* edit bar expanded? collapsed by default on phones/tablets */
function setBar(){const b=$('#etb');if(!b)return;if(!act){b.classList.remove('show');ebx=false;return}
 const el=act.el,id=el.dataset.ed,T=resolveTpl(cur),al=el.dataset.al,tb=el.dataset.key,fk=id[0]==='f'?id.slice(2):id.startsWith('o:L:')?id.slice(4):null,gf=fk&&el.closest('[data-gs]')&&!['date','no'].includes(fk);let lab;
 if(id==='t')lab='Document title';else if(id[0]==='f')lab=T.F[id.slice(2)].l;else if(id[0]==='o')lab=({L:'Field label',S:'Section heading',C:'Column heading',N:'Note',K:'Option',X:'Heading'})[id[2]];else lab=T.S.find(x=>x.key===tb).c[+el.dataset.ci][0]+' \u00b7 row '+(+el.dataset.ri+1);
 const cu=al?(cur.a[al]||dflt(cur,al)):'';
 const fk2=id[0]==='f'?id.slice(2):id[0]==='r'?'c:'+tb+':'+el.dataset.ci:id==='t'?'h:t':id[0]==='o'?'h:'+id.slice(2):null,fmOk=fk2&&!el.closest('[data-nf]'),fo=fmOk?((cur.fm&&cur.fm[fk2])||{}):{},isB=!!fmOk&&+getComputedStyle(el).fontWeight>=600,
  sgf=fmOk&&id[0]==='f'&&/^sign/i.test((TPL[cur.t].F[fk2]||{}).l||''),
  fmt=fmOk?`<div class="er"><button class="ab fb${isB?' on':''}" data-tb="b" aria-label="Bold" aria-pressed="${isB}"><b>B</b></button><button class="nx" data-tb="sm" aria-label="Smaller text"${(fo.s||0)<=-3?' disabled':''}>A\u2212</button><button class="nx fsv" data-tb="rs" aria-label="Reset text size">${fo.s?(fo.s>0?'+':'')+fo.s+' pt':'Size'}</button><button class="nx" data-tb="lg" aria-label="Larger text"${(fo.s||0)>=6?' disabled':''}>A+</button></div>${id[0]==='r'?'<small class="fhn">Bold and size apply to the whole column</small>':''}${sgf?`<div class="er"><button class="nx sgb" data-tb="sig">${cur.sg&&cur.sg[fk2]?'Change signature':'Add signature'}</button>${defSig()&&!(cur.sg&&cur.sg[fk2])?'<button class="nx sgb dfb" data-tb="sigdef">Use default</button>':''}</div>`:''}`:'';
 b.innerHTML=`<div class="eh"><small>${e(lab)}</small><span>${sgf?'':`<button class="mbx" data-tb="more" aria-expanded="${ebx}">${ebx?'Less':'More'}</button>`}<button data-tb="undo"${hist.length?'':' disabled'}>Undo</button><button data-tb="done">Done</button></span></div><div class="er er0">${al?['left','center','right'].map(x=>`<button class="ab${cu===x?' on':''}" data-tb="al" data-a="${x}" aria-label="Align ${x}">${AI[x]}</button>`).join(''):''}<button class="nx" data-tb="prev">Prev</button><button class="nx dk" data-tb="next">Next field</button></div>${fmt}${tb?`<div class="er"><button class="nx" data-tb="ins">+ Row below</button><button class="nx dl" data-tb="del">Delete row</button></div>`:''}${gf?`<div class="er"><button class="nx dl" data-tb="delf">Delete this field</button></div>`:''}`;b.classList.toggle('cl',!(ebx||sgf));b.classList.add('show')}
function fmKey(el){const id=el.dataset.ed;if(id==='t'||id[0]==='o')return'h:'+(id==='t'?'t':id.slice(2));return id[0]==='f'?id.slice(2):'c:'+el.dataset.key+':'+el.dataset.ci}
function fmEdit(el,fn){const k=fmKey(el),m=(cur.fm=cur.fm||{}),f=m[k]=m[k]||{};fn(f);if(!f.s)delete f.s;if(f.b==null)delete f.b;if(!Object.keys(f).length)delete m[k]}
function mountEditor(){const doc=cur,g=$('#stage'),b=$('#etb');act=null;zm=1;hist=[];paint();updUndo();$('.zm').onclick=ev=>{const z=ev.target.closest('[data-z]');if(!z)return;zm=Math.max(.6,Math.min(2.4,z.dataset.z>0?zm*1.25:zm/1.25));fit()};
 const step=d=>{if(!act)return;const o=act.el.dataset.ed.startsWith('o:'),L=[...g.querySelectorAll('[data-ed]')].filter(x=>x.dataset.ed.startsWith('o:')===o),n=L[L.indexOf(act.el)+d];if(n)activate(n)};
 const re=id=>{const el=g.querySelector(`[data-ed="${id}"]`);if(el)activate(el)};
 g.onclick=ev=>{const t=ev.target,ed=t.closest('[data-ed]');
  if(ed){if(!act||act.el!==ed)activate(ed);return}
  const ck=t.closest('[data-ck]'),rc=t.closest('[data-rate]'),ad=t.closest('[data-add]'),af=t.closest('[data-addf]'),rf=t.closest('[data-restf]'),rr=t.tagName==='TR'?t.dataset.rr:null;
  if(ck){pushH();const a=doc.d[ck.dataset.ck],n=+ck.dataset.i;doc.d[ck.dataset.ck]=a.includes(n)?a.filter(x=>x!==n):[...a,n];paint()}
  else if(rc){pushH();const k=rc.dataset.rate,j=rc.dataset.j;doc.d[k]=String(doc.d[k])===j?'':j;paint()}
  else if(ad){pushH();const s=secs(doc.t).find(x=>x.key===ad.dataset.add),n=doc.d[s.key].push(s.c.map(()=>''));act=null;paint();re(`r:${s.key}:${n-1}:0`)}
  else if(rr){const[key,ri]=rr.split(':');pushH();doc.d[key].splice(+ri,1);act=null;paint();toast('Row deleted',undo,'Undo')}
  else if(af){pushH();const si=+af.dataset.addf,k='x'+uid();(doc.cf=doc.cf||[]).push({k,si});(doc.o=doc.o||{})['L:'+k]='New field';doc.d[k]='';act=null;paint();re('o:L:'+k);const el=g.querySelector(`[data-ed="o:L:${k}"]`);if(el)getSelection().selectAllChildren(el)}
  else if(rf){pushH();const ks=(TPL[doc.t].S[+rf.dataset.restf].f||[]).map(x=>Array.isArray(x)?x[0]:x);doc.hide=(doc.hide||[]).filter(k=>!ks.includes(k));act=null;paint()}
  else done()};
 g.oninput=ev=>{const el=ev.target.closest('[data-ed]');if(!el)return;if(act&&!act.dirty){act.dirty=1;hist.push(act.pre||snap());if(hist.length>80)hist.shift();updUndo()}const id=el.dataset.ed,v=id[0]==='o'?el.textContent:el.innerText.replace(/\n$/,'');
  if(id==='t'){doc.title=v;$('#ttl').value=v}else if(id[0]==='f')doc.d[id.slice(2)]=v;else if(id[0]==='o')(doc.o=doc.o||{})[id.slice(2)]=v;
  else{const r=doc.d[el.dataset.key][+el.dataset.ri];r[+el.dataset.ci]=v;const tt=el.closest('tr').querySelector('[data-tot]');
   if(tt&&tt!==el&&!r[+tt.dataset.ci])tt.textContent=r.filter(y=>/^[\u221A\u2713x]$/i.test(y)).length||''}
  doc.u=Date.now();queue()};
 g.onkeydown=ev=>{const el=ev.target.closest&&ev.target.closest('[data-ed]');if(!el)return;
  if(ev.key==='Enter'&&!el.dataset.ml){ev.preventDefault();step(1)}else if(ev.key==='Tab'){ev.preventDefault();step(ev.shiftKey?-1:1)}else if(ev.key==='Escape')done()};
 g.onpaste=ev=>{if(!ev.target.closest('[data-ed]'))return;ev.preventDefault();document.execCommand('insertText',false,(ev.clipboardData.getData('text')||'').replace(/\r?\n/g,el=>ev.target.dataset.ml?'\n':' '))};
 b.onmousedown=ev=>ev.preventDefault();
 b.onclick=ev=>{const t=ev.target.closest('[data-tb]');if(!t||!act)return;const k=t.dataset.tb,el=act.el,id=el.dataset.ed;
  if(k==='done')done();else if(k==='next')step(1);else if(k==='prev')step(-1);
  else if(k==='al'){pushH();doc.a[el.dataset.al]=t.dataset.a;paint();re(id)}
  else if(k==='b'){pushH();const cb=+getComputedStyle(el).fontWeight>=600;fmEdit(el,f=>{f.b=cb?0:1});paint();re(id)}
  else if(k==='sm'||k==='lg'){pushH();fmEdit(el,f=>{f.s=Math.max(-3,Math.min(6,(f.s||0)+(k==='lg'?1:-1)))});paint();re(id)}
  else if(k==='rs'){pushH();fmEdit(el,f=>{delete f.s});paint();re(id)}
  else if(k==='sig'){sigOpen(id.slice(2))}
  else if(k==='more'){ebx=!ebx;setBar()}
  else if(k==='sigdef'){const d0=defSig();if(d0){pushH();(doc.sg=doc.sg||{})[id.slice(2)]={id:d0.id,s:100};act=null;setBar();paint();toast('Default signature added')}}
  else if(k==='undo')undo();
  else if(k==='del'){pushH();doc.d[el.dataset.key].splice(+el.dataset.ri,1);act=null;paint();setBar();toast('Row deleted',undo,'Undo')}
  else if(k==='ins'){pushH();const key=el.dataset.key,ri=+el.dataset.ri,s=secs(doc.t).find(x=>x.key===key);doc.d[key].splice(ri+1,0,s.c.map(()=>''));act=null;paint();re(`r:${key}:${ri+1}:${el.dataset.ci}`)}
  else if(k==='delf'){pushH();const fk=id[0]==='f'?id.slice(2):id.slice(4),cf=doc.cf||[],i=cf.findIndex(c=>c.k===fk);if(i>=0){cf.splice(i,1);delete doc.d[fk];if(doc.o)delete doc.o['L:'+fk]}else(doc.hide=doc.hide||[]).push(fk);act=null;paint();setBar()}};
 $('#ttl').oninput=ev=>{doc.title=ev.target.value;const h=g.querySelector('[data-ed="t"]');if(h&&!h.classList.contains('on'))h.textContent=ev.target.value;doc.u=Date.now();queue()}}
/* Pinch / browser zoom is only allowed on documents & reports (editor 'ed' and preview 'pv'); every other page stays at 1x. */
const zoomOK=()=>view==='ed'||view==='pv';
function zoomGate(){const ok=zoomOK(),de=document.documentElement,m=document.querySelector('meta[name=viewport]');
 de.classList.toggle('zk',ok);
 if(m)m.setAttribute('content',ok?'width=device-width, initial-scale=1, viewport-fit=cover':'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')}
/* iOS Safari ignores user-scalable=no, so also block its pinch gesture and trackpad / ctrl+wheel / ctrl+plus zoom outside documents */
document.addEventListener('gesturestart',ev=>{if(!zoomOK())ev.preventDefault()},{passive:false});
document.addEventListener('gesturechange',ev=>{if(!zoomOK())ev.preventDefault()},{passive:false});
document.addEventListener('touchmove',ev=>{if(!zoomOK()&&ev.touches.length>1&&ev.cancelable)ev.preventDefault()},{passive:false});
addEventListener('wheel',ev=>{if(ev.ctrlKey&&!zoomOK())ev.preventDefault()},{passive:false});
addEventListener('keydown',ev=>{if((ev.ctrlKey||ev.metaKey)&&['+','=','-','_','0'].includes(ev.key)&&!zoomOK())ev.preventDefault()});
addEventListener('resize',()=>{if(view==='ed')fit();if(view==='home')fitThumbs()});
if(window.visualViewport){const vv=visualViewport;let q=0;
 /* keep the edit bar at its normal on-screen size and glued to the visible bottom, even while pinch-zoomed or with the keyboard open */
 const f=()=>{q=0;const b=$('#etb');if(!b)return;const s=vv.scale||1,de=document.documentElement,lw=de.clientWidth,lh=de.clientHeight;
  b.classList.toggle('vz',Math.abs(s-1)>.01);b.style.maxWidth='none';b.style.width=Math.min(560,vv.width)*s+'px';
  b.style.setProperty('--vs',String(1/s));b.style.setProperty('--vx',(vv.offsetLeft+vv.width/2-lw/2)+'px');b.style.setProperty('--vy',(vv.offsetTop+vv.height-lh)+'px')};
 const sch=()=>{if(!q)q=requestAnimationFrame(f)};
 vv.addEventListener('resize',sch);vv.addEventListener('scroll',sch);addEventListener('scroll',sch,{passive:true});
 new MutationObserver(sch).observe(document.body,{childList:true,subtree:true})}

/* ---------- header logos: per-document editor + shared logo library ---------- */
function addLogoFile(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,500/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(im.width*k));c.height=Math.max(1,Math.round(im.height*k));c.getContext('2d').drawImage(im,0,0,c.width,c.height);const id=uid();lib.push({id,src:c.toDataURL('image/png')});SV('dw.lib',lib);cb(id)};im.onerror=()=>toast('Could not read that image');im.src=r.result};r.readAsDataURL(f)}
function lgPanel(){let p=$('#lgp');if(!p){p=document.createElement('div');p.id='lgp';p.className='lgp';document.body.appendChild(p)}
 cur.lg=(cur.lg||[]).filter(l=>l.id==='dg'||lib.some(x=>x.id===l.id));
 const LI=lgItems(cur),n=LI.length;lgs=Math.max(0,Math.min(lgs,n-1));const sl=LI[lgs],used=new Set(cur.lg.map(l=>l.id)),
  av=[{id:'dg',src:DG},...lib].filter(l=>!used.has(l.id));
 p.innerHTML=`<div class="lgb" data-lg="close"></div><div class="lgs"><div class="lgh"><b>Header logos</b><button data-lg="close">Done</button></div><p class="lgn">${n?n+' logo'+(n==1?'':'s')+' on this document \u00b7 the header re-fits itself as you add or remove logos.':'No logos on this document \u00b7 the title takes the whole header.'}</p>
 <div class="lgr">${LI.map((l,i)=>`<button class="lgc${i===lgs?' sel':''}" data-lg="sel" data-i="${i}"><img src="${l.src}" alt=""></button>`).join('')}</div>
 ${sl?`<div class="lgx"><div class="lm"><button class="btn" data-lg="mv" data-d="-1"${lgs?'':' disabled'}>\u2190 Move left</button><button class="btn" data-lg="mv" data-d="1"${lgs<n-1?'':' disabled'}>Move right \u2192</button></div><label class="sz">Size <b id="lgv">${sl.s}%</b><input type="range" id="lgz" min="40" max="100" step="5" value="${sl.s}"></label><button class="btn d" data-lg="rm">Remove from this document</button></div>`:''}
 <h3>Add a logo</h3>${n>=MAXLG?`<p class="lgn">A document can carry up to ${MAXLG} logos.</p>`:`<div class="lgr">${av.map(l=>`<button class="lgc" data-lg="add" data-id="${l.id}"><img src="${l.src}" alt=""></button>`).join('')}<label class="lgc up"><span>+</span><small>Upload</small><input type="file" accept="image/*" hidden data-lgf="1"></label></div>`}</div>`}
document.addEventListener('click',ev=>{
 if(view==='ed'&&ev.target.closest('[data-lgo],[data-lg="open"]')&&!ev.target.closest('#lgp')){lgPanel();return}
 const b=ev.target.closest('#lgp [data-lg]');
 if(b&&view==='ed'){const a=b.dataset.lg,L=cur.lg;if(a!=='close'&&a!=='sel')pushH();
  if(a==='close'){$('#lgp').remove();return}
  if(a==='sel')lgs=+b.dataset.i;
  else if(a==='mv'){const j=lgs+ +b.dataset.d;if(j<0||j>=L.length)return;[L[lgs],L[j]]=[L[j],L[lgs]];lgs=j;paint()}
  else if(a==='rm'){L.splice(lgs,1);paint()}
  else if(a==='add'){if(L.length>=MAXLG)return;const it={id:b.dataset.id,s:100};if(it.id==='dg'){L.unshift(it);lgs=0}else{L.push(it);lgs=L.length-1}paint()}
  lgPanel();return}
 const dl=ev.target.closest('[data-libdel]');
 if(dl&&view==='set'&&confirm('Remove this logo from your library? Documents using it will no longer show it.')){lib=lib.filter(x=>x.id!==dl.dataset.libdel);SV('dw.lib',lib);render()}});
document.addEventListener('input',ev=>{if(ev.target.id!=='lgz'||view!=='ed'||!cur.lg[lgs])return;const v=+ev.target.value;cur.lg[lgs].s=v;const o=$('#lgv');if(o)o.textContent=v+'%';paint()});

/* ---------- signatures: import once, reuse on any signature field ---------- */
function addSigFile(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{
 const k=Math.min(1,700/im.width,350/im.height),w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k)),c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
 let px;try{px=x.getImageData(0,0,w,h)}catch{toast('Could not read that image');return}
 const p=px.data,L=new Uint8Array(w*h),hist=new Uint32Array(256);let hasA=false;
 for(let i=0,j=0;i<p.length;i+=4,j++){const a=p[i+3];if(a<250)hasA=true;const l=a<10?255:(p[i]*.299+p[i+1]*.587+p[i+2]*.114)|0;L[j]=l;hist[l]++}
 if(!hasA){ /* photo / scan: paper becomes transparent, ink stays (slightly deepened) */
  let bg=255,n=0;for(let l=0;l<256;l++){n+=hist[l];if(n>=w*h*.5){bg=l;break}}
  const hi=Math.max(60,bg-14),lo=Math.max(0,hi-85);
  for(let i=0,j=0;i<p.length;i+=4,j++){const l=L[j];p[i+3]=l>=hi?0:l<=lo?255:Math.round((hi-l)/(hi-lo)*255);p[i]=p[i]*.55|0;p[i+1]=p[i+1]*.55|0;p[i+2]=p[i+2]*.55|0}}
 let x0=w,y0=h,x1=-1,y1=-1;for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(p[(yy*w+xx)*4+3]>24){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy}
 if(x1<0){toast('No signature found - use dark ink on plain paper');return}
 x.putImageData(px,0,0);x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(w-1,x1+4);y1=Math.min(h-1,y1+4);
 const o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
 const id=uid();sigs.push({id,src:o.toDataURL('image/png')});SV('dw.sigs',sigs);if(!sigDef)setDef(id);cb(id)};
 im.onerror=()=>toast('Could not read that image');im.src=r.result};r.readAsDataURL(f)}
function sigOpen(k){sgk=k;sigPanel()}
function sigPanel(){let p=$('#sgp');if(!p){p=document.createElement('div');p.id='sgp';p.className='lgp';document.body.appendChild(p)}
 const T=resolveTpl(cur),g=cur.sg&&cur.sg[sgk],it=g&&sigs.find(x=>x.id===g.id);
 p.innerHTML=`<div class="lgb" data-sg="close"></div><div class="lgs"><div class="lgh"><b>Signature</b><button data-sg="close">Done</button></div><p class="lgn">For the \u201c${e((T.F[sgk]||{}).l||'Signature')}\u201d field. Import a photo or scan once: the paper is removed automatically and it is kept on this device for every report and form. Tap the star on a signature to make it your default.</p>
 ${it?`<div class="sgp0"><img src="${it.src}" alt="Signature"></div><div class="lgx"><label class="sz">Size <b id="sgv">${g.s||100}%</b><input type="range" id="sgz" min="50" max="200" step="10" value="${g.s||100}"></label><button class="btn d" data-sg="rm">Remove from this field</button></div>`:''}
 <h3>${sigs.length?'Your signatures':'Import a signature'}</h3><div class="lgr">${sigs.map(x=>`<span class="lgc sgc${it&&it.id===x.id?' sel':''}${x.id===sigDef?' isdef':''}"><button data-sg="use" data-id="${x.id}" aria-label="Use this signature"><img src="${x.src}" alt=""></button><button class="libx" data-sg="del" data-id="${x.id}" aria-label="Delete saved signature">\u00d7</button><button class="sgdf${x.id===sigDef?' on':''}" data-sg="def" data-id="${x.id}" aria-label="${x.id===sigDef?'Remove as default':'Set as default'}" aria-pressed="${x.id===sigDef}">\u2605</button>${x.id===sigDef?'<em class="dfl">Default</em>':''}</span>`).join('')}<label class="lgc up"><span>+</span><small>Import</small><input type="file" accept="image/*" hidden data-sgf="1"></label></div>
 <p class="lgn">Tip: sign in dark ink on plain white paper and photograph it in good light.</p></div>`}
document.addEventListener('click',ev=>{const b=ev.target.closest('#sgp [data-sg]');if(!b||view!=='ed')return;const a=b.dataset.sg;
 if(a==='close'){$('#sgp').remove();return}
 if(a==='use'){pushH();(cur.sg=cur.sg||{})[sgk]={id:b.dataset.id,s:(cur.sg[sgk]&&cur.sg[sgk].s)||100};act=null;setBar();paint()}
 else if(a==='rm'){pushH();if(cur.sg)delete cur.sg[sgk];act=null;setBar();paint()}
 else if(a==='def'){setDef(sigDef===b.dataset.id?null:b.dataset.id);toast(sigDef?'Default signature set':'Default removed')}
 else if(a==='del'){if(!confirm('Delete this saved signature? Fields using it will lose it.'))return;delSig(b.dataset.id);paint()}
 sigPanel()});
document.addEventListener('input',ev=>{if(ev.target.id!=='sgz'||view!=='ed'||!cur.sg||!cur.sg[sgk])return;const v=+ev.target.value;cur.sg[sgk].s=v;const o=$('#sgv');if(o)o.textContent=v+'%';paint()});
document.addEventListener('click',ev=>{const dl=ev.target.closest('[data-sigdel]');if(dl&&view==='set'&&confirm('Delete this saved signature? Fields using it will lose it.')){delSig(dl.dataset.sigdel);render()}});
document.addEventListener('click',ev=>{if(view!=='set')return;const c=ev.target.closest('[data-sgdef],[data-sgren]');if(!c)return;
 if(c.dataset.sgdef){setDef(sigDef===c.dataset.sgdef?null:c.dataset.sgdef);render();toast(sigDef?'Default signature set':'Default removed')}
 else{const x=sigs.find(q=>q.id===c.dataset.sgren);if(!x)return;const v=prompt('Name this signature',sgName(x,sigs.indexOf(x)));if(v!==null){x.n=v.trim().slice(0,40)||undefined;SV('dw.sigs',sigs);render()}}});
document.addEventListener('change',ev=>{if(ev.target.dataset&&ev.target.dataset.sgauto){sigAuto=ev.target.checked;SV('dw.sigauto',sigAuto);toast(sigAuto?'New documents will be signed automatically':'Automatic signing off')}});

/* ---------- views ---------- */
const IC={cfg:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',set:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 9"/></svg>',home:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/></svg>',files:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',back:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',th:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',bk:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg>',x:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>'};
const ago=t=>{const m=Math.round((Date.now()-t)/6e4);return m<1?'just now':m<60?m+' min ago':m<1440?Math.round(m/60)+' h ago':new Date(t).toLocaleDateString()};
const ini=()=>{const n=(ME.n||'').trim();return n?n.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase():IC.cfg};
const greet=()=>{const h=new Date().getHours(),g=h<12?'Good morning':h<17?'Good afternoon':'Good evening',n=(ME.n||'').trim().split(/\s+/)[0];return g+(n?', '+e(n):'')};
/* ---- v44: global header (logo, theme switch, profile picture) and the profile editor ---- */
const SVG=(p,w=20)=>`<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
Object.assign(IC,{sun:SVG('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),moon:SVG('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
 pen:SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',18),save:SVG('<path d="M5 12.5l4.5 4.5L19 7"/>',18),reset:SVG('<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/>',18),cam:SVG('<path d="M4 8h3l1.6-2h6.8L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.2"/>',18)});
let meEdit=null,meD=null;
const hasMe=()=>!!(ME.n||ME.r||ME.p||ME.m||ME.pic);
const avIn=(m=ME)=>m.pic?`<img src="${e(m.pic)}" alt="">`:((m.n||'').trim()?(m.n.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()):IC.cfg);
const thIc=()=>eff()==='dark'?IC.sun:IC.moon;
const bar=(l,r='')=>{const x=l===brand?'':l;return`<header class="top"><div class="tr1">${brand}<div class="sp"></div><button class="ib" id="thm" aria-label="Switch between light and dark">${thIc()}</button><button class="ib av" id="cfg" aria-label="Your profile and settings">${avIn()}</button></div>${x||r?`<div class="tr2">${x}<div class="sp"></div>${r}</div>`:''}</header>`};
const meSec=()=>{const ed=meEdit===null?!hasMe():meEdit;if(ed&&!meD)meD={...ME};if(!ed)meD=null;
 if(!ed)return`<section class="pane"><h3>Your details</h3><div class="mev"><span class="mea">${avIn()}</span><div class="mei"><b>${e(ME.n||'')}</b>${[ME.r,ME.p,ME.m].filter(Boolean).map(v=>`<span>${e(v)}</span>`).join('')}</div></div><div class="mea2"><button class="btn" id="meE" type="button">${IC.pen}<span>Edit</span></button><button class="btn" id="meR" type="button">${IC.reset}<span>Reset</span></button></div></section>`;
 const f=(l,k,t='text')=>`<label class="sfl">${l}<input type="${t}" data-md="${k}" value="${e(meD[k]||'')}" autocomplete="off"></label>`;
 return`<section class="pane"><h3>Your details</h3><p class="lead">Used for your greeting on Home and for emailing backups to you. Kept on this device only.</p><div class="mev"><span class="mea">${avIn(meD)}</span><div class="mei"><label class="btn">${IC.cam}<span>${meD.pic?'Change photo':'Add photo'}</span><input type="file" accept="image/*" hidden data-pic="1"></label>${meD.pic?'<button class="btn" id="mePx" type="button">Remove photo</button>':''}</div></div>${f('Full name','n')}${f('Role / title','r')}${f('Phone (WhatsApp)','p','tel')}${f('Email','m','email')}<div class="mea2"><button class="btn p" id="meS" type="button">${IC.save}<span>Save</span></button>${hasMe()?'<button class="btn" id="meC" type="button">Cancel</button><button class="btn" id="meR" type="button">'+IC.reset+'<span>Reset</span></button>':''}</div></section>`};
function picFile(f){const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{try{const c=document.createElement('canvas'),n=256,k=Math.min(im.naturalWidth,im.naturalHeight),sx=(im.naturalWidth-k)/2,sy=(im.naturalHeight-k)/2;c.width=c.height=n;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,n,n);x.drawImage(im,sx,sy,k,k,0,0,n,n);if(meD)meD.pic=c.toDataURL('image/jpeg',.85);render()}catch{toast('Could not use that picture')}URL.revokeObjectURL(u)};im.onerror=()=>{URL.revokeObjectURL(u);toast('Could not use that picture')};im.src=u}
document.addEventListener('input',ev=>{const k=ev.target.dataset&&ev.target.dataset.md;if(k&&meD)meD[k]=ev.target.value});
document.addEventListener('change',ev=>{const i=ev.target;if(i.dataset&&i.dataset.pic&&i.files&&i.files[0]){picFile(i.files[0]);i.value=''}});
document.addEventListener('click',ev=>{const t=ev.target.closest('#thm,#meE,#meS,#meC,#meR,#mePx');if(!t)return;
 if(t.id==='thm'){theme=eff()==='dark'?'light':'dark';SV('dw.theme',theme);applyTheme();document.querySelectorAll('#thm').forEach(b=>b.innerHTML=thIc());if(view==='cfg')render();return}
 if(t.id==='meE'){meEdit=true;meD={...ME};render();return}
 if(t.id==='meC'){meEdit=false;meD=null;render();return}
 if(t.id==='mePx'){if(meD){delete meD.pic;render()}return}
 if(t.id==='meR'){if(confirm('Clear your name, photo and contact details from this device?')){ME={};SV('dw.me',ME);AU.on=false;SV('dw.auto',AU);meEdit=null;meD=null;toast('Details reset');render();scrollTo({top:0})}return}
 if(t.id==='meS'&&meD){const d={};['n','r','p','m'].forEach(k=>{const v=String(meD[k]||'').trim();if(v)d[k]=v});if(meD.pic)d.pic=meD.pic;
  if(d.m&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.m)){toast('Check your email address');return}
  ME=d;SV('dw.me',ME);meEdit=false;meD=null;toast('Details saved');render();scrollTo({top:0})}});
IC.fd='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const BRAND=window.DG_UI||'danholsen-full.png';
const brand=`<div class="brand bp" id="home"><img class="bpi" src="${BRAND}" width="${Math.round(30*1600/364)}" height="30" decoding="sync" alt="Danholsen Global Services"><span class="bpv"></span><span class="bpw">WORKSPACE</span></div>`;
const nav=v=>`<nav class="nav"><button id="home" class="${v==='home'?'on':''}">${IC.home}<span>Home</span></button><button id="files" class="${v==='files'?'on':''}">${IC.files}<span>Files</span></button><button id="set" class="${v==='set'?'on':''}">${IC.set}<span>Library</span></button><button id="cfg" class="${v==='cfg'?'on':''}">${IC.cfg}<span>Settings</span></button></nav>`;
function applyTheme(){const h=document.documentElement;h.classList.add('nt');h.dataset.t=eff();const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=TC();requestAnimationFrame(()=>requestAnimationFrame(()=>h.classList.remove('nt')))}
/* ---------- home: quick actions, attention strip, filters, pinned ---------- */
let hf='all';
const isRep=d=>/report/i.test((TPL[d.t]||{}).n||''),
 isTd=d=>new Date(d.u).toDateString()===new Date().toDateString(),
 edited=d=>{try{const b=d.b||(()=>{const f=newDoc(d.t);return f.b})();return JSON.stringify([d.title,d.d])!==b||!!(d.sg&&Object.keys(d.sg).length)||!!(d.cf&&d.cf.length)}catch(_){return true}},
 unsig=d=>{try{if(!edited(d))return false;const T=resolveTpl(d),ks=Object.keys(T.F).filter(k=>/^sign(ature)?\s*$/i.test(T.F[k].l)&&!(d.hide||[]).includes(k));return ks.length>0&&!ks.some(k=>(d.sg&&d.sg[k])||String((d.d||{})[k]||'').trim())}catch(_){return false}},
 FL={all:()=>true,rep:isRep,form:d=>!isRep(d),td:isTd,us:unsig},
 STAR='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
 qi=p=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`,
 qa=()=>`<div class="qa"><button class="qb" data-qa="rep">${qi('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>')}<span>New report</span></button><button class="qb" data-qa="form">${qi('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>')}<span>New form</span></button><button class="qb" data-qa="files">${qi('<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>')}<span>Files</span></button><button class="qb" data-qa="bk">${qi('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>')}<span>Back up</span></button></div>`,
 att=n=>n?`<button class="bkbn att" data-qa="us"><span><b>${n} document${n>1?'s':''} not signed yet</b><small>Review and add signatures before sending.</small></span><i>Review</i></button>`:'',
 chips=(nt,nu)=>`<div class="chips" role="group" aria-label="Filter documents">${[['all','All'],['rep','Reports'],['form','Forms'],...(nt?[['td','Today',nt]]:[]),...(nu?[['us','Unsigned',nu]]:[])].map(([k,l,n])=>`<button class="chip${hf===k?' on':''}" data-hf="${k}" aria-pressed="${hf===k}">${l}${n?`<small>${n}</small>`:''}</button>`).join('')}</div>`,
 kindOf=k=>/timesheet/i.test((TPL[k]||{}).n||'')?'Timesheet':/report/i.test((TPL[k]||{}).n||'')?'Report':'Form',
 PLUS='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 shd=(id,t,s,r)=>`<div class="shd"><div><h2 class="sec"${id?` id="${id}"`:''}>${t}</h2>${s?`<p class="shs">${s}</p>`:''}</div>${r?`<span class="shr">${r}</span>`:''}</div>`,
 tcard=k=>{const t=TPL[k],rp=/report/i.test(t.n);return`<button class="drow tpc" type="button" data-n="${k}" data-kind="${rp?'rep':'form'}" aria-label="Create new ${e(t.n)}"><span class="mini tmn dth">${sheet(newDoc(k))}</span><span class="dtx"><b>${t.n}</b><span class="dmeta"><i class="kd">${kindOf(k)}</i><span>Tap to start</span></span></span><i class="dadd" aria-hidden="true">${PLUS}</i></button>`},
 card=(d,i)=>{const T=TPL[d.t]||{n:''},us=unsig(d);return`<div class="drow rcard" role="button" tabindex="0" data-o="${d.id}" data-s="${e((d.title+' '+T.n).toLowerCase())}" data-k="${isRep(d)?'rep':'form'}" data-td="${+isTd(d)}" data-us="${+us}" aria-label="Open ${e(d.title)}"><span class="mini tmn dth">${i<12?sheet(d):''}</span><span class="dtx"><b>${e(d.title)}</b><span class="dmeta"><i class="kd">${kindOf(d.t)}</i>${us?'<i class="kd warn">Unsigned</i>':''}<span>Edited ${ago(d.u)}</span></span>${d.title!==T.n?`<small class="dsub">${e(T.n)}</small>`:''}</span><span class="dact"><button class="ib dpin${d.pin?' on':''}" type="button" data-pin="${d.id}" aria-label="${d.pin?'Unpin':'Pin'} document" aria-pressed="${!!d.pin}">${STAR}</button><button class="ib ddel" type="button" data-x="${d.id}" aria-label="Delete document">${IC.x}</button></span></div>`};
function applyF(){const q=(($('#q')||{}).value||'').toLowerCase().trim(),f=FL[hf]||FL.all;let n=0;
 const rows=[...document.querySelectorAll('#rail .rcard')],rl=$('#rail');
 rows.forEach(r=>{const d=docs.find(x=>x.id===r.dataset.o),ok=!!d&&f(d)&&(!q||r.dataset.s.includes(q));r.style.display=ok?'':'none';r.classList.remove('lv');if(ok)n++});
 if(rl){if(q||hf!=='all')rl.dataset.all='1';else if(!rl.dataset.keep)delete rl.dataset.all;
  const v=rows.filter(r=>r.style.display!=='none'),shown=rl.dataset.all?v:v.slice(0,6);if(shown.length)shown[shown.length-1].classList.add('lv')}
 const fe=$('#fe');if(fe)fe.style.display=n||!docs.length?'none':''}
function render(){if(view!=='cfg'){meEdit=null;meD=null}document.documentElement.dataset.t=eff();document.querySelectorAll('#lgp,#sgp').forEach(q=>q.remove());{const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=TC()}const A=$('#app'),L=[...docs].sort((a,b)=>b.u-a.u),last=L[0];
 if(view==='home'){const NU=docs.filter(unsig).length,NT=docs.filter(isTd).length,PN=L.filter(d=>d.pin);if((hf==='us'&&!NU)||(hf==='td'&&!NT))hf='all';A.innerHTML=bar(brand)+`<main class="wrap"><h1 class="h1">${greet()}</h1><p class="sub">${new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>${bnr()}${qa()}${att(NU)}<input id="q" class="search" type="search" placeholder="Search reports and forms" aria-label="Search documents">${last?`<section class="cont" role="button" tabindex="0" data-o="${last.id}" aria-label="Open ${e(last.title)}"><div class="mini cpg">${sheet(last)}</div><div class="ci"><small>Continue editing</small><h2>${e(last.title)}</h2><p>${last.title===TPL[last.t].n?'':TPL[last.t].n+' \u00b7 '}Edited ${ago(last.u)}</p><button class="btn p" data-o="${last.id}">Open</button></div></section>`:''}${shd('newdoc','New document','Start from a Danholsen template',Object.keys(TPL).length+' templates')}<div id="ngrid">${[['Forms',k=>!/report|timesheet/i.test(TPL[k].n)],['Reports',k=>/report/i.test(TPL[k].n)],['Timesheets',k=>/timesheet/i.test(TPL[k].n)]].map(([g,f])=>{const ks=Object.keys(TPL).filter(f);return ks.length?`<div class="dgl"><span>${g}</span><em>${ks.length}</em></div><div class="dlist">${ks.map(tcard).join('')}</div>`:''}).join('')}</div>${PN.length?`${shd('','Pinned','Kept at the top for quick access',PN.length+' pinned')}<div class="dlist" id="prail">${PN.map((d,i)=>card(d,i)).join('')}</div>`:''}${shd('recent','Recent','Your latest reports and forms',L.length?L.length+(L.length==1?' document':' documents'):'')}${L.length?chips(NT,NU):''}<div class="dlist" id="rail">${L.length?L.map((d,i)=>card(d,i)).join(''):'<p class="empty">Nothing yet. Choose a template above to start.</p>'}</div>${L.length>6?`<button class="dmore" id="dmore" type="button">Show all ${L.length} documents</button>`:''}<p class="empty" id="fe" style="display:none">No documents match this filter.</p></main>`+nav('home');applyF()}
 if(view==='set'){A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">Library &amp; messages</h1>`)+`<main class="wrap"><div class="pane"><p class="lead">Every new document starts with the Danholsen logo on the left. Each document then carries its own logos - open a document and tap its header (or the Logos button) to add, remove, reorder or resize them. Save client and certification logos here so they are one tap away.</p><h3>Saved logos</h3><div class="libg"><div class="libc"><img src="${DG}" alt="Danholsen"><small>Default</small></div>${lib.map(l=>`<div class="libc"><img src="${l.src}" alt=""><button class="libx" data-libdel="${l.id}" aria-label="Remove logo">\u00d7</button></div>`).join('')}<label class="libc up"><span>+</span><small>Add logo</small><input type="file" accept="image/*" hidden data-libf="1"></label></div><h3>Saved signatures</h3><p class="lead">Import a signature once and keep as many as you need. Your <b>default</b> signature can be added to any Signature field with one tap (<b>Use default</b>), or placed automatically on new documents. The paper background is removed for you.</p><div class="sgl">${sigs.map((x,n)=>`<div class="sgcard${x.id===sigDef?' isdef':''}"><div class="sgpv"><img src="${x.src}" alt=""></div><div class="sgmeta"><b>${e(sgName(x,n))}</b>${x.id===sigDef?'<span class="dfb2">Default</span>':''}</div><div class="sgact"><button class="lgbtn" data-sgdef="${x.id}">${x.id===sigDef?'Remove default':'Set as default'}</button><button class="lgbtn" data-sgren="${x.id}">Rename</button><button class="lgbtn dn" data-sigdel="${x.id}">Delete</button></div></div>`).join('')}<label class="sgcard up"><span>+</span><b>Import signature</b><small>Photo or scan</small><input type="file" accept="image/*" hidden data-sglib="1"></label></div><label class="sgauto"><input type="checkbox" data-sgauto="1"${sigAuto?' checked':''}><span><b>Sign new documents automatically</b><small>Adds your default signature to the Danholsen signature field of each new report, timesheet and transmittal. The Job Completion Form is left for the client to sign.</small></span></label>${msgSet()}</div></main>`+nav('set')}
 if(view==='cfg'){const lb=LS('dw.lastbk',null);A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">Settings</h1>`)+`<main class="wrap"><div class="stk">${meSec()}<section class="pane"><h3>Appearance</h3><div class="seg" role="group" aria-label="Theme">${[['light','Light'],['dark','Dark'],['auto','Match phone']].map(([k,l])=>`<button data-th="${k}" class="${theme===k?'on':''}" aria-pressed="${theme===k}">${l}</button>`).join('')}</div></section><section class="pane"><h3>App updates</h3><div class="bkc"><div><b id="verl">${verText()}</b><small>The app updates itself when you are online. Tap to check right now.</small></div><button class="btn p" id="upd">Check for updates</button></div></section><section class="pane"><h3>Backup</h3><p class="lead">Your documents and logos live on this device. Export a backup file to keep them safe or move them to another phone or computer.</p><div class="bkc"><div><b>Export backup</b><small>${docs.length} document${docs.length==1?'':'s'} \u00b7 ${lib.length} saved logo${lib.length==1?'':'s'} \u00b7 ${sigs.length} signature${sigs.length==1?'':'s'} \u00b7 Last backup: ${lb?new Date(lb).toLocaleDateString():'never'}</small></div><button class="btn p" id="bkx">Export</button></div><div class="bkc"><div><b>Import backup</b><small>Adds documents from a backup file. Nothing on this device is deleted.</small></div><label class="btn">Import<input type="file" accept=".json,application/json" hidden data-bk="1"></label></div></section><section class="pane"><h3>Automatic backup</h3><p class="lead">A web app cannot run while it is closed, so this happens when you open the app and it has been a day since the last copy.</p><label class="tgl"><span><b>Email me a backup daily</b><small>${AU.on?(LS('dw.lastrelay',0)?'Last sent '+new Date(LS('dw.lastrelay',0)).toLocaleString():'Not sent yet'):'Off'}</small></span><input type="checkbox" data-au="on" ${AU.on?'checked':''}></label><p class="lead" style="margin-top:0">${ME.m?'Backups are sent to <b>'+e(ME.m)+'</b>.':'Add your email under Your details above first.'}</p><button class="btn" id="aut">Send test backup</button><label class="tgl"><span><b>Remind me when a backup is overdue</b><small>Shows a banner on Home after a day without a backup</small></span><input type="checkbox" data-au="remind" ${AU.remind?'checked':''}></label>${window.showDirectoryPicker?`<div class="bkc"><div><b>Save to a folder</b><small>${LS('dw.afname','')?'Folder: '+e(LS('dw.afname',''))+'. A copy is saved there daily. Pick a Google Drive or OneDrive folder to sync it.':'Computer only. Pick a Google Drive or OneDrive folder and a copy is saved there daily.'}</small></div><button class="btn" id="afd">${LS('dw.afname','')?'Change':'Choose'}</button></div>`:''}</section></div></main>`+nav('cfg')}
 if(view==='files'){const kf=d=>((d.pf||(d.d&&d.d.proj))||'').trim()||'Unfiled',names=[...new Set([...projs,...docs.map(kf)])],cnt=n=>docs.filter(d=>kf(d)===n).length,ls=fld?docs.filter(d=>kf(d)===fld).sort((a,b)=>b.u-a.u):[];
 A.innerHTML=bar(fld?`<button class="ib" id="fall" aria-label="All projects">${IC.back}</button><h1 class="h1 s">${e(fld)}</h1>`:brand)+`<main class="wrap">`+(fld?`<p class="sub">${ls.length} document${ls.length==1?'':'s'} \u00b7 tap one to open it</p>${fld!=='Unfiled'?'<div class="fact"><button class="lgbtn" data-rn="1">Rename folder</button><button class="lgbtn dn" data-dl="1">Delete folder</button></div>':''}${ls.length?ls.map(d=>`<div class="row frow" role="button" tabindex="0" data-o="${d.id}"><span class="fic">${IC.files}</span><div class="fmeta"><b>${e(d.title)}</b><small>${TPL[d.t].n} \u00b7 Edited ${ago(d.u)}</small></div><button class="lgbtn" data-mv="${d.id}">Move</button><button class="ib d" data-x="${d.id}" aria-label="Delete">${IC.x}</button></div>`).join(''):'<p class="empty">No documents in this project yet.</p>'}`:`<h1 class="h1">Files</h1><p class="sub">Your projects and their reports</p><div class="grid fgrid">${names.map(n=>`<button class="tile ftile" data-fo="${e(n)}"><span class="fi">${IC.fd}</span><b>${e(n)}</b><span>${cnt(n)} document${cnt(n)==1?'':'s'}</span></button>`).join('')}<button class="tile ftile fnew" id="nf"><span class="fi plus">+</span><b>New project</b><span>Create a folder</span></button></div>`)+`</main>`+nav('files')}
 if(view==='pv')A.innerHTML=bar(`<button class="ib" id="pvb" aria-label="Back to editing">${IC.back}</button><h1 class="h1 s">Preview</h1>`)+`<main class="wrap pvw"><p class="sub">${e(pvB?pvB.name:'')} \u00b7 exactly as it will print</p><div class="pvs" id="pvs"></div></main><div class="pvbar"><button class="btn" id="pvb2">Edit</button><button class="btn" id="pvsave">Save PDF</button><button class="btn p" id="pvsend">Send</button></div>`;
 if(view==='ed')A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><input id="ttl" value="${e(cur.title)}" aria-label="Document title">`,`<button class="btn p" id="pdf">Export PDF</button>`)+`<main class="wrap ew"><div class="ctx"><div class="cx1"><span class="sv ok" id="sv">Saved</span><span class="tp">Tap any text to edit</span></div><div class="cx2"><button class="lgbtn" id="undo" data-undo="1" disabled>Undo</button><button class="lgbtn" data-lg="open">Logos \u00b7 ${lgItems(cur).length}</button><span class="zm"><button data-z="-1" aria-label="Zoom out">\u2212</button><button data-z="1" aria-label="Zoom in">+</button></span></div></div><div class="stage" id="stage"></div></main><div class="etb" id="etb"></div>`;
 if(view==='ed')mountEditor();if(view==='pv')drawPv();if(view!==lv){lv=view;window.scrollTo(0,0)}if(view==='home')fitThumbs();zoomGate()}
document.addEventListener('input',ev=>{if(ev.target.id==='q')applyF()});
document.addEventListener('click',ev=>{const m=ev.target.closest('#dmore');if(!m)return;const r=$('#rail');if(r){r.dataset.all='1';r.dataset.keep='1';applyF()}m.remove()});
document.addEventListener('click',ev=>{if(view!=='home')return;const c=ev.target.closest('[data-hf],[data-qa],[data-pin]');if(!c)return;
 if(c.dataset.pin){ev.stopPropagation();const d=docs.find(x=>x.id===c.dataset.pin);if(d){d.pin=!d.pin;SV('dw.docs',docs);render();toast(d.pin?'Pinned':'Unpinned')}return}
 if(c.dataset.hf){hf=c.dataset.hf;document.querySelectorAll('.chip').forEach(x=>{const on=x.dataset.hf===hf;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});applyF();return}
 const k=c.dataset.qa;
 if(k==='files'){fld=null;view='files';render()}
 else if(k==='bk')exportBk();
 else if(k==='us'){hf='us';document.querySelectorAll('.chip').forEach(x=>{const on=x.dataset.hf===hf;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});applyF();const r=$('#recent');if(r)r.scrollIntoView({behavior:'smooth',block:'start'})}
 else if(k==='rep'||k==='form'){const g=$('#ngrid'),h=$('#newdoc');if(!g)return;g.dataset.hl=k;if(h)h.scrollIntoView({behavior:'smooth',block:'start'});clearTimeout(g._t);g._t=setTimeout(()=>delete g.dataset.hl,3200)}});
document.addEventListener('click',ev=>{const t=ev.target.closest('button,.row,.brand,.rcard,.cont');if(!t)return;const go=v=>{view=v;render()};
 if(t.id==='files'||t.id==='fall'){fld=null;go('files')}else if(t.dataset.fo){fld=t.dataset.fo;go('files')}
 else if(t.id==='nf'){const n=(prompt('Project name')||'').trim();if(n){if(!projs.includes(n)){projs.push(n);SV('dw.proj',projs)}fld=n;go('files')}}
 else if(t.dataset.rn){const n=(prompt('Rename folder',fld)||'').trim();if(n&&n!==fld){docs.forEach(d=>{if(fkey(d)===fld)d.pf=n});const i=projs.indexOf(fld);if(i>=0)projs.splice(i,1);if(!projs.includes(n))projs.push(n);SV('dw.docs',docs);SV('dw.proj',projs);fld=n;go('files')}}
 else if(t.dataset.dl){const mine=docs.filter(d=>fkey(d)===fld),n=mine.length;if(confirm('Delete the folder \u201c'+fld+'\u201d?'+(n?'\n\nIts '+n+' document'+(n>1?'s are':' is')+' not deleted. '+(n>1?'They move':'It moves')+' to Unfiled.':''))){const was=mine.map(d=>[d,d.pf]),op=projs.slice(),name=fld;mine.forEach(d=>d.pf='Unfiled');projs=projs.filter(x=>x!==name);SV('dw.docs',docs);SV('dw.proj',projs);fld=null;go('files');toast('Folder deleted',()=>{was.forEach(([d,p])=>{if(p===undefined)delete d.pf;else d.pf=p});projs=op;SV('dw.docs',docs);SV('dw.proj',projs);fld=name;go('files')})}}
 else if(t.dataset.mv){const d=docs.find(x=>x.id===t.dataset.mv);if(d){const n=prompt('Move "'+(d.title||'document')+'" to which project folder?',fld||'');if(n!==null){const m=n.trim();if(m){d.pf=m;if(!projs.includes(m)){projs.push(m);SV('dw.proj',projs)}}else delete d.pf;SV('dw.docs',docs);render()}}}
 else if(t.id==='pvb'||t.id==='pvb2'){view='ed';render()}
 else if(t.id==='pvsave'){DWPDF.save(pvB.blob,pvB.name).then(r=>{if(r==='downloaded')toast('PDF saved')})}
 else if(t.id==='pvsend')openSend();else if(t.dataset.snd)doSend(t.dataset.snd);else if(t.dataset.snx)closeSend();
 else if(t.id==='home')go(view==='ed'&&ret==='files'?'files':'home');else if(t.id==='set')go('set');
 else if(t.dataset.th){theme=t.dataset.th;SV('dw.theme',theme);applyTheme();render()}else if(t.id==='upd')checkNow(t)
 else if(t.dataset.n){ret='home';cur=newDoc(t.dataset.n);autoSign(cur);docs.push(cur);SV('dw.docs',docs);go('ed')}
 else if(t.dataset.x){ev.stopPropagation();if(confirm('Delete this document?')){docs=docs.filter(d=>d.id!==t.dataset.x);SV('dw.docs',docs);render()}}
 else if(t.dataset.o){cur=docs.find(d=>d.id===t.dataset.o);ret=view;go('ed')}
 else if(t.dataset.p){pane=t.dataset.p;$('.ed').dataset.v=pane}
 else if(t.id==='cfg')go('cfg');else if(t.id==='bkx')exportBk();
 else if(t.id==='pdf')openPreview(t)});
async function openPreview(btn){const lab=btn.textContent;btn.disabled=true;btn.textContent='Preparing\u2026';
 try{const LI=lgItems(cur),blob=await Promise.race([DWPDF.build(cur,{TPL,ST,resolve:resolveTpl,logos:LI.map(l=>l.src),lsz:LI.map(l=>l.s),sigs:Object.fromEntries(Object.entries(cur.sg||{}).map(([k,g])=>[k,{src:(sigs.find(x=>x.id===g.id)||{}).src,s:g.s||100}]).filter(([k,v])=>v.src))}),new Promise((_,rj)=>setTimeout(()=>rj(new Error('timed out - please try again')),40000))]);pvB={blob,name:cur.title||TPL[cur.t].n};view='pv';render()}
 catch(err){console.error(err);toast('Could not make the PDF: '+(err&&err.message||err))}
 finally{btn.disabled=false;btn.textContent=lab}}
document.addEventListener('change',ev=>{const i=ev.target,f=i.files&&i.files[0];if(!f)return;
 if(i.dataset.libf){addLogoFile(f,()=>render());i.value=''}
 else if(i.dataset.sgf&&view==='ed'){addSigFile(f,id=>{pushH();(cur.sg=cur.sg||{})[sgk]={id,s:100};act=null;setBar();paint();sigPanel()});i.value=''}
 else if(i.dataset.sglib){addSigFile(f,()=>render());i.value=''}
 else if(i.dataset.lgf&&view==='ed'){addLogoFile(f,id=>{pushH();if(cur.lg.length<MAXLG){cur.lg.push({id,s:100});lgs=cur.lg.length-1;paint()}lgPanel()})}});
function toast(m,fn,lab){document.querySelectorAll('.toast').forEach(x=>x.remove());const t=document.createElement('div');t.className='toast';t.textContent=m;if(fn){const k=document.createElement('button');k.textContent=lab||'Undo';k.onclick=()=>{t.remove();fn()};t.appendChild(k)}document.body.appendChild(t);setTimeout(()=>t.remove(),fn?6000:3000)}
/* ---------- send messages: saved wording, placeholders, remembered edits ---------- */
const MSG0={wa:'Good day {attention},\n\nPlease find attached {report} for your approval and records.\n\nRegards,\n{sender}\n{designation}',es:'{report}',eb:'Good day {attention},\n\nPlease find attached {report} for your approval and records.\n\nRegards,\n{sender}\n{designation}'};
let msgs=Object.assign({},MSG0,LS('dw.msgs',{}));
const PH=['report','attention','sender','designation','date'],PHD={report:'Document title',attention:'Attention field',sender:'Prepared by',designation:'Designation',date:"Today's date"};
const mtpl=k=>(msgs[k]&&String(msgs[k]).trim())?msgs[k]:MSG0[k];
const mvals=()=>{const d=(cur&&cur.d)||{};return{report:pvB?String(pvB.name||''):'',attention:d.att||'',sender:d.by||'',designation:d.des||'',date:new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}};
function fillMsg(t,v){return String(t).replace(/\{(report|attention|sender|designation|date)\}/g,(m,k)=>v[k]||'').replace(/[ \t]+([,.;:!?])/g,'$1').replace(/[ \t]{2,}/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim()}
function unfillMsg(edited,tpl,v){
 const K=['report','attention','sender','designation'],full=K.filter(k=>(v[k]||'').length>2).sort((a,b)=>v[b].length-v[a].length);
 const el=edited.split('\n'),ol=el.slice();
 full.forEach(k=>{for(let i=0;i<ol.length;i++)ol[i]=ol[i].split(v[k]).join('{'+k+'}')});
 const empt=K.filter(k=>!v[k]),tl=String(tpl).split('\n');let lastShown=-1;
 tl.forEach((L,i)=>{if(fillMsg(L,v))lastShown=i});
 tl.forEach((L,i)=>{if(!empt.some(k=>L.includes('{'+k+'}')))return;const rl=fillMsg(L,v);
  if(rl){const j=el.findIndex(x=>x.trim()===rl);if(j>-1)ol[j]=L}
  else if(i>lastShown&&!ol.includes(L))ol.push(L)});
 return ol.join('\n').trim()}
const fitTa=t=>{if(!t)return;t.style.height='auto';t.style.height=Math.min(t.scrollHeight+4,Math.round(innerHeight*.45))+'px'};
function keepEdit(kind){const v=mvals();let ch=0;
 const one=(key,val)=>{const t=mtpl(key);if(String(val).trim()!==fillMsg(t,v)&&String(val).trim()!==''){msgs[key]=unfillMsg(String(val),t,v);ch=1}};
 if(kind==='wa')one('wa',$('#sm').value);else{one('es',$('#ss').value);one('eb',$('#sb').value)}
 if(ch)SV('dw.msgs',msgs)}
function sendTab(k){const s=$('#snd');if(!s)return;s.dataset.t=k;s.querySelectorAll('[data-stab]').forEach(b=>b.classList.toggle('on',b.dataset.stab===k));s.querySelectorAll('[data-sp]').forEach(p=>p.hidden=p.dataset.sp!==k);s.querySelectorAll('textarea').forEach(fitTa);SV('dw.lastch',k)}
function resetMsg(k){const v=mvals();if(k==='wa'){msgs.wa=MSG0.wa;$('#sm').value=fillMsg(MSG0.wa,v);fitTa($('#sm'))}else{msgs.es=MSG0.es;msgs.eb=MSG0.eb;$('#ss').value=fillMsg(MSG0.es,v)||pvB.name;$('#sb').value=fillMsg(MSG0.eb,v);fitTa($('#sb'))}SV('dw.msgs',msgs);toast('Standard wording restored')}
const msgSet=()=>`<h3>Send messages</h3><p class="lead">This wording fills the Send box when you share a PDF. Tap a placeholder to insert it: it is replaced for each document, and anything left blank is skipped. If you change the wording while sending, the app remembers your version for next time.</p><div class="mph">${PH.map(k=>`<button type="button" class="mchip" data-ph="${k}" title="${PHD[k]}">{${k}}</button>`).join('')}</div><p class="snote">{report} = ${PHD.report} \u00b7 {attention} = ${PHD.attention} \u00b7 {sender} = ${PHD.sender} \u00b7 {designation} = ${PHD.designation} \u00b7 {date} = ${PHD.date}</p><label class="sfl">WhatsApp message<textarea data-mt="wa" rows="9">${e(msgs.wa)}</textarea></label><label class="sfl">Email subject<input data-mt="es" value="${e(msgs.es)}"></label><label class="sfl">Email message<textarea data-mt="eb" rows="9">${e(msgs.eb)}</textarea></label><button class="btn" data-mresetall="1">Restore standard wording</button>`;
let mtLast=null;
document.addEventListener('focusin',ev=>{if(ev.target.dataset&&ev.target.dataset.mt)mtLast=ev.target});
document.addEventListener('input',ev=>{const t=ev.target;if(!t||!t.dataset)return;
 if(t.dataset.mt&&view==='set'){msgs[t.dataset.mt]=t.value;SV('dw.msgs',msgs)}
 else if(t.id==='sm'||t.id==='sb')fitTa(t)});
document.addEventListener('click',ev=>{if(view!=='set')return;
 const p=ev.target.closest('[data-ph]');
 if(p){const t=(mtLast&&document.body.contains(mtLast))?mtLast:document.querySelector('[data-mt="eb"]');if(!t)return;const a=t.selectionStart??t.value.length,b=t.selectionEnd??a,tag='{'+p.dataset.ph+'}';t.value=t.value.slice(0,a)+tag+t.value.slice(b);t.focus();t.setSelectionRange(a+tag.length,a+tag.length);t.dispatchEvent(new Event('input',{bubbles:true}));return}
 if(ev.target.closest('[data-mresetall]')&&confirm('Restore the standard WhatsApp and email wording?')){msgs=Object.assign({},MSG0);SV('dw.msgs',msgs);render()}});

render();

/* ---------- auto-updating PWA: there is no version number to keep in step ----------
   The app fingerprints its own code files with conditional requests (unchanged files cost no data).
   If the fingerprint on the server differs from the one this page started with, it clears the offline
   cache and reloads, so the phone can never keep running an old copy or a mix of old and new files.
   version.json is only the label shown in Settings. Nothing in app.js or sw.js is bumped by hand. */
const CODE=['index.html','app.css','fonts.css','app.js','logo.js','pdf.js','publicsans-pdf.js','manifest.webmanifest'];
let VER='',FP0='',upd=false,swr=null,lastChk=0;
const busy=()=>view==='ed'||view==='pv',
 hashStr=t=>{let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)},
 verText=()=>'Version '+(VER||'\u2013')+(FP0?' \u00b7 build '+FP0:'');
async function fingerprint(){const parts=await Promise.all(CODE.map(u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw 0;return r.text()})));return hashStr(parts.join('\u0001'))}
async function loadVer(){try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();VER=String(j.v||'')}}catch{}const el=document.getElementById('verl');if(el)el.textContent=verText()}
async function chkUpd(force){if(!FP0||(!force&&Date.now()-lastChk<30e3))return upd;lastChk=Date.now();
 try{const f=await fingerprint();if(f!==FP0){upd=true;applyUpd()}return upd}catch{return null}}
async function doReload(manual){
 try{const t=+sessionStorage.getItem('dw.rlt')||0;if(!manual&&Date.now()-t<20e3)return;sessionStorage.setItem('dw.rlt',String(Date.now()))}catch{}
 try{if(swr)await swr.update()}catch{}
 try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch{}
 location.reload()}
function applyUpd(){if(!upd)return;
 if(busy()){if(!applyUpd.n){applyUpd.n=1;toast('A new version is ready',()=>doReload(true),'Refresh now')}return}
 doReload()}
fingerprint().then(f=>{FP0=f;const el=document.getElementById('verl');if(el)el.textContent=verText()}).catch(()=>{});loadVer();
if('serviceWorker'in navigator){
 let had=!!navigator.serviceWorker.controller;
 navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{swr=r;r.update().catch(()=>{})}).catch(()=>{});
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had){upd=true;applyUpd()}had=true});
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)chkUpd()});
addEventListener('focus',()=>chkUpd());addEventListener('online',()=>chkUpd(true));
setInterval(()=>chkUpd(),15*60e3);setInterval(()=>{if(upd&&!busy())applyUpd()},5e3);

document.addEventListener('click',ev=>{if(view==='ed'&&ev.target.closest('[data-undo]'))undo()});
document.addEventListener('keydown',ev=>{const c=ev.target.closest&&ev.target.closest('.rcard');if(c&&ev.target===c&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();c.click()}});

/* ---------- preview: draw the finished PDF pages exactly as they will print ---------- */
async function drawPv(){const box=$('#pvs');if(!box||!pvB)return;box.innerHTML='<p class="empty">Preparing preview\u2026</p>';
 try{const pj=await import('./pdf.min.mjs');pj.GlobalWorkerOptions.workerSrc='pdf.worker.min.mjs';
  const pdf=await pj.getDocument({data:new Uint8Array(await pvB.blob.arrayBuffer())}).promise;box.innerHTML='';
  const w=Math.min(box.clientWidth||340,820),dpr=Math.min(2,window.devicePixelRatio||1);
  for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),v0=pg.getViewport({scale:1}),v=pg.getViewport({scale:w/v0.width*dpr}),c=document.createElement('canvas');
   c.width=v.width;c.height=v.height;c.style.width=w+'px';c.style.height=(v.height/dpr)+'px';c.className='pvp';box.appendChild(c);
   await pg.render({canvasContext:c.getContext('2d'),viewport:v}).promise;
   const n=document.createElement('div');n.className='pvn';n.textContent='Page '+i+' of '+pdf.numPages;box.appendChild(n)}}
 catch(err){console.error(err);box.innerHTML='<p class="empty">Preview is not available here. You can still save or send the PDF.</p>'}}
/* ---------- send: WhatsApp / email ---------- */
const pkey=()=>((cur.pf||(cur.d&&cur.d.proj))||'').trim()||'Unfiled';
function closeSend(){const s=$('#snd');if(s)s.remove()}
function openSend(){closeSend();const c=ct[pkey()]||{},v=mvals(),wa=fillMsg(mtpl('wa'),v),es=fillMsg(mtpl('es'),v)||pvB.name,eb=fillMsg(mtpl('eb'),v),lc=LS('dw.lastch','wa')==='em'?'em':'wa',
 s=document.createElement('div');s.id='snd';s.className='snd';s.dataset.t=lc;
 s.innerHTML=`<div class="snb" role="dialog" aria-label="Send PDF"><div class="sgrip"></div><div class="sfile"><span class="sfi">PDF</span><div><b>${e(pvB.name)}</b><small>${Math.max(1,Math.round(pvB.blob.size/1024))} KB \u00b7 ready to send</small></div></div><div class="stabs"><button type="button" data-stab="wa" class="${lc==='wa'?'on':''}">WhatsApp</button><button type="button" data-stab="em" class="${lc==='em'?'on':''}">Email</button></div>
<div class="spn" data-sp="wa" ${lc==='wa'?'':'hidden'}><label class="sfl">WhatsApp number <small>with country code</small><input id="sn" type="tel" inputmode="tel" placeholder="2348012345678" value="${e(c.wa||'')}"></label><label class="sfl">Message<textarea id="sm" rows="8">${e(wa)}</textarea></label><button class="sbt wa" data-snd="wa">Send on WhatsApp</button><button type="button" class="mrs" data-mrs="wa">Restore standard wording</button></div>
<div class="spn" data-sp="em" ${lc==='em'?'':'hidden'}><label class="sfl">Email address<input id="se" type="email" placeholder="name@company.com" value="${e(c.em||'')}"></label><label class="sfl">Subject<input id="ss" type="text" value="${e(es)}"></label><label class="sfl">Message<textarea id="sb" rows="8">${e(eb)}</textarea></label><button class="sbt em" data-snd="em">Send by email</button><button type="button" class="mrs" data-mrs="em">Restore standard wording</button></div>
<p class="snote">Your wording changes are remembered for next time. You can set the standard wording in Library &amp; messages. On a phone this opens your share sheet with the PDF attached; on a computer the PDF is saved and the chat or email opens ready for you to attach it.</p><button class="btn" data-snx="1">Cancel</button></div>`;
 s.addEventListener('click',ev=>{if(ev.target===s){closeSend();return}const tb=ev.target.closest('[data-stab]');if(tb){sendTab(tb.dataset.stab);return}const rs=ev.target.closest('[data-mrs]');if(rs)resetMsg(rs.dataset.mrs)});
 document.body.appendChild(s);s.querySelectorAll('textarea').forEach(fitTa)}
async function doSend(kind){const num=($('#sn').value||'').replace(/\D/g,''),em=($('#se').value||'').trim(),msg=kind==='wa'?$('#sm').value:$('#sb').value,subj=($('#ss').value||'').trim()||pvB.name;keepEdit(kind);SV('dw.lastch',kind);
 ct[pkey()]={wa:num,em};SV('dw.ct',ct);
 const fn=(String(pvB.name).replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'document')+'.pdf',f=new File([pvB.blob],fn,{type:'application/pdf'});
 if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:kind==='wa'?pvB.name:subj,text:msg});closeSend();return}catch(err){if(err&&err.name==='AbortError')return}}
 await DWPDF.save(pvB.blob,pvB.name);closeSend();
 if(kind==='wa')window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg),'_blank');
 else location.href='mailto:'+encodeURIComponent(em)+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(msg);
 toast('PDF saved. Attach it in '+(kind==='wa'?'WhatsApp':'your email'))}

/* ---- v28: settings helpers, clickable continue card, system theme ---- */
document.addEventListener('keydown',ev=>{const c=ev.target.closest&&ev.target.closest('.cont[role=button]');if(c&&ev.target===c&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();c.click()}});
async function checkNow(b){const lab=b.textContent;b.disabled=true;b.textContent='Checking\u2026';
 try{const r=await chkUpd(true);if(r===null)toast('Could not check. Are you online?');
  else if(r){toast('Updating\u2026');setTimeout(()=>doReload(true),400)}
  else toast('You have the latest version'+(VER?' (v'+VER+')':''))}
 finally{b.disabled=false;b.textContent=lab}}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme==='auto'){applyTheme()}})}catch{}

/* ---- v32: automatic backup (email relay on open, reminder banner, synced folder) ---- */
const relayMsg=r=>r==='ok'?'Backup emailed to '+ME.m:r==='noem'?'Add your email under Your details first':r==='unk'?'Not confirmed. Will try again next time you open the app':String(r).startsWith('err:')?String(r).slice(4):'Could not send. Check your connection and try again';
async function sendRelay(test){
 if(!ME.m)return'noem';
 const body=JSON.stringify({key:RELAY_KEY,email:String(ME.m).trim(),name:bkName(),test:!!test,count:docs.length,backup:bkJSON()});
 try{const r=await fetch(RELAY_URL,{method:'POST',body,redirect:'follow'});const j=await r.json().catch(()=>null);if(j&&j.ok)return'ok';if(j&&j.error)return'err:'+j.error;return'unk'}
 catch{return'net'}}
const idb=()=>new Promise((res,rej)=>{const q=indexedDB.open('dw-bk',1);q.onupgradeneeded=()=>q.result.createObjectStore('k');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)});
const idbGet=async k=>{const d=await idb();return new Promise(r=>{const q=d.transaction('k').objectStore('k').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null)})};
const idbSet=async(k,v)=>{const d=await idb();return new Promise(r=>{const t=d.transaction('k','readwrite');t.objectStore('k').put(v,k);t.oncomplete=()=>r();t.onerror=()=>r()})};
async function folderBk(ask){try{const h=await idbGet('dir');if(!h)return false;let p=await h.queryPermission({mode:'readwrite'});if(p!=='granted'&&ask)p=await h.requestPermission({mode:'readwrite'});if(p!=='granted')return false;
 const fh=await h.getFileHandle(bkName(),{create:true}),w=await fh.createWritable();await w.write(bkJSON());await w.close();SV('dw.lastfold',Date.now());SV('dw.lastbk',Date.now());return true}catch{return false}}
let abBusy=false;
async function autoBk(){if(abBusy||!docs.length)return;abBusy=true;
 try{const due=k=>Date.now()-LS(k,0)>23*36e5;
  if(AU.on&&ME.m&&navigator.onLine&&due('dw.lastrelay')){const r=await sendRelay(false);if(r==='ok'){SV('dw.lastrelay',Date.now());SV('dw.lastbk',Date.now())}toast(relayMsg(r))}
  if(window.showDirectoryPicker&&due('dw.lastfold')){if(await folderBk(false))toast('Backup saved to your folder')}
 }catch{}finally{abBusy=false}}
document.addEventListener('input',ev=>{const k=ev.target.dataset&&ev.target.dataset.au;if(!k||ev.target.type==='checkbox')return;AU[k]=ev.target.value.trim();SV('dw.auto',AU)});
document.addEventListener('change',ev=>{const k=ev.target.dataset&&ev.target.dataset.au;if(!k||ev.target.type!=='checkbox')return;AU[k]=ev.target.checked;SV('dw.auto',AU);if(k==='on'&&AU.on){if(!ME.m){AU.on=false;SV('dw.auto',AU);toast('Add your email under Your details first')}else autoBk()}if(view==='cfg')render()});
document.addEventListener('click',async ev=>{const t=ev.target.closest('#bkn,#aut,#afd');if(!t)return;
 if(t.id==='bkn'){exportBk();return}
 if(t.id==='aut'){const lab=t.textContent;t.disabled=true;t.textContent='Sending\u2026';const r=await sendRelay(true);t.disabled=false;t.textContent=lab;toast(relayMsg(r));return}
 if(t.id==='afd'){try{const h=await showDirectoryPicker({mode:'readwrite'});await idbSet('dir',h);SV('dw.afname',h.name);SV('dw.lastfold',0);render();if(await folderBk(true))toast('Saved a copy to '+h.name)}catch(err){if(err&&err.name!=='AbortError')toast('Could not use that folder')}}});
setTimeout(autoBk,3000);addEventListener('online',autoBk);addEventListener('focus',()=>setTimeout(autoBk,1500));setInterval(autoBk,60*60e3);
