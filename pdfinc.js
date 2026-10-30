'use strict';
/* ---------- In-place PDF editing ----------
   Appends an "incremental update" to the ORIGINAL PDF: the original bytes are left exactly as they were, so every
   page keeps its sharp vector text, images, fonts, bookmarks and form fields, and the file stays small.
   Edited lines get a patch of the page's own background colour painted over them, with the new text on top.
   Works with classic and compressed (object stream / xref stream) PDFs. Anything it cannot handle safely
   (encrypted files, unusual filters) throws, and the editor falls back to the picture-based save. */
(function(root){
const L1=u8=>{let s='';for(let i=0;i<u8.length;i+=8192)s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192));return s};
const B1=s=>{const u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i)&255;return u};
const cat=list=>{let n=0;list.forEach(a=>n+=a.length);const o=new Uint8Array(n);let p=0;list.forEach(a=>{o.set(a,p);p+=a.length});return o};
async function pipe(u8,Ctor,fmt){const st=new Blob([u8]).stream().pipeThrough(new Ctor(fmt));return new Uint8Array(await new Response(st).arrayBuffer())}
const inflate=u=>pipe(u,DecompressionStream,'deflate'),deflate=u=>pipe(u,CompressionStream,'deflate');

function pngPredict(d,cols,colors,bpc){
 const bpp=Math.max(1,Math.ceil(colors*bpc/8)),rb=Math.ceil(cols*colors*bpc/8),rows=Math.floor(d.length/(rb+1)),out=new Uint8Array(rows*rb);
 for(let r=0;r<rows;r++){const f=d[r*(rb+1)],si=r*(rb+1)+1,di=r*rb;
  for(let i=0;i<rb;i++){const x=d[si+i],a=i>=bpp?out[di+i-bpp]:0,b=r?out[di-rb+i]:0,c=(r&&i>=bpp)?out[di-rb+i-bpp]:0;let v;
   if(f===0)v=x;else if(f===1)v=x+a;else if(f===2)v=x+b;else if(f===3)v=x+((a+b)>>1);
   else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=x+((pa<=pb&&pa<=pc)?a:(pb<=pc?b:c))}
   else throw new Error('predictor');out[di+i]=v&255}}
 return out}

function Reader(bytes){
 const s=L1(bytes),len=s.length,xref=new Map(),cache=new Map(),osCache=new Map();
 let trailer=null,lastIsStream=false,startx=0;
 const isWS=c=>c===' '||c==='\n'||c==='\r'||c==='\t'||c==='\f'||c==='\0',isDL=c=>'()<>[]{}/%'.indexOf(c)>=0;
 function ws(p){for(;;){while(p<len&&isWS(s[p]))p++;if(s[p]==='%'){while(p<len&&s[p]!=='\n'&&s[p]!=='\r')p++}else return p}}
 function obj(p,src,L){src=src||s;L=L||len;
  const w=q=>{for(;;){while(q<L&&isWS(src[q]))q++;if(src[q]==='%'){while(q<L&&src[q]!=='\n'&&src[q]!=='\r')q++}else return q}};
  p=w(p);const c=src[p];if(p>=L)throw new Error('eof');
  if(c==='/'){let q=p+1;while(q<L&&!isWS(src[q])&&!isDL(src[q]))q++;return[{name:src.slice(p+1,q)},q]}
  if(c==='<'&&src[p+1]==='<'){p+=2;const m=new Map();for(;;){p=w(p);if(src[p]==='>'&&src[p+1]==='>'){p+=2;break}if(p>=L)throw new Error('dict');const[k,q]=obj(p,src,L);if(!k||k.name===undefined)throw new Error('key');const[v,r]=obj(q,src,L);m.set(k.name,v);p=r}return[{dict:m},p]}
  if(c==='<'){const q=src.indexOf('>',p);if(q<0)throw new Error('hex');return[{raw:src.slice(p,q+1)},q+1]}
  if(c==='['){p++;const a=[];for(;;){p=w(p);if(src[p]===']'){p++;break}if(p>=L)throw new Error('arr');const[v,q]=obj(p,src,L);a.push(v);p=q}return[a,p]}
  if(c==='('){let d=0,q=p;for(;q<L;q++){const ch=src[q];if(ch==='\\')q++;else if(ch==='(')d++;else if(ch===')'){d--;if(!d){q++;break}}}return[{raw:src.slice(p,q)},q]}
  let q=p;while(q<L&&!isWS(src[q])&&!isDL(src[q]))q++;const t=src.slice(p,q);
  if(t==='true')return[true,q];if(t==='false')return[false,q];if(t==='null')return[null,q];
  if(/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)){
   if(/^\d+$/.test(t)){const m=/^\s+(\d+)\s+R(?![A-Za-z0-9])/.exec(src.slice(q,q+40));if(m)return[{ref:[+t,+m[1]]},q+m[0].length]}
   return[+t,q]}
  throw new Error('token '+t.slice(0,12))}
 function objAt(off){const p=ws(off),m=/^(\d+)\s+(\d+)\s+obj/.exec(s.slice(p,p+40));if(!m)throw new Error('bad object at '+off);
  let[v,q]=obj(p+m[0].length);const r={num:+m[1],gen:+m[2],v};q=ws(q);
  if(v&&v.dict&&s.startsWith('stream',q)){q+=6;if(s[q]==='\r')q++;if(s[q]==='\n')q++;r.sp=q}return r}
 async function stream(r){
  const d=r.v.dict;let L=await res(d.get('Length'));if(typeof L!=='number')L=-1;let end=-1;
  if(L>=0&&s.startsWith('endstream',ws(r.sp+L)))end=r.sp+L;
  else{end=s.indexOf('endstream',r.sp);if(end<0)throw new Error('stream end');if(s[end-1]==='\n')end--;if(s[end-1]==='\r')end--}
  let data=bytes.subarray(r.sp,end),f=await res(d.get('Filter'));const fl=[];
  if(Array.isArray(f)){for(const x of f)fl.push(await res(x))}else if(f)fl.push(f);
  let pm=await res(d.get('DecodeParms')||d.get('DP'));const pl=Array.isArray(pm)?pm:(pm?[pm]:[]);
  for(let i=0;i<fl.length;i++){const n=fl[i]&&fl[i].name;
   if(n==='FlateDecode'||n==='Fl'){data=await inflate(data);const P=await res(pl[i]);
    if(P&&P.dict){const pr=await res(P.dict.get('Predictor'));if(pr>=10)data=pngPredict(data,(await res(P.dict.get('Columns')))||1,(await res(P.dict.get('Colors')))||1,(await res(P.dict.get('BitsPerComponent')))||8);else if(pr===2)throw new Error('tiff predictor')}}
   else throw new Error('filter '+n)}
  return data}
 async function res(v){return v&&v.ref?await get(v.ref[0]):v}
 async function get(num){
  if(cache.has(num))return cache.get(num);const e=xref.get(num);let v=null;
  if(e&&!e.free){
   if(e.t===1){const r=objAt(e.o);if(r.num!==num)throw new Error('xref mismatch');v=r.v}
   else if(e.t===2){let os=osCache.get(e.o);
    if(!os){const r=objAt(xref.get(e.o).o),d=r.v.dict,N=await res(d.get('N')),F=await res(d.get('First')),data=await stream(r),txt=L1(data),nums=[];let p=0;
     for(let i=0;i<N;i++){const a=obj(p,txt,txt.length),b=obj(a[1],txt,txt.length);nums.push([a[0],b[0]]);p=b[1]}os={txt,nums,F};osCache.set(e.o,os)}
    const ent=os.nums[e.i];if(!ent||ent[0]!==num){const k=os.nums.findIndex(x=>x[0]===num);if(k<0)throw new Error('objstm miss');v=obj(os.F+os.nums[k][1],os.txt,os.txt.length)[0]}
    else v=obj(os.F+ent[1],os.txt,os.txt.length)[0]}}
  cache.set(num,v);return v}
 const put=(n,e,fill)=>{const o=xref.get(n);if(!o||(fill&&o.free&&!e.free))xref.set(n,e)};
 async function xrefStream(off,fill){
  const r=objAt(off);if(!r.v||!r.v.dict||r.sp===undefined)throw new Error('xref stream');const d=r.v.dict,data=await stream(r);
  const W=(await res(d.get('W'))).map(x=>+x),size=await res(d.get('Size')),idx=(await res(d.get('Index')))||[0,size],rl=W[0]+W[1]+W[2];let p=0;
  const rd=n=>{let v=0;for(let i=0;i<n;i++)v=v*256+data[p++];return v};
  for(let k=0;k<idx.length;k+=2){for(let i=0;i<idx[k+1];i++){if(p+rl>data.length)break;const t=W[0]?rd(W[0]):1,a=rd(W[1]),b=rd(W[2]);
   put(idx[k]+i,t===0?{free:1}:t===1?{t:1,o:a,g:b}:{t:2,o:a,i:b},fill)}}
  return d}
 async function readXref(){
  const sx=s.lastIndexOf('startxref');if(sx<0)throw new Error('no startxref');const m=/startxref\s+(\d+)/.exec(s.slice(sx,sx+40));if(!m)throw new Error('startxref');
  let off=+m[1];startx=off;const seen=new Set();let first=true;
  while(off!=null&&!seen.has(off)){seen.add(off);let p=ws(off),tr;
   if(s.startsWith('xref',p)){p+=4;
    for(;;){p=ws(p);if(s.startsWith('trailer',p)){p+=7;break}const m2=/^(\d+)\s+(\d+)/.exec(s.slice(p,p+40));if(!m2)throw new Error('xref subsection');p+=m2[0].length;
     const st=+m2[1],cnt=+m2[2];for(let i=0;i<cnt;i++){p=ws(p);const e=/^(\d+)\s+(\d+)\s+([nf])/.exec(s.slice(p,p+30));if(!e)throw new Error('xref entry');p+=e[0].length;put(st+i,e[3]==='n'?{t:1,o:+e[1],g:+e[2]}:{free:1})}}
    tr=obj(p)[0].dict;const xs=tr.get('XRefStm');if(typeof xs==='number')await xrefStream(xs,true);if(first)lastIsStream=false}
   else{tr=await xrefStream(off);if(first)lastIsStream=true}
   if(first){trailer=tr;first=false}
   const pv=tr.get('Prev');off=typeof pv==='number'?pv:null}
  if(!trailer)throw new Error('no trailer');
  if(trailer.get('Encrypt'))throw new Error('encrypted')}
 async function findPage(idx){
  const root=await res(trailer.get('Root'));if(!root||!root.dict)throw new Error('no root');
  const cnt={i:0};
  async function walk(node,ref,inh){
   const d=node.dict,kids=await res(d.get('Kids')),rs=d.get('Resources')!==undefined?d.get('Resources'):inh;
   if(!Array.isArray(kids)){if(cnt.i===idx)return{ref,dict:d,resources:rs};cnt.i++;return null}
   for(const k of kids){const kn=await res(k);if(!kn||!kn.dict)throw new Error('bad kid');
    if(kn.dict.get('Kids')!==undefined){const c=await res(kn.dict.get('Count'));if(typeof c==='number'&&idx>=cnt.i+c){cnt.i+=c;continue}}
    const f=await walk(kn,k.ref,rs);if(f)return f}
   return null}
  const pages=root.dict.get('Pages');const f=await walk(await res(pages),pages.ref,undefined);if(!f)throw new Error('page '+idx+' not found');return f}
 return{bytes,len,ready:readXref,get,res,findPage,get trailer(){return trailer},get lastIsStream(){return lastIsStream},get startx(){return startx},xref,s}}

/* ---------- serialising ---------- */
const NUM=n=>{if(Number.isInteger(n))return String(n);let t=String(n);if(/e/i.test(t))t=n.toFixed(8).replace(/0+$/,'').replace(/\.$/,'');return t};
function ser(o){
 if(o===null||o===undefined)return'null';if(o===true)return'true';if(o===false)return'false';
 if(typeof o==='number')return NUM(o);if(Array.isArray(o))return'['+o.map(ser).join(' ')+']';
 if(o.name!==undefined)return'/'+o.name;if(o.raw!==undefined)return o.raw;if(o.ref)return o.ref[0]+' '+o.ref[1]+' R';
 if(o.dict){let t='<<';o.dict.forEach((v,k)=>{t+='/'+k+' '+ser(v)+'\n'});return t+'>>'}
 throw new Error('ser')}
const N3=n=>{const t=(+n).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');return t==='-0'||t===''?'0':t};
const D=o=>({dict:new Map(Object.entries(o))}),NM=n=>({name:n}),RF=n=>({ref:[n,0]});

function ttfInfo(u){
 const dv=new DataView(u.buffer,u.byteOffset,u.byteLength),n=dv.getUint16(4),t={};
 for(let i=0;i<n;i++){const o=12+16*i,tag=String.fromCharCode(u[o],u[o+1],u[o+2],u[o+3]);t[tag]=dv.getUint32(o+8)}
 if(!t.head||!t.hhea)throw new Error('font tables');const upm=dv.getUint16(t.head+18),k=1000/upm;
 return{bbox:[dv.getInt16(t.head+36),dv.getInt16(t.head+38),dv.getInt16(t.head+40),dv.getInt16(t.head+42)].map(v=>Math.round(v*k)),asc:Math.round(dv.getInt16(t.hhea+4)*k),desc:Math.round(dv.getInt16(t.hhea+6)*k)}}

/* edits: [{idx, ctm:[a,b,c,d,e,f], rects:[{x,y,w,h,c:[r,g,b]}], texts:[{x,y,sz,c:[r,g,b], runs:[{f:'DWF1',t:'latin1 string'}]}]}]
   fonts: {DWF1:{ttf:Uint8Array,widths:[224 numbers],bold:false}, DWF2:{...}}  (DWF3 / DWF4 = Helvetica / Helvetica-Bold, built in) */
async function apply(bytes,edits,fonts){
 const R=Reader(bytes);await R.ready();
 const tr=R.trailer,rootRef=tr.get('Root');if(!rootRef||!rootRef.ref)throw new Error('root ref');
 let maxN=0;R.xref.forEach((v,k)=>{if(k>maxN)maxN=k});
 const sz=await R.res(tr.get('Size'));let next=Math.max(typeof sz==='number'?sz:0,maxN+1);
 const parts=[],offs=new Map();let pos=bytes.length;
 const last=bytes[bytes.length-1];if(last!==10&&last!==13){parts.push(B1('\n'));pos+=1}
 const add=(num,chunks)=>{offs.set(num,pos);const a=cat(chunks.map(c=>typeof c==='string'?B1(c):c));parts.push(a);pos+=a.length};
 const addStream=(num,dictBody,data)=>add(num,[num+' 0 obj\n<<'+dictBody+'/Length '+data.length+'>>\nstream\n',data,'\nendstream\nendobj\n']);
 const addObj=(num,o)=>add(num,[num+' 0 obj\n'+ser(o)+'\nendobj\n']);
 /* fonts that are actually used */
 const used=new Set();edits.forEach(e=>e.texts.forEach(t=>t.runs.forEach(r=>used.add(r.f))));
 const fontRef={};
 for(const key of ['DWF1','DWF2']){if(!used.has(key))continue;const f=fonts&&fonts[key];if(!f)throw new Error('font '+key);
  const info=ttfInfo(f.ttf),ff=next++,fd=next++,fo=next++,z=await deflate(f.ttf),nm=f.bold?'PublicSans-Bold':'PublicSans';
  addStream(ff,'/Filter/FlateDecode/Length1 '+f.ttf.length,z);
  addObj(fd,D({Type:NM('FontDescriptor'),FontName:NM(nm),Flags:32,FontBBox:info.bbox,ItalicAngle:0,Ascent:info.asc,Descent:info.desc,CapHeight:700,StemV:f.bold?150:80,FontFile2:RF(ff)}));
  addObj(fo,D({Type:NM('Font'),Subtype:NM('TrueType'),BaseFont:NM(nm),FirstChar:32,LastChar:255,Widths:f.widths.map(w=>Math.round(w)),FontDescriptor:RF(fd),Encoding:NM('WinAnsiEncoding')}));
  fontRef[key]=fo}
 for(const[key,bn]of[['DWF3','Helvetica'],['DWF4','Helvetica-Bold']]){if(!used.has(key))continue;const fo=next++;addObj(fo,D({Type:NM('Font'),Subtype:NM('Type1'),BaseFont:NM(bn),Encoding:NM('WinAnsiEncoding')}));fontRef[key]=fo}
 /* pages */
 for(const e of edits){
  const pg=await R.findPage(e.idx);if(!pg.ref)throw new Error('page ref');
  const page=new Map(pg.dict);
  /* contents */
  let cv=page.get('Contents'),list=[];
  const take=async v=>{if(Array.isArray(v)){for(const x of v){if(!x||!x.ref)throw new Error('contents');list.push(x)}}else if(v&&v.ref){const o=await R.res(v);if(Array.isArray(o)){for(const x of o){if(!x||!x.ref)throw new Error('contents');list.push(x)}}else list.push(v)}else if(v!==undefined&&v!==null)throw new Error('contents')};
  await take(cv);
  const pre=next++,post=next++;
  addStream(pre,'',B1('q\n'));
  let c='Q\nq\n'+e.ctm.map(N3).join(' ')+' cm\n';
  for(const r of e.rects)c+=r.c.map(v=>N3(v/255)).join(' ')+' rg\n'+N3(r.x)+' '+N3(r.y)+' '+N3(r.w)+' '+N3(r.h)+' re f\n';
  for(const t of e.texts){
   c+='BT\n'+t.c.map(v=>N3(v/255)).join(' ')+' rg\n1 0 0 -1 '+N3(t.x)+' '+N3(t.y)+' Tm\n';
   for(const r of t.runs)c+='/'+r.f+' '+N3(t.sz)+' Tf\n('+r.t.replace(/[()\\]/g,m=>'\\'+m).replace(/[\x00-\x1f\x7f-\xff]/g,m=>'\\'+('00'+m.charCodeAt(0).toString(8)).slice(-3))+') Tj\n';
   c+='ET\n'}
  c+='Q\n';addStream(post,'',B1(c));
  page.set('Contents',[RF(pre),...list,RF(post)]);
  /* resources: copy the page's (possibly inherited) resources and add our fonts */
  let rs=await R.res(pg.resources);const rd=new Map(rs&&rs.dict?rs.dict:[]);
  let fd=await R.res(rd.get('Font'));const fm=new Map(fd&&fd.dict?fd.dict:[]);
  for(const k in fontRef)fm.set(k,RF(fontRef[k]));rd.set('Font',{dict:fm});page.set('Resources',{dict:rd});
  offs.set(pg.ref[0],pos);const body=pg.ref[0]+' '+pg.ref[1]+' obj\n'+ser({dict:page})+'\nendobj\n';const a=B1(body);parts.push(a);pos+=a.length}
 /* cross-reference section */
 const nums=[...offs.keys()].sort((a,b)=>a-b),xrefOff=pos,prev=R.startx;
 const keep=[];['Root','Info','ID'].forEach(k=>{if(tr.get(k)!==undefined)keep.push(['/'+k+' '+ser(tr.get(k))])});
 const keepS=keep.map(x=>x[0]).join('\n');
 if(!R.lastIsStream){
  let x='xref\n';nums.forEach(n=>{x+=n+' 1\n'+String(offs.get(n)).padStart(10,'0')+' 00000 n \n'});
  const size=Math.max(next,maxN+1);
  x+='trailer\n<</Size '+size+'\n'+keepS+'\n/Prev '+prev+'>>\nstartxref\n'+xrefOff+'\n%%EOF\n';parts.push(B1(x))}
 else{
  const xn=next++;offs.set(xn,xrefOff);const all=[...offs.keys()].sort((a,b)=>a-b),rows=new Uint8Array(all.length*7);
  all.forEach((n,i)=>{const o=offs.get(n),b=i*7;rows[b]=1;rows[b+1]=(o>>>24)&255;rows[b+2]=(o>>>16)&255;rows[b+3]=(o>>>8)&255;rows[b+4]=o&255;rows[b+5]=0;rows[b+6]=0});
  const index=all.map(n=>n+' 1').join(' '),size=Math.max(next,maxN+1);
  const head=xn+' 0 obj\n<</Type/XRef/Size '+size+'/W[1 4 2]/Index['+index+']\n'+keepS+'\n/Prev '+prev+'/Length '+rows.length+'>>\nstream\n';
  parts.push(cat([B1(head),rows,B1('\nendstream\nendobj\nstartxref\n'+xrefOff+'\n%%EOF\n')]))}
 return cat([bytes,...parts])}

root.PDFInc={apply,ttfInfo,Reader};
if(typeof module!=='undefined')module.exports=root.PDFInc;
})(typeof window!=='undefined'?window:globalThis);
