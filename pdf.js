'use strict';
/* Danholsen Workspace - direct PDF drawing.
   Every box, rule and text line is drawn by this file at a FIXED weight and a FIXED position.
   Nothing here depends on the browser's print engine, screen size, zoom or paper settings,
   so the PDF is identical on every phone and computer.
   Signing rows are always pinned to the bottom of the page. */
(function(){
const PAGES={letter:[612,792],a4:[595.28,841.89]};
const FMT={jcf:'letter',trn:'letter',tsh:'letter',mpi:'a4',ut:'a4'};   /* matches the six originals; change here to switch paper */
const LWT={hair:.5,thin:.75,line:1,rule:1.5,rep:.6};                  /* the ONLY line weights used, in points */
const K={ink:[0,0,0],grey:[217,217,217],lgrey:[242,242,242],dark:[59,59,59],amber:[242,169,0],hr:[191,191,191],white:[255,255,255]};
const TICK=/^\s*[√✓✔]\s*$/;

const clean=s=>String(s==null?'':s)
 .replace(/[‘’‛]/g,"'").replace(/[“”]/g,'"').replace(/[–—−]/g,'-').replace(/ /g,' ')
 .replace(/[√✓✔]/g,'OK')
 .replace(/[^\x09\x0A\x20-\x7E¡-ÿ]/g,c=>{const n=c.normalize('NFD').replace(/[̀-ͯ]/g,'');return /^[\x20-\x7E]$/.test(n)?n:'?'});
const titleCase=s=>String(s).replace(/\b([a-z])/g,c=>c.toUpperCase());

function loadLogos(list){
 return Promise.all(list.map(src=>new Promise(res=>{
  if(!src)return res(null);
  const done=v=>{clearTimeout(t);res(v)},t=setTimeout(()=>res(null),8000),im=new Image();
  im.onload=()=>{try{const k=Math.min(1,700/Math.max(im.naturalWidth,im.naturalHeight)),c=document.createElement('canvas');
   c.width=Math.max(1,Math.round(im.naturalWidth*k));c.height=Math.max(1,Math.round(im.naturalHeight*k));
   const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
   done({d:c.toDataURL('image/jpeg',.92),w:c.width,h:c.height})}catch(err){console.warn('logo skipped',err);done(null)}};   /* never leave the export waiting */
  im.onerror=()=>done(null);im.src=src}))); }

function loadPng(src){return new Promise(res=>{if(!src)return res(null);const t=setTimeout(()=>res(null),8000),im=new Image();im.onload=()=>{clearTimeout(t);res({d:src,w:im.naturalWidth,h:im.naturalHeight})};im.onerror=()=>{clearTimeout(t);res(null)};im.src=src})}

async function build(doc,ctx){
 const {TPL,ST}=ctx,T=(ctx.resolve||(x=>TPL[x.t]))(doc),d=doc.d,st=ST[doc.t],[PW,PH]=PAGES[FMT[doc.t]];
 const imgs=await loadLogos(ctx.logos),lsz=ctx.lsz||[],sgi={};
 await Promise.all(Object.entries(ctx.sigs||{}).map(async([k,v])=>{const r=await loadPng(v.src);if(r)sgi[k]={...r,s:v.s||100}}));
 const {jsPDF}=window.jspdf;
 const pdf=new jsPDF({unit:'pt',format:[PW,PH],compress:true});
 pdf.setProperties({title:doc.title||T.n,author:'Danholsen Global Services Limited',creator:'Danholsen Workspace'});
 const LW={jcf:LWT.line,trn:LWT.line,tsh:LWT.thin,mpi:LWT.rep,ut:LWT.rep}[doc.t];
 const UT=doc.t==='ut',MPI=doc.t==='mpi',REP=st==='rep';
 const ovl=(k,df)=>doc.o&&doc.o['L:'+k]!=null?doc.o['L:'+k]:df;   /* report label edited by the user, else the printed default */
 const al=(k,def)=>doc.a[k]||def;
 const FM=k=>(doc.fm&&doc.fm[k])||{},vs=(k,b)=>b+(FM(k).s||0),vb=(k,b)=>FM(k).b==null?b:!!FM(k).b;   /* per-field size / bold set in the editor */
 const V=k=>clean(d[k]);
 const lab=k=>{const l=T.F[k].l;return UT?l.toUpperCase():MPI?titleCase(l):l};

 /* ---- drawing primitives ---- */
 const fc=c=>pdf.setFillColor(c[0],c[1],c[2]),dc=c=>pdf.setDrawColor(c[0],c[1],c[2]),tc=c=>pdf.setTextColor(c[0],c[1],c[2]);
 const PS=!!(window.DW_FONT&&(()=>{try{pdf.addFileToVFS('PublicSans-Regular.ttf',DW_FONT.r);pdf.addFont('PublicSans-Regular.ttf','PublicSans','normal');pdf.addFileToVFS('PublicSans-Bold.ttf',DW_FONT.b);pdf.addFont('PublicSans-Bold.ttf','PublicSans','bold');return true}catch(err){console.warn('Public Sans not embedded, using Helvetica',err);return false}})());
 const font=(sz,b)=>{pdf.setFont(PS?'PublicSans':'helvetica',b?'bold':'normal');pdf.setFontSize(sz)};
 const line=(x1,y1,x2,y2,w=LW,c=K.ink)=>{dc(c);pdf.setLineWidth(w);pdf.line(x1,y1,x2,y2)};
 const box=(x,y,w,h,o={})=>{if(o.fill){fc(o.fill);pdf.rect(x,y,w,h,'F')}if(o.bd!==false){dc(K.ink);pdf.setLineWidth(o.lw??LW);pdf.rect(x,y,w,h,'S')}};
 const wrap=(s,w,sz,b)=>{font(sz,b);const out=[];
  String(s).split('\n').forEach(par=>{const toks=[];
   par.split(' ').forEach(wd=>{if(pdf.getTextWidth(wd)<=w){toks.push(wd);return}
    let cur='';for(const ch of wd){if(pdf.getTextWidth(cur+ch)>w){toks.push(cur);cur=ch}else cur+=ch}toks.push(cur)});
   const L=pdf.splitTextToSize(toks.join(' '),w);out.push(...(L.length?L:['']))});
  return out};
 const nl=(s,w,sz,b)=>wrap(clean(s),w,sz,b).length;
 const tick=(cx,cy,s)=>{dc(K.ink);pdf.setLineWidth(1.1);pdf.setLineCap('round');pdf.setLineJoin('round');
  pdf.lines([[s*.3,s*.35],[s*.6,-s*.8]],cx-s*.45,cy+s*.05,[1,1],'S');pdf.setLineCap('butt');pdf.setLineJoin('miter')};
 const cross=(x,y,s)=>{line(x+1.6,y+1.6,x+s-1.6,y+s-1.6,LWT.line);line(x+s-1.6,y+1.6,x+1.6,y+s-1.6,LWT.line)};
 const text=(s,x,by,sz,b,align,col)=>{font(sz,b);tc(col||K.ink);pdf.text(clean(s),x,by,{align:align||'left'})};
 /* text block inside a box: wraps, aligns, centres vertically (or top/bottom) */
 const put=(t,x,y,w,h,o={})=>{if(t==null||t==='')return;let sz=o.sz||10,pad=o.pad??4,L=wrap(clean(t),w-2*pad,sz,o.b);
  if(o.fit)while(sz>7&&L.length*sz*1.2>h-4){sz-=.5;L=wrap(clean(t),w-2*pad,sz,o.b)}
  const lh=sz*1.2,th=L.length*lh;
  const ty=o.va==='top'?y+pad:o.va==='bottom'?y+h-pad-th:y+(h-th)/2;
  font(sz,o.b);tc(o.fg||K.ink);
  L.forEach((s,i)=>{const a=o.al||'center',bx=a==='right'?x+w-pad:a==='left'?x+pad:x+w/2;
   pdf.text(s,bx,ty+i*lh+lh/2+sz*.34,{align:a})})};
 const cell=(x,y,w,h,o={})=>{box(x,y,w,h,o);
  if(o.tick&&TICK.test(String(o.t??'')))tick(x+w/2,y+h/2,Math.min(9,h*.55));else put(o.t,x,y,w,h,o)};
 const cellH=(t,w,o={})=>Math.max(o.min||0,nl(t,w-2*(o.pad??4),o.sz||10,o.b)*(o.sz||10)*1.2+2*(o.pad??4));
 /* "Label: value" inside a box (label bold, value regular) */
 const lv=(x,y,w,h,label,val,o={})=>{box(x,y,w,h,{lw:LW,fill:o.fill});const sz0=o.sz||10,sz=o.k?vs(o.k,sz0):sz0,vbd=o.k?vb(o.k,false):false,pad=o.pad??5;
  const lk=o.k?'h:L:'+o.k:'',lz=vs(lk,sz0),lb=vb(lk,true);font(lz,lb);const lw=pdf.getTextWidth(label)+4,vw=w-2*pad-lw,L=val?wrap(clean(val),Math.max(20,vw),sz,vbd):[],lh=sz*1.2,
   th=Math.max(1,L.length)*lh,ty=o.va==='bottom'?y+h-pad-th:y+(h-th)/2,by=ty+lh/2+sz*.34;
  text(label,x+pad,by,lz,lb);L.forEach((s,i)=>text(s,x+pad+lw,by+i*lh,sz,vbd));if(o.k)sig(o.k,x+pad+lw,y+2,w-2*pad-lw,h-4)};
 const bar=(x,y,w,h,t,o={})=>{box(x,y,w,h,{fill:o.fill||K.grey,lw:LW});put(t,x,y,w,h,{sz:o.sz||10,b:o.b??true,al:o.al||'center',fg:o.fg,pad:o.pad??6})};

 /* ---- logos ---- */
 const logoList=()=>imgs.map((im,i)=>im?{im,s:Math.max(.3,(lsz[i]||100)/100)}:null).filter(Boolean);
 const img=(o,x,y,w,h)=>pdf.addImage(o.im.d,'JPEG',x,y,w,h,undefined,'FAST');
 /* imported signature (transparent PNG) placed in the value area of a Signature field */
 const sig=(k,x,y,w,h)=>{const g=sgi[k];if(!g)return;const a=al(k,REP?'center':'left');let hh=Math.min(h*g.s/100,h*1.25),ww=g.w*hh/g.h;if(ww>w){ww=w;hh=g.h*ww/g.w}
  const xx=a==='right'?x+w-ww:a==='center'?x+(w-ww)/2:x,yy=y+(h-hh)/2;
  try{pdf.addImage(g.d,'PNG',xx,yy,ww,hh,undefined,'FAST')}catch(err){console.warn('signature skipped',err)}};
 const seqLogos=(x,y,maxW,h,gap=12)=>{const L=logoList();if(!L.length)return;
  const S=L.map(o=>{const hh=h*o.s;return{o,ww:o.im.w*hh/o.im.h,hh}}),tot=S.reduce((a,b)=>a+b.ww,0)+gap*(S.length-1),k=Math.min(1,maxW/tot);
  let cx=x;S.forEach(s=>{const ww=s.ww*k,hh=s.hh*k;img(s.o,cx,y+(h-hh)/2,ww,hh);cx+=ww+gap*k})};
 const cellLogos=(L,x,y,w,h,N)=>{N=N||L.length;if(!N)return;const cw=w/N;for(let i=1;i<N;i++)line(x+i*cw,y,x+i*cw,y+h,LW);
  L.forEach((o,i)=>{
   const r=Math.min((cw-10)*o.s/o.im.w,(h-8)*o.s/o.im.h),ww=o.im.w*r,hh=o.im.h*r;img(o,x+i*cw+(cw-ww)/2,y+(h-hh)/2,ww,hh)})};

 /* ---- grid helpers ---- */
 const pack=s=>{const it=s.f.map(x=>Array.isArray(x)?[...x]:[x,1]),R=[];let r=[],t=0;
  it.forEach(x=>{if(t+x[1]>s.n){r[r.length-1][1]+=s.n-t;R.push(r);r=[];t=0}r.push(x);t+=x[1]});
  if(r.length){r[r.length-1][1]+=s.n-t;R.push(r)}return R};

 /* ---- page geometry per form ---- */
 let L0,R0,top=36,pinBottom=PH-36,pinH=0,every=false,footY=null,y=0;
 if(doc.t==='jcf'){L0=36;R0=576;pinBottom=728;pinH=84;footY=748}
 if(doc.t==='trn'){L0=36.5;R0=576.5;pinBottom=756;pinH=196}
 if(doc.t==='tsh'){L0=36;R0=574;pinBottom=756;pinH=145}
 if(REP){L0=27;R0=571;top=31.3;pinBottom=PH-23.7;pinH=122;every=true}
 const W=R0-L0,pinTop=()=>pinBottom-pinH;
 const flowLimit=()=>every?pinTop()-10:(footY?footY-10:PH-36);

 /* ================= headers ================= */
 const header=()=>{
  if(doc.t==='jcf'){seqLogos(36,36,300,32);line(36,89.5,576,89.5,LWT.rule);
   {const a=al('h:t','left');text((doc.title||T.n).toUpperCase(),a==='center'?306:a==='right'?576:36,115,vs('h:t',16),vb('h:t',true),a)}
   text('JCF NO: '+(V('no')||''),576,114,vs('no',10),vb('no',true),'right');y=136}
  else if(doc.t==='trn'){const h=55;box(L0,36,270,h,{lw:LW});box(306.5,36,270,h,{lw:LW,fill:K.amber});
   seqLogos(44,42,254,43);put((doc.title||T.n).toUpperCase(),306.5,36,270,h,{sz:vs('h:t',15),b:vb('h:t',true),al:al('h:t','center'),fg:K.white});y=36+h}
  else if(doc.t==='tsh'){seqLogos(36,36,260,34);
   {const a=al('h:t','right');text((doc.title||T.n).toUpperCase(),a==='left'?L0:a==='center'?(L0+R0)/2:R0,56,vs('h:t',17),vb('h:t',true),a)}
   text(['Week '+V('wk'),V('from')&&V('to')?(V('from')+' to '+V('to')):''].filter(Boolean).join('   |   '),R0,71,8.5,false,'right',[90,90,90]);
   line(L0,84,R0,84,LWT.rule,K.amber);y=98}
  else{ /* report header: [logos] | title | [logos] - sized to however many logos THIS document carries.
           1 logo = [logo | title]; 2 = [logo | title | logo]; 3+ = logos split across both sides of the title. */
   const y0=31.3,h1=41,h2=Math.max(18,vs('h:L:date',10)*1.8,vs('h:L:no',9.5)*1.8),Ls=logoList(),n=Ls.length,nl=Math.ceil(n/2),nr=n-nl;
   const cw=n?Math.min(W*.25,W*.78/n):0,lz=n?nl*cw:W*.5,rz=nr*cw,tw=W-nl*cw-rz,tx=L0+nl*cw;
   box(L0,y0,W,h1,{lw:LW});
   if(nl){cellLogos(Ls.slice(0,nl),L0,y0,nl*cw,h1,nl);line(tx,y0,tx,y0+h1,LW)}
   put((doc.title||T.n).toUpperCase(),tx,y0,tw,h1,{sz:vs('h:t',n<=2?12:10),b:vb('h:t',true),al:al('h:t','center'),fit:true,pad:4});
   if(nr){line(tx+tw,y0,tx+tw,y0+h1,LW);cellLogos(Ls.slice(nl),tx+tw,y0,rz,h1,nr)}
   const yy=y0+h1,dl=clean(ovl('date','Report Date')),dz=(font(vs('date',10),vb('date',true)),(()=>{const vw=pdf.getTextWidth(clean(V('date')));let z=vs('h:L:date',10);font(z,vb('h:L:date',true));while(z>7&&pdf.getTextWidth(dl)+12>lz-vw-10){z-=.5;font(z,vb('h:L:date',true))}return z})()),c1=(font(dz,vb('h:L:date',true)),Math.max(pdf.getTextWidth(dl)+12,Math.min(lz-(font(vs('date',10),vb('date',true)),pdf.getTextWidth(clean(V('date'))))-14,lz*.6))),c3=Math.min(110+Math.max(0,vs('h:L:no',9.5)-9.5)*12,(W-lz)*.45);
   cell(L0,yy,c1,h2,{t:dl,b:vb('h:L:date',true),sz:dz,al:al('h:L:date','center')});cell(L0+c1,yy,lz-c1,h2,{t:V('date'),b:vb('date',true),sz:vs('date',10)});
   cell(L0+lz,yy,c3,h2,{t:ovl('no','Report Number'),b:vb('h:L:no',true),sz:vs('h:L:no',9.5),al:al('h:L:no','center')});cell(L0+lz+c3,yy,W-lz-c3,h2,{t:V('no'),b:vb('no',true),sz:vs('no',10)});
   y=yy+h2+10}
 };
 const footer=()=>{
  if(doc.t==='tsh'){line(L0,766,R0,766,LWT.hair,K.hr);text('Danholsen Global Services Limited   |   Weekly Timesheet   |   '+V('client'),L0,778,8,false,'left',[90,90,90]);return}
  if(doc.t!=='jcf')return;
  line(36,747.9,576,747.9,LWT.thin);const m=String(T.no).match(/^(.*?)\s*(Rev:.*)$/);
  text(m?m[1]:T.no,36,760,8.5,false);if(m)text(m[2],576,760,8.5,false,'right')};

 /* ================= pinned signing blocks (always at the bottom) ================= */
 const pinned=()=>{const s=T.S.find(x=>x.k==='sl'||x.k==='bx'||x.k==='sx');if(!s)return;const t0=pinTop();
  if(s.k==='sl'){const B=pinBottom;text(s.t.toUpperCase(),36,B-84+4,10.5,true);
   const rows=[[s.f[0],s.f[1]],[s.f[2],s.f[3]]];
   rows.forEach((r,i)=>{const ly=i?B:B-54;
    [[r[0],36,281],[r[1],321,566]].forEach(([k,x1,x2])=>{line(x1,ly,x2,ly,LWT.thin);
     const lb=T.F[k].l.toUpperCase()+':';text(lb,x1,ly-4,10,true);font(10,true);const w=pdf.getTextWidth(lb);
     put(d[k],x1+w+4,ly-17,x2-x1-w-6,16,{sz:vs(k,10.5),b:vb(k,false),al:al(k,'left'),pad:0,va:'bottom'});sig(k,x1+w+4,ly-(i?52:27),x2-x1-w-6,i?50:26)})})}
  else if(s.k==='bx'&&doc.t==='trn'){const cw=270,x0=36.5;
   s.cols.forEach((c,ci)=>{const x=x0+ci*cw;let yy=t0;
    box(x,yy,cw,32,{fill:K.amber,lw:LW});put(c.t.toUpperCase(),x,yy,cw,32,{sz:9.5,b:true,fg:K.white});yy+=32;
    c.f.forEach((k,i)=>{const h=i<3?28:80,l=T.F[k].l+': ';box(x,yy,cw,h,{lw:LW});
     font(10,false);const w=pdf.getTextWidth(l),by=i<3?yy+h/2+3.4:yy+h-8;
     text(l,x+7,by,10,false);put(d[k],x+7+w,yy,cw-14-w,h,{sz:vs(k,10),b:vb(k,false),al:'left',pad:0,va:i<3?'middle':'bottom'});sig(k,x+7+w,yy+3,cw-14-w,h-6);yy+=h})})}
  else if(s.k==='bx'){const x0=38,lw=114,cw=(573-38-lw)/2,hh=[23,26,22,22,52];let yy=t0;
   box(x0,yy,lw,hh[0],{lw:LW,fill:K.lgrey});put('SIGN-OFF',x0,yy,lw,hh[0],{sz:8.5,b:true,al:'left',pad:6});
   s.cols.forEach((c,ci)=>{const x=x0+lw+ci*cw;box(x,yy,cw,hh[0],{lw:LW,fill:K.amber});
    put((ci?(V('client')||c.t):c.t).toUpperCase(),x,yy,cw,hh[0],{sz:10,b:true,fg:K.white})});yy+=hh[0];
   s.cols[0].f.forEach((k,i)=>{const h=hh[i+1];box(x0,yy,lw,h,{lw:LW,fill:K.lgrey});put(T.F[k].l.toUpperCase(),x0,yy,lw,h,{sz:8.5,b:true,al:'left',pad:6});
    s.cols.forEach((c,ci)=>{const x=x0+lw+ci*cw;box(x,yy,cw,h,{lw:LW});put(d[c.f[i]],x,yy,cw,h,{sz:vs(c.f[i],10),b:vb(c.f[i],false),al:al(c.f[i],'left'),pad:7});sig(c.f[i],x+7,yy+2,cw-14,h-4)});yy+=h})}
  else if(s.k==='sx'){const cw=[64,120,120,120,120],sxi=T.S.indexOf(s),kl='h:X:leadL:'+sxi,kt='h:X:th:'+sxi;
   const xs=[L0];cw.forEach((v,i)=>xs.push(xs[i]+v));const hh=18,RH=[25,25,54],oy=r=>RH.slice(0,r).reduce((a,b)=>a+b,0);
   cell(xs[0],t0,cw[0],hh,{t:titleCase(s.leadL),b:vb(kl,true),sz:vs(kl,9.5),al:al(kl,'center')});cell(xs[1],t0,cw[1],hh,{t:s.th.toUpperCase(),b:vb(kt,true),sz:vs(kt,9.5),al:al(kt,'center')});
   s.P.forEach((p,i)=>cell(xs[2+i],t0,cw[2+i],hh,{t:String(d[p[0]]||'').toUpperCase(),b:vb(p[0],true),sz:vs(p[0],9.5)}));
   cell(xs[0],t0+hh,cw[0],oy(3),{t:d[s.lead],sz:vs(s.lead,10),b:vb(s.lead,false)});
   for(let r=0;r<3;r++){const yy=t0+hh+oy(r),rh=RH[r],k=s.tech[r];
    lv(xs[1],yy,cw[1],rh,T.F[k].l+':',d[k],{k});
    s.P.forEach((p,i)=>lv(xs[2+i],yy,cw[2+i],rh,T.F[p[1+r]].l+':',d[p[1+r]],{k:p[1+r]}))}}
 };

 /* ================= page flow ================= */
 const finishPage=()=>{if(every)pinned();footer()};
 const contHeader=()=>{seqLogos(36,28,120,20);text((doc.title||T.n).toUpperCase()+' (continued)',R0,38,9,true,'right');
  text(['Week '+V('wk'),V('client'),V('proj')].filter(x=>x&&x!=='Week ').join('   |   '),R0,50,8,false,'right',[90,90,90]);line(L0,58,R0,58,LWT.thin,K.amber);y=70};
 const newPage=()=>{finishPage();pdf.addPage([PW,PH]);y=top;if(every)header();else if(doc.t==='tsh')contHeader();else y=36};
 const need=h=>{if(y+h>flowLimit())newPage()};

 /* ---- generic table ---- */
 const table=(s,o={})=>{
  const cols=s.c.map((c,i)=>({h:c[0],w:c[1],h0:c[2]||c[0]})),sum=cols.reduce((a,c)=>a+c.w,0),extra=o.sn?o.sn:0;
  const tw=W-extra,ws=o.widths||cols.map(c=>c.w*tw/sum),
   all=(o.sn?[o.sn]:[]).concat(ws),hdrs=(o.sn?['S/N']:[]).concat(cols.map(c=>c.h));
  let hz=o.hsz||9.5;const bz=o.bsz||10,pad=o.pad??4,hasGrp=!REP?false:cols.some((c,i)=>/^accept$/i.test(c.h0)&&/^reject$/i.test(((cols[i+1]||{}).h0)||''));
  const hdrText=h=>REP?(UT?h.toUpperCase():titleCase(h)):doc.t==='trn'?h:h.toUpperCase();
  {let k=1;hdrs.forEach((h,i)=>{font(hz,!o.hplain);String(hdrText(h)).split(/\s+/).forEach(wd=>{const ww=pdf.getTextWidth(clean(wd));if(ww>0)k=Math.min(k,(all[i]-6)/ww)})});hz=Math.max(7,hz*Math.min(1,k)-.01)}
  let hh=Math.max(o.hmin||18,...hdrs.map((h,i)=>cellH(hdrText(h),all[i],{sz:hz+(FM('h:C:'+s.key+':'+(o.sn?i-1:i)).s||0),b:!o.hplain,pad:3})));
  if(hasGrp)hh=Math.max(hh,2*16);
  const tot=cols.findIndex(c=>/^total/i.test(c.h0));
  const rowsData=d[s.key].map(r=>{const rr=cols.map((c,i)=>{let x=r[i]??'';if(i===tot&&!x)x=r.filter(v=>/^[√✓x]$/i.test(v)).length||'';return String(x)});return o.sn?[null].concat(rr):rr});
  const CF=ci=>FM('c:'+s.key+':'+ci),cz=ci=>bz+(CF(ci).s||0),cbd=(ci,base)=>CF(ci).b==null?base:!!CF(ci).b;   /* per-column size / bold from the editor */
  const rh=r=>Math.max(o.rmin||14.5,...r.map((v,i)=>v==null?0:cellH(v,all[i],{sz:cz(o.sn?i-1:i),b:cbd(o.sn?i-1:i,o.bold||(o.boldCols&&o.boldCols[i])),pad})));
  const hk=i=>'h:C:'+s.key+':'+(o.sn?i-1:i),ho=i=>({sz:hz+(FM(hk(i)).s||0),b:vb(hk(i),!o.hplain),al:al(hk(i),'center')});
  const drawHdr=(yy)=>{let x=L0;
   hdrs.forEach((h,i)=>{const w=all[i],isAcc=hasGrp&&/^accept$/i.test(h)&&hdrs[i+1]&&/^reject$/i.test(hdrs[i+1]),isRej=hasGrp&&/^reject$/i.test(h);
    const fill=o.hfill!==undefined?o.hfill:REP?K.grey:K.dark,fg=(REP||o.hfill===null)?K.ink:K.white;
    if(hasGrp&&isAcc){cell(x,yy,w+all[i+1],hh/2,{t:'Result',...ho(i),fill,fg});cell(x,yy+hh/2,w,hh/2,{t:hdrText(h),...ho(i),fill,fg,pad:3})}
    else if(isRej)cell(x,yy+hh/2,w,hh/2,{t:hdrText(h),...ho(i),fill,fg,pad:3});
    else cell(x,yy,w,hh,{t:hdrText(h),...ho(i),fill,fg,pad:3,va:o.hva});
    x+=w})};
  need(hh+(rowsData[0]?rh(rowsData[0]):0));drawHdr(y);y+=hh;
  rowsData.forEach((r,ri)=>{const h=rh(r);if(y+h>flowLimit()){newPage();if(o.repeat){drawHdr(y);y+=hh}}let x=L0;
   r.forEach((v,i)=>{const w=all[i],ci=o.sn?i-1:i;
    if(v==null){cell(x,y,w,h,{t:ri+1,sz:bz,al:'center',pad})}
    else{const def=(o.align&&o.align[ci])||(REP?'center':'center'),key=s.key+'.'+ci;
     cell(x,y,w,h,{t:v,sz:cz(ci),b:cbd(ci,o.bold||(o.boldCols&&o.boldCols[ci])),al:al(key,def),pad,tick:true,va:o.va,fill:o.fillBody})}
    x+=w});y+=h});
  if(o.totals&&tot>=0){const col=o.sn?tot+1:tot,sum_=rowsData.reduce((a,r)=>a+(parseFloat(r[col])||0),0),h=24;
   if(y+h>flowLimit()){newPage();if(o.repeat){drawHdr(y);y+=hh}}
   const lw_=all.slice(0,col).reduce((a,v)=>a+v,0);
   cell(L0,y,lw_,h,{t:o.totals,b:true,sz:9,fill:K.lgrey,al:'right',pad:8});cell(L0+lw_,y,all[col],h,{t:String(sum_),b:true,sz:10,fill:K.lgrey});y+=h}};

 /* ================= sections ================= */
 const hS=s=>'h:S:'+T.S.indexOf(s);
 const heading=(t,hk)=>{if(!t)return;
  if(doc.t==='trn'){need(22);box(L0,y,W,22,{fill:K.dark,lw:LW});put(titleCase(t),L0,y,W,22,{sz:10,b:true,al:'left',pad:8,fg:K.white});y+=22}
  else if(REP){const z=vs(hk,10),h_=Math.max(14,z*1.45);need(h_);bar(L0,y,W,h_,t,{sz:z,b:vb(hk,true),al:al(hk,'center')});y+=h_}
  else if(doc.t==='jcf'){need(39);text(t.toUpperCase(),L0+W/2,y+24,10.5,true,'center');y+=39}
  else if(doc.t==='tsh'){y+=12;need(22+30);box(L0,y,W,22,{fill:K.dark,lw:LW});put(t.toUpperCase(),L0,y,W,22,{sz:9.5,b:true,al:'left',pad:8,fg:K.white});y+=22}};

 const sections={
  jh(){},
  lr(s){s.f.forEach(k=>{const l=T.F[k].l.replace(/\s*\/\s*/g,'/').replace(/\.$/,'').toUpperCase()+':',v=clean(d[k]).toUpperCase(),
    h=Math.max(19.6,nl(v,W-139,vs(k,10.5),vb(k,false))*vs(k,10.5)*1.2+7);need(h);
    text(l,36,y+h/2+3.6,10.5,true);put(v,175,y,W-139,h,{sz:vs(k,10.5),b:vb(k,false),al:al(k,'left'),pad:0});line(L0,y+h,R0,y+h,LWT.hair,K.hr);y+=h})},
  rt(s){y+=0;heading(s.t,hS(s));const cw=[35,205,75,85,70,70];
   need(31.7+28);let x=L0;['S/N','DESCRIPTION'].concat(s.o.map(o=>o.toUpperCase())).forEach((h,i)=>{cell(x,y,cw[i],31.7,{t:h,b:true,sz:8.5,fill:K.dark,fg:K.white,pad:3});x+=cw[i]});y+=31.7;
   s.f.forEach((k,i)=>{const t=T.F[k].l.toUpperCase(),h=Math.max(28,cellH(t,cw[1],{sz:9.5,b:true,pad:5}));need(h);x=L0;
    cell(x,y,cw[0],h,{t:i+1,sz:10});x+=cw[0];cell(x,y,cw[1],h,{t,b:true,sz:9.5,al:'left',pad:6});x+=cw[1];
    s.o.forEach((o,j)=>{box(x,y,cw[2+j],h,{lw:LW});if(String(d[k])===String(j)){fc(K.ink);pdf.circle(x+cw[2+j]/2,y+h/2,4.2,'F')}x+=cw[2+j]});y+=h});y+=26},
  g(s){
   if(doc.t==='trn'||doc.t==='tsh'){const u=W/s.n,LWd=doc.t==='trn'?90:86;
    let rowsP=pack(s);
    if(doc.t==='tsh'&&s.f.some(f=>(Array.isArray(f)?f[0]:f)==='wk')){ /* week / from / to strip */
     const hh=26,cs=[44,54,50,150,32,208];need(hh);let x=L0;
     [['WEEK',0],['',1,'wk'],['FROM',0],['',1,'from'],['TO',0],['',1,'to']].forEach((c,i)=>{
      if(c[1])cell(x,y,cs[i],hh,{t:V(c[2]),sz:vs(c[2],10),b:vb(c[2],false),al:c[2]==='wk'?'center':al(c[2],'left'),pad:6});
      else cell(x,y,cs[i],hh,{t:c[0],b:true,sz:8.5,fill:K.lgrey,al:'left',pad:6});x+=cs[i]});y+=hh+8;
     rowsP=rowsP.slice(1)}
    rowsP.forEach(r=>{const rowW=r.reduce((a,x)=>a+x[1]*u,0);let h=26;
     r.forEach(([k,sp])=>{const w=sp*u,lw_=Math.min(LWd,w*.45);h=Math.max(h,cellH(V(k),w-lw_,{pad:7,sz:vs(k,10),b:vb(k,false)}),cellH(doc.t==='tsh'?lab(k).toUpperCase():titleCase(T.F[k].l),lw_,{b:true,pad:7}))});
     need(h);let x=L0;
     r.forEach(([k,sp])=>{const w=sp*u,lw_=Math.min(LWd,w*.45);
      cell(x,y,lw_,h,{t:doc.t==='tsh'?T.F[k].l.toUpperCase():titleCase(T.F[k].l),b:true,sz:doc.t==='tsh'?8.5:10,al:'left',pad:7,fill:K.lgrey});
      cell(x+lw_,y,w-lw_,h,{t:V(k),al:al(k,'left'),pad:7,sz:vs(k,10),b:vb(k,false)});x+=w});y+=h});
    y+=doc.t==='tsh'?0:0;return}
   /* report grids: label row (grey) + value row */
   const t0=s.t0??s.t,showBar=s.t&&MPI&&t0!=='Conditions'&&t0!=='Magnetisation and consumables';
   if(MPI&&t0==='Magnetisation and consumables'){consumables(s);return}
   if(showBar)heading(s.t,hS(s));
   let f=s.f.filter(x=>!(['date','no'].includes(Array.isArray(x)?x[0]:x)));
   const ss={n:s.n,f};
   pack(ss).forEach(r=>{const u=W/s.n;let lh_=15,vh=20;
    r.forEach(([k,sp])=>{lh_=Math.max(lh_,cellH(lab(k),sp*u,{sz:vs('h:L:'+k,9.5),b:vb('h:L:'+k,true),pad:3}));vh=Math.max(vh,cellH(V(k),sp*u,{pad:3,sz:vs(k,10),b:vb(k,false)}))});
    need(lh_+vh);let x=L0;
    r.forEach(([k,sp])=>{const w=sp*u;cell(x,y,w,lh_,{t:lab(k),b:vb('h:L:'+k,true),sz:vs('h:L:'+k,9.5),al:al('h:L:'+k,'center'),fill:K.grey,pad:3});cell(x,y+lh_,w,vh,{t:V(k),al:al(k,'center'),pad:3,b:vb(k,false),sz:vs(k,10)});x+=w});y+=lh_+vh})},
  ck(s){if(doc.t==='trn'){heading(s.t,hS(s));const h=28;need(h);box(L0,y,W,h,{lw:LW});
    const items=s.o.map(o=>{o=titleCase(o);font(10,false);return{o,w:9+5+pdf.getTextWidth(clean(o))}}),tot=items.reduce((a,b)=>a+b.w,0),gap=(W-16-tot)/(items.length-1);let x=L0+8;
    items.forEach((it,i)=>{const on=(d[s.key]||[]).includes(i);box(x,y+h/2-4.5,9,9,{lw:LWT.thin});if(on)cross(x,y+h/2-4.5,9);text(it.o,x+14,y+h/2+3.4,10,false);x+=it.w+gap});y+=h;return}
   heading(s.t+' (mark with an [x])',hS(s));const h=17,cw=W/s.o.length;need(h);let x=L0;
   s.o.forEach((o,i)=>{const tw=22,kk='h:K:'+s.key+':'+i;cell(x,y,cw-tw,h,{t:o,sz:vs(kk,10),b:vb(kk,false),al:al(kk,'center'),pad:2});cell(x+cw-tw,y,tw,h,{t:(d[s.key]||[]).includes(i)?'X':'',b:true,sz:10});x+=cw});y+=h},
  tb(s){
   if(doc.t==='jcf'){const w=[35,135,85,150,135];s.c=s.c;table(s,{sn:35,widths:w.slice(1),hmin:20.8,hsz:8.5,rmin:33,bsz:9,pad:5,align:['left','center','left','center'],boldCols:[true],va:'middle'});y+=0;return}
   if(doc.t==='trn'){table(s,{widths:[45,157.5,135,45,67.5,45,45],hmin:24,hsz:9.5,rmin:32,align:['center','left','center','center','center','center','center']});return}
   if(doc.t==='tsh'){heading(s.t,hS(s));table(s,{hmin:30,rmin:26,hsz:8.5,bsz:9.5,align:['left'],repeat:true,totals:'TOTAL DAYS'});return}
   if(s.t&&(MPI||(UT&&s.key==='def')))heading(s.t,hS(s));
   table(s,{hmin:18,rmin:14.5,hsz:9.5,bsz:10,bold:UT&&s.key==='prb'})},
  nt(s){const k='h:N:'+T.S.indexOf(s),h=Math.max(17,cellH(s.x,W,{sz:vs(k,10),b:vb(k,true),pad:4}));need(h);cell(L0,y,W,h,{t:s.x,b:vb(k,true),sz:vs(k,10),al:al(k,'center')});y+=h},
  tx(s){const t=s.t+': '+clean(d[s.f]);const w=W-12;
   if(!REP){heading(s.t,hS(s));const h=Math.max(doc.t==='trn'?35:27,cellH(d[s.f],W,{sz:vs(s.f,10),b:vb(s.f,false),pad:8}));need(h);cell(L0,y,W,h,{t:d[s.f],al:al(s.f,'left'),pad:8,va:'top',sz:vs(s.f,10),b:vb(s.f,false)});y+=h;return}
   const h=Math.max(27,cellH(t,W,{sz:vs(s.f,10),b:vb(s.f,true),pad:5}));need(h);cell(L0,y,W,h,{t,b:vb(s.f,true),sz:vs(s.f,10),al:al(s.f,'left'),pad:5,va:'middle'});y+=h},
 };
 /* MPI "Magnetisation and consumables": method column + WET / WET / FLUORESCENT columns */
 const consumables=s=>{const cw=[.28,.24,.24,.24].map(v=>v*W);let x;
  const split=v=>{const p=String(v||'').split('/');return[p[0].trim(),p.slice(1).join('/').trim()]};
  const [pm1,pm2]=split(d.pm),[im1,im2]=split(d.im);
  const cols=[
   [[ovl('mfr','Manufacturer'),d.mfr],[ovl('blk','MPI Lifting Block'),d.blk],[ovl('leg','Leg Spacing'),d.leg],[ovl('flow','Flow Direction'),d.flow],[ovl('ser','Serial No'),d.ser]],
   [[ovl('pc','Paint Color'),d.pc],[ovl('ps','Suspension'),d.ps],['Manufacturer',pm1],['Model',pm2],[ovl('pb','Batch No'),d.pb]],
   [[ovl('ic','Powder Color'),d.ic],[ovl('is','Suspension'),d.is],['Manufacturer',im1],['Model',im2],[ovl('ib','Batch No'),d.ib]],
   [['Powder Color','N/A'],['Suspension','N/A'],['Manufacturer','N/A'],['Model','N/A'],['Batch No','N/A']]];
  need(15+17+17*5);x=L0;
  cell(x,y,cw[0],15,{t:ovl('meth','Magnetization Method'),b:true,sz:9.5,fill:K.grey,pad:3});cell(x+cw[0],y,W-cw[0],15,{t:'Inspection Medium - Consumables',b:true,sz:9.5,fill:K.grey,pad:3});y+=15;
  const hd=[V('meth'),'WET','WET','FLUORESCENT'];x=L0;hd.forEach((t,i)=>{cell(x,y,cw[i],17,{t,b:i>0,sz:9.5,fill:K.grey,pad:3});x+=cw[i]});y+=17;
  for(let r=0;r<5;r++){x=L0;cols.forEach((c,i)=>{cell(x,y,cw[i],17,{t:c[r][1]?c[r][0]+': '+clean(c[r][1]):c[r][0]+':',sz:10,pad:3});x+=cw[i]});y+=17}};

 /* ================= run ================= */
 header();
 T.S.forEach(s=>{if(s.k==='sl'||s.k==='bx'||s.k==='sx')return;(sections[s.k]||(()=>{}))(s)});
 if(!every&&y>pinTop()-10)newPage();
 if(!every)pinned();
 finishPage();
 {const N=pdf.getNumberOfPages();if(N>1||doc.t==='tsh')for(let i=1;i<=N;i++){pdf.setPage(i);text('Page '+i+' of '+N,R0,doc.t==='tsh'?778:PH-8,8,false,'right',[90,90,90])}}
 return pdf.output('blob');
}

async function save(blob,name){
 const fn=(String(name||'document').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'_')||'document')+'.pdf',f=new File([blob],fn,{type:'application/pdf'});
 if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[f]})){
  try{await navigator.share({files:[f],title:name});return'shared'}catch(err){if(err&&err.name==='AbortError')return'cancel'}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fn;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),60000);return'downloaded';
}
window.DWPDF={build,save,FMT};
})();
