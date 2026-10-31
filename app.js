'use strict';
/* ---------- storage / state ---------- */
const $=s=>document.querySelector(s),LS=(k,d)=>{try{return JSON.parse(DWSTORE.get(k))??d}catch{return d}},SV=(k,v)=>{try{DWSTORE.set(k,JSON.stringify(v))}catch{toast('Storage full - remove unused logos or documents')}};
const fkey=d=>((d.pf||(d.d&&d.d.proj))||'').trim()||'Unfiled';
let cfgTab='general',setBack=false,docs=LS('dw.docs',[]),theme=LS('dw.theme','auto'),ME=LS('dw.me',{}),lgs=0,lv='',view='home',cur=null,pane='form',fld=null,ret='home',pvB=null,impK=0,impHL=true,IMPD=[],impEd=LS('dw.imhl',true),projs=LS('dw.proj',[]),ct=LS('dw.ct',{});
const eff=()=>theme==='auto'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):theme,TC=()=>eff()==='dark'?'#000000':'#EDEFF2';
const RELAY_URL='https://script.google.com/macros/s/AKfycbzpA-xXhKiRGUWXdWjo86tUsDbJqf3whW7h4z5JRILA6CKg8N-Qbd0PzBqVIl2HXldd/exec',RELAY_KEY='dw-8581750528ec08a1';
let AU=Object.assign({on:false,remind:true},LS('dw.auto',{}));
const bkJSON=()=>JSON.stringify({app:'danholsen-workspace',v:2,at:new Date().toISOString(),docs,lib,sigs,sigdef:sigDef,sigauto:sigAuto,msgs}),bkName=()=>`danholsen-backup-${new Date().toISOString().slice(0,10)}.json`,DAY=864e5,lastBk=()=>LS('dw.lastbk',0)||0;
const bnr=()=>{if(!AU.remind||!docs.length)return'';const lb=lastBk();if(Date.now()-lb<DAY)return'';const bad=lb&&Date.now()-lb>7*DAY;return`<button class="bkbn${bad?' bad':''}" id="bkn"><span><b>${bad?'Not backed up for '+Math.floor((Date.now()-lb)/DAY)+' days':'Back up your documents'}</b><small>${lb?'Last backup '+ago(lb)+'.':'No backup yet.'} Tap to save or send a copy.</small></span><i>Back up</i></button>`};
const e=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const J={left:'flex-start',center:'center',right:'flex-end'},uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const mk=a=>Object.fromEntries(a.map(([k,l,df])=>[k,{l,df:df||''}]));
const D=['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];

/* ---------- templates (one schema drives editor + A4 output) ---------- */
/* shared pieces for the report-style templates added in v77 */
const RC=[['date','Report date'],['no','Report number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location']],
RS=[['td','Test date'],['tn','Name'],['tl','Level'],['ts','Signature'],['o1','Sign-off column 1','CLIENT'],['cn','Name'],['cd','Date'],['cx','Signature'],['o2','Sign-off column 2'],['dn','Name'],['dd','Date'],['dx','Signature'],['o3','Sign-off column 3'],['en','Name'],['ed','Date'],['ex','Signature']],
RSX={k:'sx',leadL:'Test date',lead:'td',th:'DGSL NDT technician',tech:['tn','tl','ts'],P:[['o1','cn','cd','cx'],['o2','dn','dd','dx'],['o3','en','ed','ex']]},
RH=[['date',2],['no',2],['client',1],['con',1],['proj',1],['loc',1]];
/* automatic columns: when a reading changes, the calculated cells of that row are filled in (they can still be typed over) */
const num=v=>{const x=parseFloat(String(v??'').replace(',','.'));return isNaN(x)?null:x},fx=(x,n)=>x==null||!isFinite(x)?'':x.toFixed(n);
const CALC={
 plt:{in:[1,2,3,4,6],dep:['nwt','cint','tmin'],f:(r,d)=>{const v=[1,2,3,4].map(i=>num(r[i])).filter(x=>x!=null),mn=v.length?Math.min(...v):null,nom=num(r[6])??num(d.nwt),yrs=num(d.cint),tm=num(d.tmin),
   loss=mn!=null&&nom!=null?nom-mn:null,cr=loss!=null&&yrs>0?loss/yrs:null,life=cr>0&&mn!=null&&tm!=null?Math.max(0,(mn-tm)/cr):null;
   return{5:fx(mn,2),7:fx(loss,2),8:loss!=null&&nom>0?fx(loss/nom*100,1):'',9:fx(cr,3),10:life!=null?fx(life,1):cr===0&&mn!=null&&tm!=null?'n/a':''}}},
 tsf:{in:[2,3],dep:[],f:r=>{const a=num(r[2]),b=num(r[3]);return{4:a!=null&&b!=null?fx((a+b)/2,1):a!=null?fx(a,1):b!=null?fx(b,1):''}}},
 cap:{in:[1],dep:[],f:r=>{const a=num(r[1]);return{2:a!=null?fx(a/1000,3):''}}},
 tape:{in:[4,5,7],dep:[],f:r=>{const m=num(r[4]),t=num(r[5]),tol=num(r[7]),dv=m!=null&&t!=null?t-m:null;return{6:fx(dv,1),8:dv!=null&&tol!=null?(Math.abs(dv)<=Math.abs(tol)?'Pass':'Fail'):''}}},
 det:{in:[3,4,6],dep:[],f:r=>{const m=num(r[3]),t=num(r[4]),tol=num(r[6]),dv=m!=null&&t!=null?t-m:null;return{5:fx(dv,2),7:dv!=null&&tol!=null?(Math.abs(dv)<=Math.abs(tol)?'Pass':'Fail'):''}}}};

/* v78 helpers: sign-off blocks, money maths and extra automatic columns */
const SXF=(lead,o1,o2,o3,nm,lv)=>[['td',lead],['tn',nm||'Name'],['tl',lv||'Designation'],['ts','Signature'],['o1','Sign-off column 1',o1],['cn','Name'],['cd','Date'],['cx','Signature'],['o2','Sign-off column 2',o2],['dn','Name'],['dd','Date'],['dx','Signature'],['o3','Sign-off column 3',o3],['en','Name'],['ed','Date'],['ex','Signature']],
SXS=(lead,th)=>({k:'sx',leadL:lead,lead:'td',th,tech:['tn','tl','ts'],P:[['o1','cn','cd','cx'],['o2','dn','dd','dx'],['o3','en','ed','ex']]}),
RHD=[['date','Report date'],['no','Report number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location']],
NR=(n,w)=>Array.from({length:n},(_,i)=>[String(i+1),...Array(w-1).fill('')]),
mon=v=>{const x=parseFloat(String(v??'').replace(/,/g,''));return isNaN(x)?null:x},
fm=n=>n==null?'':n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),
hm=v=>{const m=String(v||'').trim().match(/^(\d{1,2})(?:[:.hH]?(\d{2}))?$/);return m?(+m[1])*60+(+(m[2]||0)):null};
Object.assign(CALC,{
 crew:{in:[3,4],dep:[],f:r=>{const a=hm(r[3]),b=hm(r[4]);return{5:a!=null&&b!=null?fx(((b-a+1440)%1440)/60,1):''}}},
 inv:{in:[0,3],postIn:[4],dep:[],f:r=>{const q=mon(r[0]),p=mon(r[3]);return{4:q!=null&&p!=null?fm(q*p):''}},
  post:d=>{const R=d.items||[],any=R.some(r=>mon(r[4])!=null),s=R.reduce((a,r)=>a+(mon(r[4])||0),0);return any?{tot:fm(s),vat:fm(s*.075),grand:fm(s*1.075)}:{tot:'',vat:'',grand:''}}},
 exp:{in:[],postIn:[5],dep:['adv'],f:()=>({}),
  post:d=>{const R=d.lines||[],any=R.some(r=>mon(r[5])!=null),s=R.reduce((a,r)=>a+(mon(r[5])||0),0);return any?{tot:fm(s),due:fm(s-(mon(d.adv)||0))}:{tot:'',due:''}}}});

function calcPost(doc,C){if(!C.post)return;Object.entries(C.post(doc.d)).forEach(([k,v])=>{doc.d[k]=v;const el=document.querySelector(`[data-ed="f:${k}"]`);if(el&&el!==document.activeElement)el.textContent=v})}
function calcRow(doc,S,C,ri){const r=doc.d[S.key][ri],out=C.f(r,doc.d),tr=document.querySelector(`tr[data-rr="${S.key}:${ri}"]`);
 Object.entries(out).forEach(([i,val])=>{r[i]=val;const td=tr&&tr.children[i];if(td&&td!==document.activeElement)td.textContent=val});calcPost(doc,C)}
function runCalc(el){const doc=cur,S=TPL[doc.t].S.find(s=>s.key===el.dataset.key),C=S&&S.calc&&CALC[S.calc],ci=+el.dataset.ci;if(!C)return;if(C.in.includes(ci))calcRow(doc,S,C,+el.dataset.ri);else if(C.postIn&&C.postIn.includes(ci))calcPost(doc,C)}
function calcAll(k){const doc=cur;TPL[doc.t].S.forEach(S=>{const C=S.calc&&CALC[S.calc];if(C&&C.dep.includes(k)){const R=doc.d[S.key];if(R.length)R.forEach((_,ri)=>calcRow(doc,S,C,ri));else calcPost(doc,C)}})}

const IPR=[
['pu','1. PURPOSE','This procedure sets out how the examination is to be carried out so that results are consistent, repeatable and traceable to the applicable code and client specification.'],
['sc','2. SCOPE','\u2022 Applies to the items, welds and locations named in the document control block above.\n\u2022 Covers surface preparation, equipment set-up, examination, evaluation and reporting.'],
['rf','3. REFERENCES','\u2022 Applicable code / standard: as stated in the document control block.\n\u2022 Client specification and project quality plan.\n\u2022 Company quality manual and NDT written practice.'],
['rs','4. RESPONSIBILITIES','\u2022 NDT Technician: carries out the examination and records the results.\n\u2022 Level II / III: reviews and interprets results, approves reports.\n\u2022 Project Manager: ensures resources and access are provided.'],
['eq','5. EQUIPMENT AND MATERIALS','\u2022 Instrument, probes / consumables and accessories as listed on the examination report.\n\u2022 All equipment must be within its calibration period.\n\u2022 Reference blocks and calibration standards traceable to a recognised standard.'],
['pq','6. PERSONNEL QUALIFICATION','Personnel performing the examination shall be qualified and certified in accordance with the company written practice (ISO 9712 / ASNT SNT-TC-1A or as required by the client).'],
['pr','7. PROCEDURE','\u2022 Confirm the item, location and permit to work, and prepare the surface for examination.\n\u2022 Calibrate and set up the equipment; record the settings.\n\u2022 Carry out the examination over the full area and record all relevant indications.\n\u2022 Verify the calibration at the end of the shift or after any change of set-up.'],
['ac','8. ACCEPTANCE CRITERIA','Indications shall be evaluated against the acceptance standard named in the document control block. Non-conformances shall be reported on a Non-Conformance Report.'],
['rp','9. REPORTING AND RECORDS','\u2022 A report is issued for each examination, signed by the technician and reviewed by the Level II / III.\n\u2022 Records are kept for the period required by the client and the code.'],
['hs','10. HEALTH, SAFETY AND ENVIRONMENT','\u2022 Follow the site permit-to-work system and wear the required PPE.\n\u2022 Report any unsafe condition and stop work if the task cannot be done safely.']];
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
,
inv:{n:'Invoice',d:'Client invoice with items, VAT and bank details',no:'',gen:1,tsz:20,tag:"Non-Destructive Testing, Coating inspection, Welding Inspection, Labor Supply, Equipment leasing/supply, Training / Consultancy",foot:1,
F:mk([['to','Invoice to'],['ino','Invoice no.'],['date','Date'],['tot','Total (NGN)'],['vat','VAT 7.5% (NGN)'],['grand','Grand total (NGN)'],['words','Amount in words'],['an','Account name','Danholsen Global Service Limited'],['bn','Bank name','Premium Trust Bank'],['ac','Account number','0040018522'],['sig','Signature']]),
S:[{k:'ps',f:'to',lead:'TO',min:3},{k:'g',n:2,f:[['ino',1],['date',1]]},
{k:'tb',key:'items',c:[['Qty',1],['Description',5],['UOM',1.4],['Rate (NGN)',2],['Amount (NGN)',2.2]],al:['center','left','center','right','right'],rows:[['','','','','']]},
{k:'g',n:3,f:['tot','vat','grand']},{k:'g',n:1,f:['words']},{k:'g',n:3,t:'Bank details',f:['an','bn','ac']},{k:'g',n:1,f:['sig']}]},

ltr:{n:'Request Letter',d:'Formal company letter with recipient, subject and signature',no:'',gen:1,notitle:1,foot:1,
F:mk([['rcp','Recipient','National Youth Service Corps,\nRivers State,\nThe Secretariat.'],['frm','Sender','DANHOLSEN GLOBAL SERVICES LIMITED\nChief of Staff/Project Manager,\n8b, Housing Estate, Rumuibekwe,\nPort Harcourt, Rivers.'],['date','Date'],['salu','Salutation','Dear Sir/Ma,'],['subj','Subject','REQUEST FOR A CORPS MEMBER'],['body','Letter body',"We are writing to request Corps Member [Full name], with Call-up number [call-up number] and State Code [state code], for Primary Assignment at Danholsen Global Services Limited.\n\nOur management believes that his/her service would contribute positively to the operations of our organisation. He/She will serve as a member of our team for the duration of his/her mandatory one-year National Youth Service, subject to the rules and regulations governing the NYSC Scheme.\n\nWe kindly request your favourable consideration of this request and look forward to a positive response.\n\nThank you for your consideration."],['cls','Closing','Yours faithfully,'],['sig','Signature'],['sn','Signatory name','Miss SevenJoy Itah,'],['sp','Position','Chief of Staff/Project Manager,'],['sc','Contact','+2348131310347,\ninfo@danholsen.com']]),
S:[{k:'ps',f:'rcp',gap:10},{k:'ps',f:'frm',gap:10},{k:'ps',f:'date',gap:10,min:1},{k:'ps',f:'salu',gap:10},{k:'ps',f:'subj',b:1,u:1,al:'center',gap:10},{k:'ps',f:'body',gap:10},{k:'ps',f:'cls',gap:4},{k:'ps',f:'sig',lab:'Signature:'},{k:'ps',f:'sn',b:1,gap:0},{k:'ps',f:'sp',gap:0},{k:'ps',f:'sc',gap:0}]},

trq:{n:'Torquing Procedure for Piping Flanges',d:'Bolt torquing steps, crisscross sequences and flange diagrams',no:'FORM NO. 06-28-F11 Rev.',gen:1,tsz:15,tag:"Engineering, Procurement, Construction, Maintenance, Asset integrity management, Training",foot:1,
F:mk([['h1','Heading 1','SEQUENCE OF STEPS REQUIRED FOR BOLT TORQUING:-'],['s1','Steps 1',"1.\n\u2022 The individual studs on the flanges to be torque will be numbered (for control and identification) starting with the stud at 12 O'clock as #1, and the stud at 6 O'clock as #2, and the stud at 3 O'clock as #3, and proceeding in a \"Star\" pattern until all studs are numbered.\n\u2022 The stud size will be noted and the torque values as per the engineering tables will be used and are based on a lube with a stated coefficient of friction as well as bolt, gasket and flange material, as well as the intended service.\n\u2022 The hydraulic power pack (pump) will be used together with the required hydraulic torque wrench (which will be chosen in accordance with the required foot lbs, as well as the space requirements)."],['s2','Steps 2',"2.\n\u2022 For Nut less than or equal to 2 inches (A/F), 2 torque sequence steps in a \"star pattern\" will be done (In the first pass all nuts will be torque at 50% and the second pass at 100%), which will then be followed by a \"chase around\" torque sequence at 100%.\n\u2022 For Nut sizes greater than 2 inches (A/F), 3 torque sequence - steps in a \"star pattern\" will be done (In the first pass all nuts will be torque at 30%, the second pass at 60% and the third at 100%), which will THEN be followed by a \"Chase around\" torque sequence at 100%.\n\u2022 Care will be taken to position tools for maximum reaction, whilst limiting the chance of injury to persons around or equipment nearby including adjacent vessels and pipe work.\n\u2022 Use of a back-up to hold the nut at the other end of the stud firmly in place.\n\u2022 \"Flange Tags\" will be placed on these flanges, which will state the Flange Size and rating and a number that coincides with the data sheet/checklist for traceability\n\u2022 Finally, 24 hours after, the flanges have been torque as per step (2.1/2.2) above), it is recommended that the nuts be re-torqued to check for bolt relaxation using 100% torque values. This is a \"Chase-round\" method."],['h2','Heading 2','CRISSCROSS SEQUENCES'],['cs','Sequences',"\u2022 Bolt torque sequence for 4 bolt flange: 1,3,2,4.\n\u2022 Bolt torque sequence for 8 bolt flange: 1,5,3,7,2,6,8,4.\n\u2022 Bolt torque sequence for 12 bolt flange: 1,7,4,10,2,8,5,11,3,9,6,12.\n\u2022 Bolt torque sequence for 16 bolt flange: 1,9,5,13,3,11,7,15,2,10,6,14,4,12,8,16.\n\u2022 Bolt torque sequence for 20 bolt flange: 1,11,6,16,4,14,19,9,2,12,17,7,20,10,5,15,3,13,18,8."]]),
S:[{k:'ps',f:'h1',b:1,u:1,sz:11.5,gap:6},{k:'ps',f:'s1',gap:4},{k:'ps',f:'s2',gap:10},{k:'ps',f:'h2',b:1,u:1,sz:10.5,gap:6},{k:'ps',f:'cs'},{k:'fd'}]},

vpr:{n:'Visual Practice Report',d:'Student practice report: specimen details, weld sketches and defect summary',no:'',gen:1,tsz:15,
F:mk([['sub','Sub-title','STUDENTS PRACTICE REPORT'],['cand','Candidate\'s name'],['date','Date of examination'],['spec','Specimen reference ID number'],['len','Specimen length'],['jt','Joint type'],['eq','Equipment used'],['wt','Types of weld'],['li','Black light or white light intensity'],['loc','Indication location sketches'],['rem','Comments'],['chk','Checked by'],['qual','Qualification'],['sd','Signature & date']]),
S:[{k:'ps',f:'sub',b:1,al:'center',gap:2},{k:'g',n:1,f:['cand','date','spec','len','jt','eq','wt','li','loc']},{k:'nt',x:'Sketch showing weld details: (use additional sheets if required)'},{k:'sk',lab:'Weld Cap'},{k:'sk',lab:'Weld Root'},
{k:'tb',t:'Summary of defects',key:'def',rmin:16,c:[['Sl. no.',1],['ID (mm)',1.4],['OD (mm)',1.4],['Thickness (mm)',2],['Types of defect',3],['Orientation',2],['Remark',2]],rows:[["A", "", "", "", "", "", ""], ["", "", "", "", "", "", ""], ["B", "", "", "", "", "", ""], ["", "", "", "", "", "", ""], ["A", "", "", "", "", "", ""], ["", "", "", "", "", "", ""], ["B", "", "", "", "", "", ""], ["", "", "", "", "", "", ""]]},
{k:'tx',t:'Comments',f:'rem'},{k:'g',n:3,f:['chk','qual','sd']}]},

/* ===== v77: NDT, procedure and tank-calibration templates ===== */
plt:{n:'Pipeline UT Thickness Report',d:'Readings at 12, 3, 6 and 9 o’clock with wall loss and corrosion rate',no:'',hd:1,
F:mk([...RC,['line','Line / pipeline no.'],['svc','Service / fluid'],['od','Pipe OD'],['sch','Schedule / grade'],['mat','Material'],['nwt','Nominal wall thickness (mm)'],['tmin','Minimum required thickness (mm)'],['cint','Years in service / interval (yr)'],['code','Code / specification'],['proc','NDE procedure'],
['eq','Instrument','Sonatest D-10+'],['ser','Instrument serial no.'],['prb','Probe (type / frequency)'],['blk','Calibration block','Step wedge'],['cpl','Couplant'],['tmp','Surface temperature','Ambient'],['surf','Surface condition'],['cdt','Calibration date'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH,['line',1],['svc',1],['od',1],['sch',1],['mat',2],['nwt',2]]},
{k:'g',n:4,t:'Instrument and calibration',f:['eq','ser','prb','blk','cpl','tmp','surf','cdt']},
{k:'g',n:4,t:'Acceptance basis',f:['tmin','cint','code','proc']},
{k:'nt',x:'Wall loss = nominal − minimum reading. Corrosion rate (mm/yr) = wall loss ÷ years in service. Remaining life (yr) = (minimum reading − minimum required) ÷ corrosion rate.'},
{k:'tb',t:'Thickness readings (mm), clock positions 12, 3, 6 and 9',key:'rd',calc:'plt',c:[['TML / line',2.6],['Pos. 12',1.25],['Pos. 3',1.25],['Pos. 6',1.25],['Pos. 9',1.25],['Min. reading',1.4],['Nominal (mm)',1.4],['Wall loss (mm)',1.4],['Wall loss (%)',1.3],['Corrosion rate (mm/yr)',1.6],['Remaining life (yr)',1.5],['Remarks',2]],rows:[['','','','','','','','','','','',''],['','','','','','','','','','','',''],['','','','','','','','','','','',''],['','','','','','','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

pt:{n:'Liquid Penetrant Examination Report',d:'PT examination: consumables, process times and accept / reject results',no:'',hd:1,
F:mk([...RC,['code','Code / specification'],['cs','Client specification'],['acc','Acceptance standard'],['proc','NDE procedure'],['mat','Material'],['thk','Thickness (mm)'],['surf','Surface condition','As welded'],
['lit','Lighting','Natural; light meter > 1000 lux'],['tmp','Part temperature','Ambient'],['ptype','Penetrant type / method','Type II, Method C (visible, solvent removable)'],['pre','Pre-cleaning','Wire brush and solvent'],
['cln','Cleaner: manufacturer / model'],['cb','Cleaner: batch no.'],['pen','Penetrant: manufacturer / model'],['pb','Penetrant: batch no.'],['rmv','Remover: manufacturer / model'],['rb','Remover: batch no.'],['dev','Developer: manufacturer / model'],['db','Developer: batch no.'],
['dw','Penetrant dwell time','10 min'],['rmm','Excess penetrant removal','Solvent-dampened lint-free cloth'],['dt','Developer time','10 min'],['dwg','Engineering dwg no.'],['wps','WPS no.'],['jt','Joint / weld type'],['item','Item inspected'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH,['code',1],['cs',1],['acc',1],['proc',1],['mat',1],['thk',1],['surf',2]]},
{k:'ck',t:'Examination stage',key:'stg',o:['As welded','Before PWHT','After PWHT','After hydro test','Other'],df:[]},
{k:'g',n:4,t:'Conditions',f:['lit','tmp','ptype','pre']},
{k:'g',n:4,t:'Consumables',f:['cln','cb','pen','pb','rmv','rb','dev','db']},
{k:'g',n:4,t:'Process',f:['dw','rmm','dt']},
{k:'g',n:4,t:'Part / weld examined',f:['dwg','wps','jt','item']},
{k:'tb',t:'Examination results',key:'res',c:[['Item',3],['Joint no.',2],['Welder ID',3],['Indication',1.5],['Accept',1.5],['Reject',1.5],['Comment',1.5]],rows:[['','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

cal:{n:'UT Equipment Calibration Record',d:'Instrument, probe, calibration block, couplant and pre / post-shift checks',no:'',hd:1,
F:mk([['date','Record date'],['no','Record number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['proc','NDE procedure'],['code','Code / specification'],
['eq','Instrument','Sonatest D-10+'],['ser','Instrument serial no.'],['cdue','Instrument calibration due'],['ccn','Calibration certificate no.'],
['prb','Probe type'],['pser','Probe serial no.'],['pmf','Probe manufacturer'],['wdg','Wedge / shoe no.'],['pf','Frequency (MHz)'],['pa','Nominal angle (deg)'],['psz','Crystal size (mm)'],['pcd','Probe check date'],
['blk','Calibration block','IIW V1 (Type 1)'],['bid','Block ID / serial no.'],['bmt','Block material','Carbon steel'],['cpl','Couplant'],['cpb','Couplant batch no.'],['tmp','Surface temperature','Ambient'],['bcn','Block certificate no.'],['bth','Block thickness (mm)'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH,['proc',2],['code',2]]},
{k:'g',n:4,t:'Instrument',f:['eq','ser','cdue','ccn']},
{k:'g',n:4,t:'Probe',f:['prb','pser','pmf','wdg','pf','pa','psz','pcd']},
{k:'g',n:4,t:'Calibration block and couplant',f:['blk','bid','bmt','cpl','cpb','tmp','bcn','bth']},
{k:'tb',t:'Calibration checks',key:'chk',c:[['Check',3.2],['Tolerance',2.2],['Pre-shift reading',1.8],['Post-shift reading',1.8],['Accept',1.3],['Reject',1.3],['Comment',2]],rows:[['Range / time-base calibration','Per procedure','','','','',''],['Beam index (probe index point)','Per procedure','','','','',''],['Beam angle','Per procedure','','','','',''],['Reference sensitivity (dB)','Per procedure','','','','',''],['Horizontal (time-base) linearity','Per procedure','','','','',''],['Amplitude / gain control linearity','Per procedure','','','','',''],['Resolution / dead zone','Per procedure','','','','','']]},
{k:'tb',t:'Shift verification log',key:'log',c:[['Date',1.6],['Time',1.2],['Technician',2.2],['Job / weld ref.',2.4],['Pre-shift check',1.6],['Post-shift check',1.6],['Remarks',2.2]],rows:[['','','','','','',''],['','','','','','',''],['','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

ncr:{n:'Non-Conformance Report',d:'Finding, location, reference clause, disposition and sign-off',no:'',hd:1,
F:mk([['date','NCR date'],['no','NCR number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],
['dwg','Drawing / document no.'],['wps','WPS no.'],['item','Item / weld no.'],['pos','Position on item'],['rdoc','Reference document'],['rcl','Reference clause'],['disc','Discipline'],['rb','Raised by'],
['find','Description of non-conformance'],['rc','Root cause'],['dsp','Disposition / instruction'],['ca','Corrective action'],['due','Action due date'],['cdate','Closure date'],['ver','Verification of closure'],
['td','Date raised'],['tn','Name'],['tl','Designation'],['ts','Signature'],['o1','Sign-off column 1','CLIENT'],['cn','Name'],['cd','Date'],['cx','Signature'],['o2','Sign-off column 2','QA / QC'],['dn','Name'],['dd','Date'],['dx','Signature'],['o3','Sign-off column 3','CLOSE-OUT'],['en','Name'],['ed','Date'],['ex','Signature']]),
S:[{k:'g',n:4,f:[...RH]},
{k:'g',n:4,t:'Where it was found',f:['dwg','wps','item','pos','rdoc','rcl','disc','rb']},
{k:'ck',t:'Severity',key:'sev',o:['Minor','Major','Critical'],df:[]},
{k:'tx',t:'Finding',f:'find',mh:60},{k:'tx',t:'Root cause',f:'rc',mh:60},
{k:'ck',t:'Disposition',key:'dsk',o:['Accept as is','Repair','Rework','Reject','Concession'],df:[]},
{k:'tx',t:'Disposition / instruction',f:'dsp',mh:60},{k:'tx',t:'Corrective action',f:'ca',mh:60},
{k:'g',n:4,t:'Closure',f:[['due',2],['cdate',2]]},
{k:'ck',t:'Status',key:'sts',o:['Open','Closed'],df:[0]},
{k:'tx',t:'Verification of closure',f:'ver',mh:60},
{k:'sx',leadL:'Date raised',lead:'td',th:'Raised by (DGSL)',tech:['tn','tl','ts'],P:[['o1','cn','cd','cx'],['o2','dn','dd','dx'],['o3','en','ed','ex']]}]},

ipr:{n:'Inspection Procedure / Work Instruction',d:'Numbered procedure with document control, revision history and approval',no:'',gen:1,tsz:15,tag:"Non-Destructive Testing, Coating inspection, Welding Inspection, Labor Supply, Equipment leasing/supply, Training / Consultancy",foot:1,
F:mk([['pno','Procedure no.'],['rev','Revision','0'],['date','Date'],['proj','Project / client'],['meth','Method / technique'],['code','Applicable code'],['prep','Prepared by'],['appr','Approved by'],
...IPR.flatMap(([k,h,t])=>[['h'+k,'Heading '+h.split('.')[0],h],['b'+k,'Text '+h.split('.')[0],t]]),
['pn','Prepared by'],['psg','Signature'],['an','Approved by'],['asg','Signature']]),
S:[{k:'g',n:2,t:'Document control',f:['pno','rev','date','proj','meth','code','prep','appr']},
...IPR.flatMap(([k])=>[{k:'ps',f:'h'+k,b:1,u:1,sz:10.5,gap:4},{k:'ps',f:'b'+k,gap:10}]),
{k:'tb',t:'Revision history',key:'rv',rmin:20,c:[['Rev.',1],['Date',1.6],['Description of change',5],['Prepared',2],['Approved',2]],rows:[['0','','Initial issue','','']]},
{k:'g',n:2,t:'Approval',f:['pn','psg','an','asg']}]},

tcc:{n:'Tank Calibration Certificate',d:'Horizontal and vertical tanks, to API MPMS practice, with capacity table',no:'',hd:1,
F:mk([['date','Date of issue'],['no','Certificate number'],['client','Client / owner'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],
['tno','Tank number'],['prod','Product / service'],['cap','Nominal capacity'],['mfr','Tank manufacturer'],['std','Calibration standard','API MPMS Ch. 2.2A (vertical) / Ch. 2.2E (horizontal)'],['cdt','Calibration date'],['due','Next calibration due'],['ref','Reference temperature','15 °C'],
['dia','Diameter (mm)'],['len','Length / height (mm)'],['hdt','Head type (horizontal)'],['ght','Reference gauge height (mm)'],['dpt','Datum plate / dip point'],['sfc','Safe fill capacity'],['wt','Shell plate thickness (mm)'],['bot','Bottom type'],
['tp','Strapping tape no.'],['tcn','Tape certificate no.'],['det','DET / thermometer no.'],['dcn','DET certificate no.'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH,['tno',1],['prod',1],['cap',1],['mfr',1]]},
{k:'ck',t:'Tank type',key:'ttp',o:['Horizontal cylindrical','Vertical cylindrical','Other'],df:[]},
{k:'ck',t:'Calibration method',key:'cmt',o:['Manual strapping','Optical reference line','Electro-optical ranging','Liquid calibration'],df:[]},
{k:'g',n:4,t:'Calibration details',f:['std','cdt','due','ref']},
{k:'g',n:4,t:'Tank dimensions',f:['dia','len','hdt','ght','dpt','sfc','wt','bot']},
{k:'g',n:4,t:'Equipment and traceability',f:['tp','tcn','det','dcn']},
{k:'nt',x:'Volumes are stated at the reference temperature and apply only to the tank as measured on the calibration date.'},
{k:'tb',t:'Capacity table',key:'ctb',calc:'cap',c:[['Dip / level (mm)',2],['Volume (litres)',2.6],['Volume (m³)',2.2],['Remarks',2.2]],rows:[['','','',''],['','','',''],['','','',''],['','','',''],['','','',''],['','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

tsf:{n:'Tank Strapping Field Sheet',d:'Circumference readings per course with plate thickness and temperature',no:'',hd:1,
F:mk([['date','Strapping date'],['no','Sheet number'],['client','Client / owner'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],
['tno','Tank number'],['prod','Product / service'],['dia','Nominal diameter (mm)'],['ncr','Number of courses'],['ght','Reference gauge height (mm)'],['dpt','Datum plate height (mm)'],['bt','Bottom plate thickness (mm)'],['wx','Weather / wind'],['rf','Roof type'],['ins','Insulation'],
['tp','Strapping tape no.'],['tcn','Tape certificate no.'],['ten','Applied tension (N)'],['det','DET / thermometer no.'],['amb','Ambient temperature (°C)'],['stm','Shell temperature (°C)'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH,['tno',1],['prod',1],['dia',1],['ncr',1]]},
{k:'ck',t:'Tank type',key:'ttp',o:['Vertical cylindrical','Horizontal cylindrical','Other'],df:[0]},
{k:'g',n:4,t:'Datum and conditions',f:['ght','dpt','bt','wx','rf','ins','amb','stm']},
{k:'g',n:4,t:'Strapping equipment',f:['tp','tcn','ten','det']},
{k:'tb',t:'Circumference readings per course',key:'str',calc:'tsf',c:[['Course',1],['Course height (mm)',1.8],['Circ. 1 (mm)',2],['Circ. 2 (mm)',2],['Mean circ. (mm)',2],['Plate thk (mm)',1.6],['Shell temp (°C)',1.5],['Remarks',2]],rows:[['1','','','','','','',''],['2','','','','','','',''],['3','','','','','','',''],['4','','','','','','',''],['5','','','','','','',''],['6','','','','','','','']]},
{k:'tb',t:'Deadwood and appurtenances',key:'dwd',c:[['Item',3],['Location / course',2],['Size L×W×H (mm)',3],['Volume (litres)',2],['Remarks',2]],rows:[['','','','',''],['','','','',''],['','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

ctv:{n:'Calibration Tape and DET Verification Record',d:'Traceability sheet for strapping tapes and electronic thermometers',no:'',hd:1,
F:mk([['date','Verification date'],['no','Record number'],['client','Client / owner'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],
['mtp','Reference master tape no.'],['mcn','Master tape certificate no.'],['mlb','Calibration laboratory'],['ten','Applied tension (N)'],['vt','Verification temperature (°C)'],
['rth','Reference thermometer no.'],['rcn','Reference thermometer cert. no.'],['proc','Verification procedure'],['rem','Remarks'],...RS]),
S:[{k:'g',n:4,f:[...RH]},
{k:'g',n:4,t:'Reference standards',f:['mtp','mcn','mlb','ten','vt','rth','rcn','proc']},
{k:'nt',x:'Deviation = unit reading − reference reading. Result is filled in automatically once a tolerance is entered.'},
{k:'tb',t:'Strapping tapes',key:'tpe',calc:'tape',c:[['Tape ID',1.6],['Serial no.',1.6],['Length (m)',1.2],['Certificate no.',1.8],['Master reading (mm)',1.7],['Tape reading (mm)',1.7],['Deviation (mm)',1.5],['Tolerance (mm)',1.4],['Result',1.2],['Next due',1.5]],rows:[['','','','','','','','','',''],['','','','','','','','','',''],['','','','','','','','','','']]},
{k:'tb',t:'Electronic thermometers (DET)',key:'dtt',calc:'det',c:[['DET ID',1.6],['Serial no.',1.6],['Certificate no.',1.8],['Reference (°C)',1.5],['Unit reading (°C)',1.6],['Deviation (°C)',1.5],['Tolerance (°C)',1.4],['Result',1.2],['Next due',1.5]],rows:[['','','','','','','','',''],['','','','','','','','',''],['','','','','','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},RSX]},

/* ===== v78: HSE, site and business templates ===== */
tbt:{n:'Toolbox Talk Record',d:'Topic, key points and attendee list with signatures',no:'',hd:1,
F:mk([['date','Talk date'],['no','Record number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['topic','Topic'],['pres','Presented by'],['time','Start time'],['dur','Duration (min)'],['pts','Key points discussed'],['haz','Hazards and controls covered'],['qs','Questions / actions raised'],...SXF('Date','SITE SUPERVISOR','HSE OFFICER','CLIENT')]),
S:[{k:'g',n:4,f:[...RH,['topic',2],['pres',2],['time',2],['dur',2]]},
{k:'ck',t:'Topic category',key:'tbc',o:['At height','Hot work','Manual handling','PPE','Other'],df:[]},
{k:'tx',t:'Key points discussed',f:'pts',mh:60},{k:'tx',t:'Hazards and controls covered',f:'haz',mh:48},{k:'tx',t:'Questions / actions raised',f:'qs',mh:40},
{k:'tb',t:'Attendees',key:'att',c:[['No.',.8],['Name',3.4],['Company / designation',2.8],['Signature',2.6]],rmin:22,rows:NR(10,4)},
SXS('Date','Presenter')]},

jsa:{n:'Job Safety Analysis (JSA)',d:'Job steps, hazards, risk ratings and control measures',no:'',hd:1,
F:mk([['date','Date'],['no','JSA number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['job','Job / task description'],['area','Work area'],['perm','Permit no.'],['tlr','Team leader'],['ppe','PPE required'],['emg','Emergency contact / muster point'],['rem','Remarks'],...SXF('Date','SUPERVISOR','HSE OFFICER','CLIENT')]),
S:[{k:'g',n:4,f:[...RH,['job',2],['area',2],['perm',1],['tlr',1],['ppe',2],['emg',4]]},
{k:'nt',x:'Risk rating: L = Low, M = Medium, H = High (likelihood x severity). Re-rate after controls are applied.'},
{k:'tb',t:'Job steps, hazards and controls',key:'jsa',c:[['No.',.8],['Job step',3],['Hazards',3],['Risk before',1.3],['Control measures',3.6],['Risk after',1.3],['Responsible',1.8]],rmin:30,rows:NR(6,7)},
{k:'ck',t:'Overall residual risk',key:'rsk',o:['Low','Medium','High'],df:[]},
{k:'tx',t:'Remarks',f:'rem'},SXS('Date','Prepared by')]},

ptw:{n:'Permit to Work / Hot Work Permit',d:'Permit with validity times, precautions, extensions and sign-offs',no:'',hd:1,
F:mk([['date','Date of issue'],['no','Permit number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['desc','Description of work'],['wloc','Exact work location'],['eqp','Equipment / tools'],['iss','Issued to (contractor)'],['nop','Number of personnel'],['vf','Valid from (date / time)'],['vt','Valid to (date / time)'],['hz','Hazards identified'],['ppe','PPE required'],['gas','Gas test result / time'],['fw','Fire watch name'],['hb','Handback remarks'],...SXF('Date','PERFORMER','HSE / SAFETY','CLIENT / AREA')]),
S:[{k:'g',n:4,f:[...RH,['desc',4],['wloc',2],['eqp',2],['iss',2],['nop',2],['vf',2],['vt',2],['hz',2],['ppe',2],['gas',2],['fw',2]]},
{k:'ck',t:'Permit type',key:'ptt',o:['Hot work','Cold work','Confined','At height','Electrical','Radiography'],df:[]},
{k:'ck',t:'Precautions confirmed',key:'pcn',o:['Area cleared','Extinguisher','Fire watch','Gas tested','Isolated','Barricaded'],df:[]},
{k:'tb',t:'Extension / revalidation',key:'ext',c:[['Date',1.6],['From',1.4],['To',1.4],['Extended by',2.4],['Accepted by',2.4]],rows:[['','','','',''],['','','','','']]},
{k:'tx',t:'Handback remarks',f:'hb'},SXS('Date','Permit issuer')]},

inc:{n:'Incident / Near-Miss Report',d:'What happened, immediate action, root cause and corrective actions',no:'',hd:1,
F:mk([['date','Report date'],['no','Report number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['idt','Date / time of incident'],['ipl','Exact location'],['inv','Person(s) involved'],['wit','Witnesses'],['eq','Equipment involved'],['rto','Reported to'],['what','What happened'],['imm','Immediate action taken'],['inj','Injuries / damage'],['rc','Root cause'],...SXF('Date','SITE SUPERVISOR','HSE OFFICER','CLIENT')]),
S:[{k:'g',n:4,f:[...RH,['idt',2],['ipl',2],['inv',2],['wit',2],['eq',2],['rto',2]]},
{k:'ck',t:'Type',key:'ity',o:['Near miss','First aid','Medical','Lost time','Property','Environment'],df:[]},
{k:'ck',t:'Severity',key:'isv',o:['Low','Medium','High','Critical'],df:[]},
{k:'tx',t:'What happened',f:'what',mh:70},{k:'tx',t:'Immediate action taken',f:'imm',mh:45},{k:'tx',t:'Injuries / damage',f:'inj',mh:36},{k:'tx',t:'Root cause',f:'rc',mh:45},
{k:'tb',t:'Corrective and preventive actions',key:'cpa',c:[['No.',.8],['Action',5],['Owner',2],['Due date',1.8],['Status',1.5]],rmin:22,rows:NR(3,5)},
SXS('Date','Reported by')]},

pjs:{n:'Pre-Job Safety Checklist',d:'Mark Yes, No or N/A for each safety check before work starts',no:'',hd:1,
F:mk([['date','Date'],['no','Checklist number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['job','Job description'],['perm','Permit no.'],['sup','Supervisor'],['crew','Number in crew'],['rem','Remarks'],...SXF('Date','SUPERVISOR','HSE OFFICER','CLIENT')]),
S:[{k:'g',n:4,f:[...RH,['job',2],['perm',1],['sup',1],['crew',4]]},
{k:'nt',x:'Mark Yes, No or N/A with x. Every "No" must be corrected before work starts.'},
{k:'tb',t:'Checklist',key:'chk',c:[['No.',.8],['Item',6],['Yes',1],['No',1],['N/A',1],['Comment',2.6]],rmin:20,rows:[['1','Permit to work issued and displayed','','','',''],['2','JSA completed and understood by the whole crew','','','',''],['3','Toolbox talk held and attendance recorded','','','',''],['4','Crew trained, certified and fit for the task','','','',''],['5','Correct PPE worn (hard hat, safety shoes, coverall, gloves, glasses)','','','',''],['6','Work area inspected, barricaded and signposted','','','',''],['7','Equipment inspected, calibrated and in good condition','','','',''],['8','Electrical equipment and cables in safe condition','','','',''],['9','Fire extinguisher available and in date','','','',''],['10','First aid kit and emergency contacts available','','','',''],['11','Muster point and emergency route known to all','','','',''],['12','Access, lifting and working-at-height arrangements safe','','','',''],['13','Hot work, radiography or confined-space controls in place where applicable','','','',''],['14','Housekeeping: area clear of hazards and waste','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},SXS('Date','Checked by')]},

dsr:{n:'Daily Site Report',d:'Work done, crew and hours, equipment, delays and plan for tomorrow',no:'',hd:1,
F:mk([...RHD,['wx','Weather'],['hrs','Working hours'],['sup','Site supervisor'],['wo','Work order / PO no.'],['shf','Shift'],['done','Work done today'],['plan','Planned for tomorrow'],['dly','Delays / issues'],['hse','HSE observations'],...SXF('Date','CLIENT REP.','PROJECT MANAGER','HSE OFFICER')]),
S:[{k:'g',n:4,f:[...RH,['wx',1],['hrs',1],['sup',2],['wo',2],['shf',2]]},
{k:'tx',t:'Work done today',f:'done',mh:80},
{k:'tb',t:'Crew',key:'crew',calc:'crew',c:[['No.',.8],['Name',3],['Role',2.4],['Time in',1.3],['Time out',1.3],['Hours',1.2]],rmin:20,rows:NR(5,6)},
{k:'tb',t:'Equipment on site',key:'eqp',c:[['No.',.8],['Equipment',3.4],['ID / serial no.',2.2],['Hours used',1.4],['Status',1.8]],rmin:20,rows:NR(4,5)},
{k:'tx',t:'Delays / issues',f:'dly',mh:45},{k:'tx',t:'HSE observations',f:'hse',mh:36},{k:'tx',t:'Planned for tomorrow',f:'plan',mh:45},
SXS('Date','Prepared by')]},

edn:{n:'Equipment Handover / Delivery Note',d:'Items, condition out and in, with handover signatures',no:'',hd:1,
F:mk([['date','Date'],['no','Note number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['from','From'],['to','Delivered to'],['po','PO / work order no.'],['veh','Vehicle / driver'],['rem','Remarks'],...SXF('Date','RECEIVED BY','DRIVER / CARRIER','WITNESS')]),
S:[{k:'g',n:4,f:[...RH,['from',2],['to',2],['po',2],['veh',2]]},
{k:'ck',t:'Movement type',key:'mvt',o:['Delivery','Handover','Return','Transfer'],df:[]},
{k:'tb',t:'Items',key:'itm',c:[['No.',.8],['Description',4],['Serial / tag no.',2.4],['Qty',1],['Condition out',2],['Condition in',2]],rmin:22,rows:NR(8,6)},
{k:'tx',t:'Remarks',f:'rem'},SXS('Date','Handed over by')]},

mob:{n:'Mobilization Checklist',d:'People, equipment, documents and transport ready before leaving for site',no:'',hd:1,
F:mk([['date','Mobilization date'],['no','Checklist number'],['client','Client'],['con','Contractor','DANHOLSEN GLOBAL SERVICES LIMITED'],['proj','Project name'],['loc','Location'],['sit','Site / destination'],['lead','Crew leader'],['wo','Work order / PO no.'],['dep','Planned departure'],['arr','Planned arrival'],['rem','Remarks'],...SXF('Date','PROJECT MANAGER','HSE OFFICER','CLIENT')]),
S:[{k:'g',n:4,f:[...RH,['sit',2],['lead',2],['wo',1],['dep',1],['arr',2]]},
{k:'nt',x:'Mark Done with x and enter the date. Anything not done must be explained under Remarks.'},
{k:'tb',t:'Checklist',key:'mob',c:[['No.',.8],['Item',5],['Responsible',2],['Done',1],['Date',1.5],['Remarks',2.5]],rmin:20,rows:[['1','Work order / PO and scope confirmed','','','',''],['2','Crew list agreed and client notified','','','',''],['3','Personnel certificates valid (NDT level, safety, medical)','','','',''],['4','Site access permits and induction arranged','','','',''],['5','PPE issued to all crew','','','',''],['6','Instruments calibrated and certificates in date','','','',''],['7','Probes, cables, blocks and accessories checked','','','',''],['8','Consumables and couplant packed','','','',''],['9','Procedures, forms and report templates ready','','','',''],['10','Tools and spares packed','','','',''],['11','First aid kit and fire extinguisher packed','','','',''],['12','Vehicle inspected, fuelled and driver briefed','','','',''],['13','Accommodation and transport arranged','','','',''],['14','Communication and emergency contacts shared','','','',''],['15','Equipment loaded and checked against packing list','','','','']]},
{k:'tx',t:'Remarks',f:'rem'},SXS('Date','Prepared by')]},

mtg:{n:'Meeting Minutes',d:'Attendees, agenda, decisions and actions with owners and due dates',no:'',gen:1,tsz:15,tag:"Non-Destructive Testing, Coating inspection, Welding Inspection, Labor Supply, Equipment leasing/supply, Training / Consultancy",foot:1,
F:mk([['mno','Reference no.'],['date','Date'],['proj','Project / client'],['time','Time'],['venue','Venue'],['chair','Chairperson'],['rec','Minutes taken by'],['next','Next meeting'],['agn','Agenda','1.\n2.\n3.'],['aob','Any other business'],['pn','Prepared by'],['psg','Signature'],['an','Approved by'],['asg','Signature']]),
S:[{k:'g',n:2,t:'Meeting details',f:['mno','date','proj','time','venue','chair','rec','next']},
{k:'tb',t:'Attendees',key:'att',rmin:20,c:[['No.',.8],['Name',3],['Company / role',3],['Present',1.4]],rows:NR(5,4)},
{k:'ps',f:'agn',lead:'Agenda',gap:10,min:3},
{k:'tb',t:'Discussion, decisions and actions',key:'dis',rmin:24,c:[['No.',.8],['Item discussed',3],['Decision / action',3.4],['Action by',1.8],['Due',1.4]],rows:NR(3,5)},
{k:'ps',f:'aob',lead:'Any other business',gap:10,min:1},
{k:'g',n:2,t:'Approval',f:['pn','psg','an','asg']}]},

quo:{n:'Quotation',d:'Priced quotation with items, VAT, terms and client acceptance',no:'',gen:1,tsz:20,tag:"Non-Destructive Testing, Coating inspection, Welding Inspection, Labor Supply, Equipment leasing/supply, Training / Consultancy",foot:1,
F:mk([['to','Quotation to'],['qno','Quotation no.'],['date','Date'],['vld','Valid until'],['ref','Subject / enquiry ref.'],['tot','Total (NGN)'],['vat','VAT 7.5% (NGN)'],['grand','Grand total (NGN)'],['words','Amount in words'],['terms','Terms','• This quotation is valid for the period stated above.\n• Payment terms: to be agreed.\n• Variations to the scope will be quoted separately.'],['an','Account name','Danholsen Global Service Limited'],['bn','Bank name','Premium Trust Bank'],['ac','Account number','0040018522'],['cn','Accepted by (name)'],['cd','Date'],['cs','Signature']]),
S:[{k:'ps',f:'to',lead:'TO',min:3},{k:'g',n:2,f:[['qno',1],['date',1],['vld',1],['ref',1]]},
{k:'tb',key:'items',calc:'inv',c:[['Qty',1],['Description',5],['UOM',1.4],['Rate (NGN)',2],['Amount (NGN)',2.2]],al:['center','left','center','right','right'],rows:[['','','','',''],['','','','',''],['','','','','']]},
{k:'g',n:3,f:['tot','vat','grand']},{k:'g',n:1,f:['words']},{k:'ps',f:'terms',lead:'Terms',gap:8},
{k:'g',n:3,t:'Bank details',f:['an','bn','ac']},{k:'g',n:3,t:'Client acceptance',f:['cn','cd','cs']}]},

exp:{n:'Expense Claim',d:'Dated expense lines with receipts, total, advance and approvals',no:'',gen:1,tsz:20,tag:"Non-Destructive Testing, Coating inspection, Welding Inspection, Labor Supply, Equipment leasing/supply, Training / Consultancy",foot:1,
F:mk([['emp','Employee name'],['dep','Department'],['cno','Claim no.'],['date','Claim date'],['per','Period covered'],['proj','Project / cost centre'],['pur','Purpose of claim'],['tot','Total claimed (NGN)'],['adv','Advance received (NGN)'],['due','Balance due (NGN)'],['pay','Payment details (bank / account no.)'],['cn','Claimant'],['cs','Signature'],['an','Approved by'],['asg','Signature'],['fn','Finance'],['fsg','Signature']]),
S:[{k:'g',n:2,t:'Claim details',f:['emp','dep','cno','date','per','proj']},{k:'g',n:1,f:['pur']},
{k:'tb',t:'Expenses',key:'lines',calc:'exp',rmin:20,c:[['No.',.8],['Date',1.6],['Description',4],['Category',2],['Receipt no.',1.6],['Amount (NGN)',2.2]],al:['center','center','left','left','center','right'],rows:NR(8,6)},
{k:'g',n:3,f:['tot','adv','due']},{k:'g',n:1,f:['pay']},
{k:'g',n:2,t:'Approval',f:['cn','cs','an','asg','fn','fsg']}]},
};
const secs=t=>TPL[t].S;
docs.forEach(x=>{const T=TPL[x&&x.t];if(T&&x.d)Object.entries(T.F).forEach(([k,f])=>{if(x.d[k]===undefined)x.d[k]=f.df})});
/* ---------- header logos: every document carries its own list (Danholsen first by default) ---------- */
const DG=window.DG_URI||'danholsen-full.png',MAXLG=6;
let lib=LS('dw.lib',null),legacyLg=null;
let sigs=LS('dw.sigs',[]),sgk=null,sigDef=LS('dw.sigdef',null),sigAuto=LS('dw.sigauto',false);
const defSig=()=>sigs.find(x=>x.id===sigDef)||null,
 DS={trn:'ss',tsh:'as',mpi:'ts',ut:'ts',plt:'ts',pt:'ts',cal:'ts',ncr:'ts',tcc:'ts',tsf:'ts',ctv:'ts',tbt:'ts',jsa:'ts',ptw:'ts',inc:'ts',pjs:'ts',dsr:'ts',edn:'ts',mob:'ts'},   /* the Danholsen-side signature field of each template (the Job Completion Form is signed by the client) */
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
const ST={jcf:'jcf',trn:'trn',tsh:'tsh',mpi:'rep',ut:'rep',inv:'gen',ltr:'gen',trq:'gen',vpr:'gen',plt:'rep',pt:'rep',cal:'rep',ncr:'rep',ipr:'gen',tcc:'rep',tsf:'rep',ctv:'rep',tbt:'rep',jsa:'rep',ptw:'rep',inc:'rep',pjs:'rep',dsr:'rep',edn:'rep',mob:'rep',mtg:'gen',quo:'gen',exp:'gen'};
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
const dflt=(doc,k)=>{if(ST[doc.t]==='gen'&&k!=='h:t'){const S0=TPL[doc.t].S;if(k.includes('.')){const[a0,c0]=k.split('.'),s=S0.find(x=>x.key===a0);if(s&&s.al&&s.al[+c0])return s.al[+c0]}else{const s=S0.find(x=>x.f===k&&x.al);if(s)return s.al}}return dflt0(doc,k)},
dflt0=(doc,k)=>k==='h:t'?({jcf:'left',trn:'center',tsh:'right'}[doc.t]||'center'):k.includes('.')?'center':(ST[doc.t]==='rep'?'center':'left');
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
  if(s.k==='ps')return`<div class="ps${s.b?' b':''}${s.u?' u':''}" style="margin-bottom:${s.gap??6}px">${s.lead?`<div class="pl">${e(s.lead)}:</div>`:''}${s.lab?`<span class="pk">${e(s.lab)}</span>`:''}${v(s.f,'t')}</div>`;
  if(s.k==='sk')return`<div class="skb"><span class="sa">Side - A</span><span class="sw">${e(s.lab)}</span><i class="ar a1"></i><i class="wl w1"></i><i class="wl w2"></i><i class="ar a2"></i><span class="sb">Side - B</span></div>`;
  if(s.k==='fd'){const R=[[8,[1,5,3,7,2,6,4,8]],[12,[1,5,9,3,7,11,2,6,10,4,8,12]],[16,[1,9,5,13,3,11,7,15,2,10,6,14,4,12,8,16]]];
   return`<div class="fdg">${R.map(([n,r],i)=>{const L=i%2===0;return`<div class="fdr ${L?'':'rt'}"><svg viewBox="0 0 220 220" width="58mm" height="58mm"><circle cx="110" cy="110" r="80" fill="none" stroke="#000" stroke-width="1.2"/>${r.map((x,j)=>{const a=-Math.PI/2+2*Math.PI*j/n;return`<text x="${(110+93*Math.cos(a)).toFixed(1)}" y="${(114+93*Math.sin(a)).toFixed(1)}" text-anchor="middle" font-size="13">${x}</text>`}).join('')}</svg><b>${n} BOLT FLANGE</b></div>`}).join('')}</div>`}
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
  li=l=>`<div class="slot" data-lgo="1"><img src="${l.src}" alt="" draggable="false" style="max-height:${(14*l.s/100).toFixed(1)}mm;max-width:${Math.min(100,l.s)}%"></div>`,
  lg=st==='rep'?`<div class="rh" style="grid-template-columns:${nl?`repeat(${nl},minmax(0,${cw}fr)) `:''}minmax(0,${tw}fr)${nr?` repeat(${nr},minmax(0,${cw}fr))`:''}">${LI.slice(0,nl).map(li).join('')}<div class="rt"><h2 data-ed="t" data-ml="">${ttl}</h2></div>${LI.slice(nl).map(li).join('')}</div>`:(st==='gen'?'<div class="gh">':'')+`<div class="logos">${n?LI.map(li).join(''):'<div class="slot" data-lgo="1"></div>'}</div>`+(st==='gen'?'<span class="rcn">RC: 507622</span></div>':'');
 const head={jcf:`<div class="bar"></div><div class="jt"><h2 data-ed="t" data-ml="">${ttl}</h2><span>JCF NO: <u data-ed="f:no" data-al="no">${e(d.no)}</u></span></div>`,trn:`<div class="ob"><h2 data-ed="t" data-ml="">${ttl}</h2></div>`,tsh:`<div class="tt"><h2 data-ed="t" data-ml="">${ttl}</h2></div>`,rep:'',gen:(T.tag?`<div class="tagl">${e(T.tag)}</div>`:'')+(T.notitle?'':`<div class="gt"><h2 data-ed="t" data-ml="" style="font-size:${T.tsz||15}pt">${ttl}</h2></div>`)}[st];
 return`<div class="sheet st-${st}"><table class="wrap2"><thead><tr><td></td></tr></thead><tbody><tr><td><div class="body">${lg}${head}${T.S.map((x,i)=>PIN.includes(x.k)?'':sec(x,i)).join('')}<div class="bot">${T.S.map((x,i)=>PIN.includes(x.k)?sec(x,i):'').join('')}${T.foot?'<div class="of"><b>OFFICE:</b> #8b Road 1 Fourth Avenue, Rumuibekwe Estate Beside Liquid Bulk Filling Station, Rumukurushi Junction, Port Harcourt, Rivers State, Nigeria<br><b>Phone:</b> +23484555508 +23484555509, +2349021004659 &nbsp; <b>Email:</b> sales@danholsen.com &nbsp; <b>Website:</b> www.danholsen.com</div>':''}<div class="ft"><span>${e(T.no)}</span><span>${st==='jcf'?'':e(d.no||'')}</span></div></div></div></td></tr></tbody><tfoot><tr><td></td></tr></tfoot></table></div>`}

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
 const m0=new Map(docs.map(x=>[x.id,x]));let nw=0,up=0,sm=0;d.docs.forEach(x=>{if(!x||!x.id||!TPL[x.t])return;const o=m0.get(x.id);if(!o)nw++;else if((x.u||0)>(o.u||0))up++;else sm++});
 const nl=(d.lib||[]).filter(l=>l&&l.id&&l.src&&!lib.some(x=>x.id===l.id)).length,ns=(d.sigs||[]).filter(l=>l&&l.id&&l.src&&!sigs.some(x=>x.id===l.id)).length;
 if(!confirm('Backup'+(d.at?' from '+new Date(d.at).toLocaleDateString():'')+'\n\n\u2022 '+nw+' new document'+(nw==1?'':'s')+'\n\u2022 '+up+' updated (backup is newer)\n\u2022 '+sm+' already here, unchanged\n\u2022 '+nl+' new logo'+(nl==1?'':'s')+', '+ns+' new signature'+(ns==1?'':'s')+'\n\nNothing is deleted. A restore point is saved first. Continue?'))return;
 snapTake('Before import');
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
function paint(){const g=$('#stage');g.innerHTML='<div class="shw">'+sheet(cur)+'</div>';hfmt(g);fit();cur.u=Date.now();SV('dw.docs',docs);mark('ok');if(document.getElementById('lgpv'))lgPv()}
function off(el){el.removeAttribute('contenteditable');el.classList.remove('on')}
function activate(el){if(act&&act.el.isConnected&&act.el!==el)off(act.el);
 act={el,pre:snap()};el.setAttribute('contenteditable',PT?'plaintext-only':'true');el.classList.add('on');el.focus({preventScroll:true});
 const r=document.createRange();r.selectNodeContents(el);r.collapse(false);const s=getSelection();s.removeAllRanges();s.addRange(r);
 setBar();setTimeout(()=>{const b=$('#etb'),r=el.getBoundingClientRect(),vh=window.visualViewport?visualViewport.height:innerHeight,top=(b&&b.classList.contains('show')?b.getBoundingClientRect().bottom:0)+16;if(r.top<top||r.bottom>vh-16)scrollBy({top:r.top-top,behavior:'smooth'})},260)}
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
/* Phones and tablets: the edit bar only appears when a box is tapped, and goes away as soon as the page is scrolled with a finger.
   Tapping the box again brings it back. A finger drag is used (not the scroll event) so the automatic scroll that keeps the box in view,
   or the keyboard opening, never hides it. The desktop keeps the bar while a box is active. */
const ebPhone=()=>matchMedia('(max-width:899px),(pointer:coarse)').matches;
let ebY=null,ebT=0;
function ebAway(){const b=$('#etb');if(b&&b.classList.contains('show')&&ebPhone())b.classList.remove('show')}
addEventListener('touchstart',ev=>{if(view!=='ed')return;ebY=ev.target.closest&&ev.target.closest('#etb')?null:ev.touches[0].clientY},{passive:true,capture:true});
addEventListener('touchmove',ev=>{if(view!=='ed'||ebY==null)return;if(Math.abs(ev.touches[0].clientY-ebY)>8){ebY=null;ebAway()}},{passive:true,capture:true});
addEventListener('touchend',()=>{ebY=null},{passive:true,capture:true});
addEventListener('wheel',ev=>{if(view==='ed'&&Math.abs(ev.deltaY)>2&&!(ev.target.closest&&ev.target.closest('#etb'))&&matchMedia('(pointer:coarse)').matches)ebAway()},{passive:true});
function fmKey(el){const id=el.dataset.ed;if(id==='t'||id[0]==='o')return'h:'+(id==='t'?'t':id.slice(2));return id[0]==='f'?id.slice(2):'c:'+el.dataset.key+':'+el.dataset.ci}
function fmEdit(el,fn){const k=fmKey(el),m=(cur.fm=cur.fm||{}),f=m[k]=m[k]||{};fn(f);if(!f.s)delete f.s;if(f.b==null)delete f.b;if(!Object.keys(f).length)delete m[k]}
function mountEditor(){const doc=cur,g=$('#stage'),b=$('#etb');act=null;zm=1;hist=[];paint();updUndo();$('.zm').onclick=ev=>{const z=ev.target.closest('[data-z]');if(!z)return;zm=Math.max(.6,Math.min(2.4,z.dataset.z>0?zm*1.25:zm/1.25));fit()};
 const step=d=>{if(!act)return;const o=act.el.dataset.ed.startsWith('o:'),L=[...g.querySelectorAll('[data-ed]')].filter(x=>x.dataset.ed.startsWith('o:')===o),n=L[L.indexOf(act.el)+d];if(n)activate(n)};
 const re=id=>{const el=g.querySelector(`[data-ed="${id}"]`);if(el)activate(el)};
 g.onclick=ev=>{const t=ev.target,ed=t.closest('[data-ed]');
  if(ed){if(!act||act.el!==ed)activate(ed);else if(!b.classList.contains('show'))setBar();return}
  const ck=t.closest('[data-ck]'),rc=t.closest('[data-rate]'),ad=t.closest('[data-add]'),af=t.closest('[data-addf]'),rf=t.closest('[data-restf]'),rr=t.tagName==='TR'?t.dataset.rr:null;
  if(ck){pushH();const a=doc.d[ck.dataset.ck],n=+ck.dataset.i;doc.d[ck.dataset.ck]=a.includes(n)?a.filter(x=>x!==n):[...a,n];paint()}
  else if(rc){pushH();const k=rc.dataset.rate,j=rc.dataset.j;doc.d[k]=String(doc.d[k])===j?'':j;paint()}
  else if(ad){pushH();const s=secs(doc.t).find(x=>x.key===ad.dataset.add),n=doc.d[s.key].push(s.c.map(()=>''));act=null;paint();re(`r:${s.key}:${n-1}:0`)}
  else if(rr){const[key,ri]=rr.split(':');pushH();doc.d[key].splice(+ri,1);act=null;paint();toast('Row deleted',undo,'Undo')}
  else if(af){pushH();const si=+af.dataset.addf,k='x'+uid();(doc.cf=doc.cf||[]).push({k,si});(doc.o=doc.o||{})['L:'+k]='New field';doc.d[k]='';act=null;paint();re('o:L:'+k);const el=g.querySelector(`[data-ed="o:L:${k}"]`);if(el)getSelection().selectAllChildren(el)}
  else if(rf){pushH();const ks=(TPL[doc.t].S[+rf.dataset.restf].f||[]).map(x=>Array.isArray(x)?x[0]:x);doc.hide=(doc.hide||[]).filter(k=>!ks.includes(k));act=null;paint()}
  else done()};
 g.oninput=ev=>{const el=ev.target.closest('[data-ed]');if(!el)return;if(act&&!act.dirty){act.dirty=1;hist.push(act.pre||snap());if(hist.length>80)hist.shift();updUndo()}const id=el.dataset.ed,v=id[0]==='o'?el.textContent:el.innerText.replace(/\n$/,'');
  if(id==='t'){doc.title=v;$('#ttl').value=v}else if(id[0]==='f'){doc.d[id.slice(2)]=v;calcAll(id.slice(2))}else if(id[0]==='o')(doc.o=doc.o||{})[id.slice(2)]=v;
  else{const r=doc.d[el.dataset.key][+el.dataset.ri];r[+el.dataset.ci]=v;const tt=el.closest('tr').querySelector('[data-tot]');runCalc(el);
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
addEventListener('resize',()=>{if(view==='ed')fit();if(view==='home'||view==='newdoc'||view==='tcat'||view==='files')fitThumbs()});
if(window.visualViewport){const vv=visualViewport;let q=0;
 /* keep the edit bar at its normal on-screen size and glued to the very top of the screen (it only sits under the header while the header is still on screen), even while pinch-zoomed or with the keyboard open */
 const f=()=>{q=0;const b=$('#etb');if(!b)return;const s=vv.scale||1,de=document.documentElement,lw=de.clientWidth,lh=de.clientHeight;
  b.classList.toggle('vz',Math.abs(s-1)>.01);b.style.maxWidth='none';b.style.width=Math.min(vv.width>=900?760:560,vv.width-16)*s+'px';
  const th=document.querySelector('.top'),hb=th?Math.round(th.offsetHeight):0,eth=hb?hb+6:6;b.style.setProperty('--eth',(hb?hb+6:0)+'px');b.style.setProperty('--vs',String(1/s));b.style.setProperty('--vx',(vv.offsetLeft+vv.width/2-lw/2)+'px');b.style.setProperty('--vy',(Math.abs(s-1)>.01?vv.offsetTop-eth+6:vv.offsetTop)+'px')};
 let tq=0;const sch=()=>{if(!q)q=requestAnimationFrame(f);clearTimeout(tq);tq=setTimeout(f,140)};
 const calm=()=>Math.abs((vv.scale||1)-1)<=.01&&vv.offsetTop<2&&vv.offsetLeft<2;   /* ordinary page scrolling: nothing to re-measure, so the bar is left alone and cannot shake */
 vv.addEventListener('resize',sch);const sc2=()=>{if(!calm())sch()};vv.addEventListener('scroll',sc2);addEventListener('scroll',sc2,{passive:true});
 new MutationObserver(sch).observe(document.body,{childList:true,subtree:true})}

/* ---------- header logos: per-document editor + shared logo library ---------- */
function addLogoFile(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{cropLogo(im,src=>{const id=uid();lib.push({id,src});SV('dw.lib',lib);cb(id)})};im.onerror=()=>toast('Could not read that image');im.src=r.result};r.readAsDataURL(f)}
/* ---------- logo cropper: drag the frame, trim margins, and see the report header before the logo is added ---------- */
function cropLogo(im,done){
 const NW=im.naturalWidth||300,NH=im.naturalHeight||150;let box={x:0,y:0,w:NW,h:NH},lock=0,drag=null;
 const m=document.createElement('div');m.id='lgcrop';m.className='lgcrop';
 m.innerHTML=`<div class="lcb"></div><div class="lcs" role="dialog" aria-label="Crop logo"><div class="lgh"><b>Crop logo</b><button type="button" data-cr="x">Cancel</button></div>
 <p class="lgn">Drag the frame, its edges or its corners to keep only the logo. The preview shows how it will sit in the report header.</p>
 <div class="lcwb"><div class="lcw" id="lcw"><img id="lcim" alt="" draggable="false"><div class="lcf" id="lcf"><b data-h="n"></b><b data-h="s"></b><b data-h="e"></b><b data-h="w"></b><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
 <div class="lcc"><button class="lgbtn on" type="button" data-cr="free">Free</button><button class="lgbtn" type="button" data-cr="sq">Square</button><button class="lgbtn" type="button" data-cr="orig">Original shape</button><button class="lgbtn" type="button" data-cr="trim">Trim blank edges</button><button class="lgbtn" type="button" data-cr="reset">Reset</button></div>
 <h3>Preview</h3><div class="lcp"><div class="lcph"><div class="lcpl"><img id="lcpi" alt=""></div><div class="lcpt"><b>Report title</b><small>Header as it prints</small></div></div><div class="lcpo"><img id="lcpo" alt=""><small id="lcpd"></small></div></div>
 <div class="lcx"><button class="btn" type="button" data-cr="x">Cancel</button><button class="btn p" type="button" data-cr="ok">Use logo</button></div></div>`;
 document.body.appendChild(m);
 const w=m.querySelector('#lcw'),img=m.querySelector('#lcim'),fr=m.querySelector('#lcf'),pi=m.querySelector('#lcpi'),po=m.querySelector('#lcpo'),pd=m.querySelector('#lcpd');
 img.src=im.src;let sc=1;
 const out=()=>{const k=Math.min(1,500/Math.max(box.w,box.h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(box.w*k));c.height=Math.max(1,Math.round(box.h*k));c.getContext('2d').drawImage(im,box.x,box.y,box.w,box.h,0,0,c.width,c.height);return c};
 let raf=0;const prev=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const u=out().toDataURL('image/png');pi.src=u;po.src=u;pd.textContent=Math.round(box.w)+' × '+Math.round(box.h)+' px'})};
 const show=()=>{fr.style.left=box.x*sc+'px';fr.style.top=box.y*sc+'px';fr.style.width=box.w*sc+'px';fr.style.height=box.h*sc+'px';prev()};
 const lay=()=>{const mw=Math.min(m.querySelector('.lcs').clientWidth-32,520),mh=Math.round(innerHeight*.34);sc=Math.min(mw/NW,mh/NH,1);img.style.width=NW*sc+'px';img.style.height=NH*sc+'px';w.style.width=NW*sc+'px';w.style.height=NH*sc+'px';show()};
 const clamp=()=>{box.w=Math.max(8,Math.min(NW,box.w));box.h=Math.max(8,Math.min(NH,box.h));box.x=Math.max(0,Math.min(NW-box.w,box.x));box.y=Math.max(0,Math.min(NH-box.h,box.y))};
 const ratio=()=>lock==='sq'?1:lock==='orig'?NW/NH:0;
 const chips=k=>m.querySelectorAll('.lcc [data-cr]').forEach(b=>b.classList.toggle('on',b.dataset.cr===(k||'free')));
 const setLock=k=>{lock=k;chips(k);const r=ratio();if(r){const cx=box.x+box.w/2,cy=box.y+box.h/2;let nw=box.w,nh=nw/r;if(nh>NH){nh=NH;nw=nh*r}if(nw>NW){nw=NW;nh=nw/r}box={x:cx-nw/2,y:cy-nh/2,w:nw,h:nh};clamp()}show()};
 const trim=()=>{const k=Math.min(1,600/Math.max(NW,NH)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(NW*k));c.height=Math.max(1,Math.round(NH*k));const x=c.getContext('2d');x.drawImage(im,0,0,c.width,c.height);let d;try{d=x.getImageData(0,0,c.width,c.height).data}catch{toast('Could not trim this image');return}
  let x0=c.width,y0=c.height,x1=-1,y1=-1;
  for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const i=(y*c.width+xx)*4;if(!(d[i+3]<16||(d[i]>240&&d[i+1]>240&&d[i+2]>240))){if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(y<y0)y0=y;if(y>y1)y1=y}}
  if(x1<0){toast('Nothing to trim');return}const pad=Math.max(1,Math.round(2/k));lock=0;chips(0);
  box={x:x0/k-pad,y:y0/k-pad,w:(x1-x0+1)/k+2*pad,h:(y1-y0+1)/k+2*pad};clamp();show()};
 const close=()=>{removeEventListener('resize',lay);removeEventListener('pointermove',pmv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);removeEventListener('blur',up);m.remove()};
 m.addEventListener('click',ev=>{const b=ev.target.closest('[data-cr]');if(!b)return;const a=b.dataset.cr;
  if(a==='x'){close();return}
  if(a==='ok'){const c=out();close();done(c.toDataURL('image/png'));return}
  if(a==='free')setLock(0);else if(a==='sq')setLock('sq');else if(a==='orig')setLock('orig');else if(a==='trim')trim();else if(a==='reset'){box={x:0,y:0,w:NW,h:NH};setLock(0)}});
 m.querySelector('.lcb').onclick=close;
 const pdn=ev=>{if(ev.button>0)return;const h=ev.target.dataset&&ev.target.dataset.h,inb=ev.target===fr;if(!h&&!inb)return;ev.preventDefault();try{w.setPointerCapture(ev.pointerId)}catch(_){}drag={h:h||'mv',sx:ev.clientX,sy:ev.clientY,b:{...box},id:ev.pointerId}};
 w.addEventListener('pointerdown',pdn);
 const pmv=ev=>{if(!drag||(drag.id!=null&&ev.pointerId!==drag.id))return;const dx=(ev.clientX-drag.sx)/sc,dy=(ev.clientY-drag.sy)/sc,o=drag.b;
  if(drag.h==='mv'){box.x=o.x+dx;box.y=o.y+dy;clamp()}
  else{let x0=o.x,y0=o.y,x1=o.x+o.w,y1=o.y+o.h;const hh=drag.h;if(hh.includes('w'))x0=Math.min(x1-8,Math.max(0,o.x+dx));if(hh.includes('e'))x1=Math.max(x0+8,Math.min(NW,x1+dx));if(hh.includes('n'))y0=Math.min(y1-8,Math.max(0,o.y+dy));if(hh.includes('s'))y1=Math.max(y0+8,Math.min(NH,y1+dy));
   const r=ratio();if(r){let nw=x1-x0,nh=nw/r;if(hh.includes('n'))y0=y1-nh;else y1=y0+nh;if(y0<0){y0=0;nh=y1-y0;nw=nh*r;if(hh.includes('w'))x0=x1-nw;else x1=x0+nw}if(y1>NH){y1=NH;nh=y1-y0;nw=nh*r;if(hh.includes('w'))x0=x1-nw;else x1=x0+nw}}
   box={x:x0,y:y0,w:x1-x0,h:y1-y0};clamp()}
  show()};
 const up=ev=>{if(drag&&ev&&ev.pointerId!=null&&drag.id!=null&&ev.pointerId!==drag.id)return;drag=null};
 addEventListener('pointermove',pmv);addEventListener('pointerup',up);addEventListener('pointercancel',up);addEventListener('blur',up);
 addEventListener('resize',lay);img.onload=lay;if(img.complete)lay()}
function lgPv(){const box=document.getElementById('lgpv');if(!box)return;
 const s=document.querySelector('#stage .sheet'),h=s&&s.querySelector('.body>.rh,.body>.logos');
 if(!h){box.innerHTML='';box.style.height='0';return}
 const W=794,k=Math.min(1,(box.clientWidth||W)/W),o=document.createElement('div');o.className='lgpvo';
 o.innerHTML='<div class="'+s.className+' lgpvs"><div class="body"></div></div>';
 const sh=o.firstChild;sh.querySelector('.body').appendChild(h.cloneNode(true));
 box.innerHTML='';box.appendChild(o);o.style.width=W+'px';o.style.transform='scale('+k+')';
 box.style.height=Math.ceil(sh.getBoundingClientRect().height)+'px'}
function lgPanel(){let p=$('#lgp');if(!p){p=document.createElement('div');p.id='lgp';p.className='lgp';document.body.appendChild(p)}
 cur.lg=(cur.lg||[]).filter(l=>l.id==='dg'||lib.some(x=>x.id===l.id));
 const LI=lgItems(cur),n=LI.length;lgs=Math.max(0,Math.min(lgs,n-1));const sl=LI[lgs],used=new Set(cur.lg.map(l=>l.id)),
  av=[{id:'dg',src:DG},...lib].filter(l=>!used.has(l.id));
 p.innerHTML=`<div class="lgb" data-lg="close"></div><div class="lgs"><div class="lgst"><div class="lgh"><b>Header logos</b><span class="lgha"><button data-lg="goadd">+ Add logo</button><button data-lg="close">Done</button></span></div><p class="lgn">${n?n+' logo'+(n==1?'':'s')+' on this document \u00b7 tap one to adjust it, tap \u00d7 to remove it.':'No logos on this document \u00b7 the title takes the whole header.'}</p><div class=\"lgpv\" id=\"lgpv\" aria-label=\"Live header preview\"></div></div>
 <div class="lgr">${LI.map((l,i)=>`<div class="lgw"><button class="lgc${i===lgs?' sel':''}" data-lg="sel" data-i="${i}" aria-label="Adjust logo ${i+1} of ${n}"><img src="${l.src}" alt=""></button><button class="libx rmx" data-lg="rmi" data-i="${i}" aria-label="Remove logo ${i+1} from this document">\u00d7</button></div>`).join('')}</div>
 ${sl?`<div class="lgx"><div class="lm"><button class="btn" data-lg="mv" data-d="-1"${lgs?'':' disabled'}>\u2190 Move left</button><button class="btn" data-lg="mv" data-d="1"${lgs<n-1?'':' disabled'}>Move right \u2192</button></div><div class="sz szh">Size <b id="lgv">${sl.s}%</b></div><div class="szr"><button class="nx szb" type="button" data-lzs="-1" aria-label="Smaller by 1 percent (hold to repeat)">−</button><input type="range" id="lgz" min="30" max="150" step="1" value="${sl.s}" aria-label="Logo size"><button class="nx szb" type="button" data-lzs="1" aria-label="Larger by 1 percent (hold to repeat)">+</button></div><div class="szq">${[50,75,100,125,150].map(p=>`<button class="chip${sl.s===p?' on':''}" type="button" data-lzp="${p}">${p}%</button>`).join('')}</div><button class="btn d" data-lg="rm">Remove from this document</button></div>`:''}
 <h3 id="lgadd">Add a logo</h3>${n>=MAXLG?`<p class="lgn">A document can carry up to ${MAXLG} logos.</p>`:`<div class="lgr">${av.map(l=>l.id==='dg'?`<button class="lgc" data-lg="add" data-id="dg"><img src="${l.src}" alt=""></button>`:`<div class="lgw"><button class="lgc" data-lg="add" data-id="${l.id}"><img src="${l.src}" alt=""></button><button class="libx" data-lg="del" data-id="${l.id}" aria-label="Delete this saved logo">\u00d7</button></div>`).join('')}<label class="lgc up"><span>+</span><small>Upload</small><input type="file" accept="image/*" hidden data-lgf="1"></label></div>${lib.length?`<p class="lgn">Tap a saved logo to add it. Tap its \u00d7 to delete it from your library for good.</p><button class="btn d" data-lg="clr">${lib.length==1?'Clear saved logo':'Clear all '+lib.length+' saved logos'}</button>`:''}`}</div>`;lgPv()}
document.addEventListener('click',ev=>{
 if(view==='ed'&&ev.target.closest('[data-lgo],[data-lg="open"]')&&!ev.target.closest('#lgp')){lgPanel();return}
 const b=ev.target.closest('#lgp [data-lg]');
 if(b&&view==='ed'){const a=b.dataset.lg,L=cur.lg;
  if(a==='goadd'){const t=document.getElementById('lgadd');if(t)t.scrollIntoView({block:'start',behavior:'smooth'});return}
  if(a==='del'||a==='clr'){const one=a==='del';if(confirm(one?'Delete this saved logo from your library? Documents using it will no longer show it.':(lib.length==1?'Delete your saved logo from your library? Documents using it will no longer show it.':'Delete all '+lib.length+' saved logos from your library? Documents using them will no longer show them.'))){lib=one?lib.filter(x=>x.id!==b.dataset.id):[];SV('dw.lib',lib);if(!one)SV('dw.logos',[]);cur.lg=(cur.lg||[]).filter(l=>l.id==='dg'||lib.some(x=>x.id===l.id));lgs=0;paint();lgPanel()}return}
  if(a!=='close'&&a!=='sel')pushH();
  if(a==='close'){$('#lgp').remove();return}
  if(a==='sel')lgs=+b.dataset.i;
  else if(a==='mv'){const j=lgs+ +b.dataset.d;if(j<0||j>=L.length)return;[L[lgs],L[j]]=[L[j],L[lgs]];lgs=j;paint()}
  else if(a==='rm'){L.splice(lgs,1);paint()}
  else if(a==='rmi'){const i=+b.dataset.i;if(i>=0&&i<L.length){L.splice(i,1);if(lgs>i||lgs>=L.length)lgs=Math.max(0,lgs-(lgs>i?1:0));lgs=Math.max(0,Math.min(lgs,L.length-1));paint();toast('Logo removed',undo,'Undo')}}
  else if(a==='add'){if(L.length>=MAXLG)return;const it={id:b.dataset.id,s:100};if(it.id==='dg'){L.unshift(it);lgs=0}else{L.push(it);lgs=L.length-1}paint()}
  lgPanel();return}
 const ca=ev.target.closest('[data-libclr]');
 if(ca&&view==='set'){if(confirm((lib.length==1?'Remove your saved logo from your library? The Danholsen logo stays. Documents using it will no longer show it.':'Remove all '+lib.length+' saved logos from your library? The Danholsen logo stays. Documents using these logos will no longer show them.'))){lib=[];SV('dw.lib',lib);SV('dw.logos',[]);toast('Saved logos cleared');render()}return}
 const dl=ev.target.closest('[data-libdel]');
 if(dl&&view==='set'&&confirm('Remove this logo from your library? Documents using it will no longer show it.')){lib=lib.filter(x=>x.id!==dl.dataset.libdel);SV('dw.lib',lib);render()}});
document.addEventListener('input',ev=>{if(ev.target.id!=='lgz'||view!=='ed'||!cur.lg[lgs])return;const v=+ev.target.value;cur.lg[lgs].s=v;const o=$('#lgv');if(o)o.textContent=v+'%';lzSync(v);paint()});
/* logo size: same controls as the signature - 1% steps, hold-to-repeat minus/plus, quick presets, one undo step per adjustment */
function lzSync(v){const r=$('#lgz'),o=$('#lgv');if(r&&+r.value!==v)r.value=v;if(o)o.textContent=v+'%';document.querySelectorAll('#lgp [data-lzp]').forEach(b=>b.classList.toggle('on',+b.dataset.lzp===v))}
{let hold=null,rep=null;
 const cs=()=>(cur&&cur.lg&&cur.lg[lgs]&&cur.lg[lgs].s)||100,
 setL=v=>{if(view!=='ed'||!cur.lg||!cur.lg[lgs])return;v=Math.max(30,Math.min(150,Math.round(v)));if(cur.lg[lgs].s===v)return;cur.lg[lgs].s=v;lzSync(v);paint()},
 stop=()=>{clearTimeout(hold);clearInterval(rep);hold=rep=null};
 document.addEventListener('pointerdown',ev=>{if(view!=='ed')return;
  if(ev.target.id==='lgz'){pushH();return}
  const b=ev.target.closest&&ev.target.closest('#lgp [data-lzs]');if(!b)return;ev.preventDefault();stop();pushH();
  const d=+b.dataset.lzs;setL(cs()+d);hold=setTimeout(()=>{rep=setInterval(()=>setL(cs()+d),55)},380)});
 ['pointerup','pointercancel','pointerleave','blur'].forEach(t=>addEventListener(t,stop,true));
 document.addEventListener('click',ev=>{if(view!=='ed')return;
  if(ev.target.closest&&ev.target.closest('[data-undo]'))setTimeout(()=>{if($('#lgp'))lzSync(cs())},0);
  const p=ev.target.closest&&ev.target.closest('#lgp [data-lzp]');if(p){pushH();setL(+p.dataset.lzp);return}
  const b=ev.target.closest&&ev.target.closest('#lgp [data-lzs]');if(b&&ev.detail===0){pushH();setL(cs()+(+b.dataset.lzs))}})}

/* ---------- signatures: import once, reuse on any signature field ---------- */
/* Removes the paper from a photographed or scanned signature. The paper level is measured locally (a block at a time),
   so shadows, uneven light and tinted paper all become transparent while the ink keeps its colour. */
function paperOut(p,L,w,h){
 const B=Math.max(8,Math.round(Math.max(w,h)/30)),gx=Math.ceil(w/B),gy=Math.ceil(h/B),G=new Float32Array(gx*gy),hs=new Uint32Array(256);
 for(let by=0;by<gy;by++)for(let bx=0;bx<gx;bx++){hs.fill(0);let n=0;
  for(let y=by*B;y<Math.min(h,by*B+B);y++)for(let x=bx*B;x<Math.min(w,bx*B+B);x++){hs[L[y*w+x]]++;n++}
  let c=0,t=n*.8,lv=255;for(let l=0;l<256;l++){c+=hs[l];if(c>=t){lv=l;break}}G[by*gx+bx]=lv}
 /* a block full of ink must not be mistaken for paper: borrow the brightest neighbour */
 const G2=new Float32Array(G.length);
 for(let by=0;by<gy;by++)for(let bx=0;bx<gx;bx++){let m=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const yy=by+dy,xx=bx+dx;if(yy>=0&&xx>=0&&yy<gy&&xx<gx)m=Math.max(m,G[yy*gx+xx])}G2[by*gx+bx]=Math.max(G[by*gx+bx],m*.97)}
 const HI=.88,LO=.6;
 for(let y=0;y<h;y++){const fy=Math.max(0,Math.min(gy-1,(y+.5)/B-.5)),y0=Math.floor(fy),y1=Math.min(gy-1,y0+1),ty=fy-y0;
  for(let x=0;x<w;x++){const fx=Math.max(0,Math.min(gx-1,(x+.5)/B-.5)),x0=Math.floor(fx),x1=Math.min(gx-1,x0+1),tx=fx-x0;
   let pl=(G2[y0*gx+x0]*(1-tx)+G2[y0*gx+x1]*tx)*(1-ty)+(G2[y1*gx+x0]*(1-tx)+G2[y1*gx+x1]*tx)*ty;pl=Math.max(pl,110);
   const j=y*w+x,i=j*4,r=L[j]/pl,al=r>=HI?0:r<=LO?255:Math.round((HI-r)/(HI-LO)*255),k=Math.min(2.2,255/pl)*.55;
   p[i+3]=al;p[i]=Math.min(255,p[i]*k);p[i+1]=Math.min(255,p[i+1]*k);p[i+2]=Math.min(255,p[i+2]*k)}}}
function addSigFile(f,cb){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{
 const k=Math.min(1,700/im.width,350/im.height),w=Math.max(1,Math.round(im.width*k)),h=Math.max(1,Math.round(im.height*k)),c=document.createElement('canvas');c.width=w;c.height=h;
 const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(im,0,0,w,h);
 let px;try{px=x.getImageData(0,0,w,h)}catch{toast('Could not read that image');return}
  const p=px.data,L=new Uint8Array(w*h);let nA=0;
 for(let i=0,j=0;i<p.length;i+=4,j++){const al=p[i+3];if(al<250)nA++;L[j]=al<10?255:(p[i]*.299+p[i+1]*.587+p[i+2]*.114)|0}
 if(nA<=w*.02*h)paperOut(p,L,w,h); /* photo / scan / white-background image: paper becomes transparent. Images that already have transparency are kept as they are. */
 let x0=w,y0=h,x1=-1,y1=-1;const inkAt=(xx,yy)=>xx>=0&&yy>=0&&xx<w&&yy<h&&p[(yy*w+xx)*4+3]>24;
 for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)if(inkAt(xx,yy)){let nb=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&inkAt(xx+dx,yy+dy))nb++;if(nb<2){p[(yy*w+xx)*4+3]=0;continue}if(xx<x0)x0=xx;if(xx>x1)x1=xx;if(yy<y0)y0=yy;if(yy>y1)y1=yy}
 if(x1<0){toast('No signature found - use dark ink on plain paper');return}
 x.putImageData(px,0,0);x0=Math.max(0,x0-4);y0=Math.max(0,y0-4);x1=Math.min(w-1,x1+4);y1=Math.min(h-1,y1+4);
 const o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
 const id=uid();sigs.push({id,src:o.toDataURL('image/png')});SV('dw.sigs',sigs);if(!sigDef)setDef(id);cb(id)};
 im.onerror=()=>toast('Could not read that image');im.src=r.result};r.readAsDataURL(f)}
function sigOpen(k){sgk=k;sigPanel()}
function sigPanel(){let p=$('#sgp');if(!p){p=document.createElement('div');p.id='sgp';p.className='lgp';document.body.appendChild(p)}
 const T=resolveTpl(cur),g=cur.sg&&cur.sg[sgk],it=g&&sigs.find(x=>x.id===g.id);
 p.innerHTML=`<div class="lgb" data-sg="close"></div><div class="lgs"><div class="lgh"><b>Signature</b><button data-sg="close">Done</button></div><p class="lgn">For the \u201c${e((T.F[sgk]||{}).l||'Signature')}\u201d field. Import a photo or scan once: the paper is removed automatically and it is kept on this device for every report and form. Tap the star on a signature to make it your default.</p>
 ${it?`<div class="sgp0"><img src="${it.src}" alt="Signature"></div><div class="lgx"><div class="sz szh">Size <b id="sgv">${g.s||100}%</b></div><div class="szr"><button class="nx szb" type="button" data-szs="-1" aria-label="Smaller by 1 percent (hold to repeat)">−</button><input type="range" id="sgz" min="25" max="250" step="1" value="${g.s||100}" aria-label="Signature size"><button class="nx szb" type="button" data-szs="1" aria-label="Larger by 1 percent (hold to repeat)">+</button></div><div class="szq">${[50,75,100,125,150].map(p=>`<button class="chip${(g.s||100)===p?' on':''}" type="button" data-szp="${p}">${p}%</button>`).join('')}</div><button class="btn d" data-sg="rm">Remove from this field</button></div>`:''}
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
/* signature size: 1% steps, hold-to-repeat minus/plus, quick presets; one undo step per adjustment */
{let hold=null,rep=null;
 const sync=v=>{const r=$('#sgz'),o=$('#sgv');if(r)r.value=v;if(o)o.textContent=v+'%';document.querySelectorAll('#sgp [data-szp]').forEach(b=>b.classList.toggle('on',+b.dataset.szp===v))},
 setS=v=>{if(view!=='ed'||!cur.sg||!cur.sg[sgk])return;v=Math.max(25,Math.min(250,Math.round(v)));if(cur.sg[sgk].s===v)return;cur.sg[sgk].s=v;sync(v);paint()},
 cur$=()=>(cur.sg&&cur.sg[sgk]&&cur.sg[sgk].s)||100,
 stop=()=>{clearTimeout(hold);clearInterval(rep);hold=rep=null};
 document.addEventListener('pointerdown',ev=>{if(view!=='ed')return;
  if(ev.target.id==='sgz'){pushH();return}
  const b=ev.target.closest&&ev.target.closest('#sgp [data-szs]');if(!b)return;ev.preventDefault();stop();pushH();
  const d=+b.dataset.szs;setS(cur$()+d);hold=setTimeout(()=>{rep=setInterval(()=>setS(cur$()+d),55)},380)});
 ['pointerup','pointercancel','pointerleave','blur'].forEach(t=>addEventListener(t,stop,true));
 document.addEventListener('click',ev=>{if(view!=='ed')return;
  if(ev.target.closest&&ev.target.closest('[data-undo]'))setTimeout(()=>{if($('#sgp')&&cur.sg&&cur.sg[sgk])sync(cur$())},0);
  const p=ev.target.closest&&ev.target.closest('#sgp [data-szp]');if(p){pushH();setS(+p.dataset.szp);return}
  const b=ev.target.closest&&ev.target.closest('#sgp [data-szs]');if(b&&ev.detail===0){pushH();setS(cur$()+(+b.dataset.szs))}})}
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
const bar=(l,r='')=>{const x=l===brand?'':l;return`<header class="top"><div class="tr1">${brand}<div class="sp"></div><span class="offc" role="status">Offline</span><button class="ib" id="thm" aria-label="Switch between light and dark">${thIc()}</button><button class="ib av" id="cfg" aria-label="Your profile and settings">${avIn()}</button></div>${x||r?`<div class="tr2">${x}<div class="sp"></div>${r}</div>`:''}</header>`};
const CI=(p=>Object.fromEntries(Object.entries(p).map(([k,v])=>[k,`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${v}</svg>`])))({
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
phone:'<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
box:'<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
up:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
down:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 8l9 6 9-6"/>',
info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>',
refresh:'<path d="M20 11a8 8 0 0 0-14.5-3.5M4 4v4h4M4 13a8 8 0 0 0 14.5 3.5M20 20v-4h-4"/>',
trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
chev:'<path d="M9 6l6 6-6 6"/>',
shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
logo:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="M21 16l-5-5-9 9"/>'});
/* ---------- v58: storage meter, restore points, changelog ---------- */
var PERSIST=null,SNAPS=[];
let STQ=null;const LSCAP=5*1048576,MB=n=>(n/1048576).toFixed(n<10485760?1:0),SZ=n=>n>=1073741824?(n/1073741824).toFixed(n<10737418240?1:0)+' GB':MB(n)+' MB',

 lsBytes=()=>{let n=DWSTORE.bytes();try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);n+=(k.length+(localStorage.getItem(k)||'').length)*2}}catch{}return n},
 stMeter=()=>{const cap=STQ||LSCAP,u=lsBytes(),p=Math.min(100,u/cap*100),b=document.getElementById('stbar'),t=document.getElementById('sttx');if(b){b.style.width=Math.max(p,2)+'%';b.className=p>=90?'bad':p>=70?'mid':''}if(t)t.textContent=SZ(u)+' used'+(STQ?' - about '+SZ(STQ)+' available on this device':'')+(p>=70?'. Getting full: export a backup, then remove unused logos or documents.':'.')},
 stRefresh=()=>DWSTORE.quota().then(q=>{if(q&&q!==STQ){STQ=q;stMeter()}}),
 CHANGES=[['Sign-in: the app now opens only for approved staff. Admins add people by exact email address (Gmail or @danholsen.com) under Settings, Account, Staff access, and can turn access off or remove it at any time','You can change your password and sign out under Settings, Account','Import spreadsheet now reads the real .xlsx file: tap Choose spreadsheet on the import screen and the app finds the joint tables by their headings, works offline, and builds the MPI and UT reports for every structure it finds','The import screen\u2019s checklist is now worked out from the file itself (missing joint numbers, grades that differ, thickness units, heat numbers)','Header Thickness shows the single value when every joint has the same thickness, and \u201cSee below\u201d only when they differ'],['Import from spreadsheet: New report > Inspection has an Import spreadsheet button that builds the Laydown and Start Up MPI and UT reports (one per method for each structure), with spreadsheet fields marked yellow and technician fields marked blue','Every report and form preview now offers Save to Files in app, Send by WhatsApp or email, and Download to device','Long MPI and UT tables continue on extra pages with the table heading repeated and a continued header','Recent and Files: See all now has a Close button that stays in view while you scroll'],['Home: Recent now shows tiles side by side (2 on phones, 4 on larger screens) with a See all button; Files has a Recent section too','Edit PDF: fixed \u201cThe text on page 1 could not be read\u201d on iPhone, so text lines are editable again and Save PDF keeps the sharp original','Edit PDF: the saved-PDF card no longer pushes Continue off the screen, and page notices no longer cover the document header','Softer yellow glow under Continue editing and the main buttons'],['Select several documents and delete them together: tap Select on Home (Recent) or Select documents inside a Files folder, tick the ones you want, then Delete','Header logos: every logo has its own \u00d7 to remove it from the document, and the live header preview stays pinned at the top of the panel while you scroll the controls','Back now returns to the screen you came from (template list, folder, Files, Settings...), and the phone\u2019s own back swipe or key does the same','Home page rearranged: greeting, Continue editing, New report / New form, tools, then Pinned and Recent with search above the list','Phones: the edit bar appears only when a box is tapped, disappears when you scroll, and returns when you tap the box again'],['New templates: HSE category (Toolbox Talk Record, Job Safety Analysis, Permit to Work / Hot Work Permit, Incident / Near-Miss Report, Pre-Job Safety Checklist), Daily Site Report, Equipment Handover / Delivery Note, Mobilization Checklist, Meeting Minutes, Quotation and Expense Claim','Phones: template categories sit side by side as tiles; the edit bar no longer slides or moves while you scroll or tap to edit','Home page: Continue editing now sits above the backup reminder','Quotation and Expense Claim work out amounts, VAT and totals for you'],
 ['New templates: Pipeline UT Thickness Report, Liquid Penetrant Examination Report, UT Equipment Calibration Record, Non-Conformance Report, Inspection Procedure / Work Instruction, and a new Tank calibration category (Tank Calibration Certificate, Tank Strapping Field Sheet, Calibration Tape and DET Verification Record)','Thickness, strapping and verification tables now calculate wall loss, corrosion rate, mean circumference, deviation and pass / fail for you','New project card on the Files page is clearer in light and dark mode'],
 ['New templates: Invoice, Request Letter, Torquing Procedure for Piping Flanges and Visual Practice Report','Logo panel: a + Add logo button at the top jumps straight to adding and the panel is taller on computers','The floating edit bar no longer shakes while you scroll on a phone','Logo size: the logo panel now shows a live preview of the report header, so you can see each logo get smaller or bigger as you move the slider','"Clear saved logo" wording fixed for a single saved logo','Edit PDF and Send: after saving or sending a PDF a Done button takes you back to the home page','The top bar stays pinned while the document scrolls beneath it','Logos can be cropped before they are added, with a live preview of the report header','Logo size has the same slider as signatures (30 to 150%, 1% steps, presets); the header grows to fit an enlarged logo','Save in a document now makes the PDF and keeps a copy; the entry shows Saved with a download button, and deleting the document deletes its copy','Edit PDF now saves in place: your original PDF stays sharp and small, and only your changes are added (a picture-based save remains as a fallback and as an option)','Edit PDF: undo and redo, headings stay bold when edited, pages stored rotated work, scanned pages explain themselves','Saved logos can now be deleted one at a time or all at once, from Settings and from inside a document','Signatures: better paper removal for phone photos with shadows or tinted paper, and a checkerboard preview that shows the transparency','Logos and signatures and Message wording in Settings now open correctly','Documents, logos and signatures are stored in a much larger space, no longer limited to 5 MB; the storage meter shows the real room left','Light mode: the app background is slightly dimmer than the white cards','Edit PDF: open any PDF, tap a line of text to change it, add new text, and save a new PDF','Bottom menu is locked to the bottom edge of the screen on phones and tablets','Settings redesigned and reorganised','Version card with live update status and a dot on Settings when an update is ready','Restore points: the last 3 copies are kept automatically and before every import','Import shows exactly what will be added or updated before it runs','Storage meter, and a request to keep your data safe from automatic clean-up','Offline indicator, and the last backup-email result shown in Settings','Reset option for a clean start']];
async function snapList(){try{return(await idbGet('snaps'))||[]}catch{return[]}}
async function snapTake(why){const json=bkJSON(),n=docs.length;try{if(!docs.length&&!lib.length&&!sigs.length)return;const l=await snapList();l.unshift({at:Date.now(),why,n,json});const k=l.slice(0,3);await idbSet('snaps',k);SNAPS=k.map(({at,why,n})=>({at,why,n}));SV('dw.lastsnap',Date.now())}catch{}}
async function snapRestore(i){const l=await snapList(),sn=l[i];if(!sn)return;
 if(!confirm('Restore the copy from '+new Date(sn.at).toLocaleString()+' ('+sn.n+' document'+(sn.n==1?'':'s')+')?\n\nYour current documents are saved as a restore point first, then replaced.'))return;
 let d;try{d=JSON.parse(sn.json)}catch{toast('That copy could not be read');return}
 await snapTake('Before restore');
 docs=Array.isArray(d.docs)?d.docs:[];lib.length=0;lib.push(...(d.lib||[]));sigs.length=0;sigs.push(...(d.sigs||[]));if(d.msgs)msgs=Object.assign({},d.msgs);
 SV('dw.docs',docs);SV('dw.lib',lib);SV('dw.sigs',sigs);SV('dw.msgs',msgs);if(d.sigdef&&d.sigdef!==sigDef&&sigs.some(x=>x.id===d.sigdef))setDef(d.sigdef);
 render();toast('Restored')}
async function resetAll(){if(!confirm('Erase ALL documents, logos, signatures and settings from this device?\n\nThis cannot be undone. Export a backup first if you might need anything.'))return;
 const w=prompt('Type ERASE to confirm');if((w||'').trim().toUpperCase()!=='ERASE'){toast('Nothing was erased');return}
 try{Object.keys(localStorage).filter(k=>k.startsWith('dw.')).forEach(k=>localStorage.removeItem(k))}catch{}
 DWSTORE.wipe();try{indexedDB.deleteDatabase('dw-bk')}catch{}
 try{const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch{}
 try{const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()))}catch{}
 location.reload()}
const meSec=()=>{const ed=meEdit===null?!hasMe():meEdit;if(ed&&!meD)meD={...ME};if(!ed)meD=null;
 if(!ed)return`<section class="pane prof"><div class="mev"><span class="mea">${avIn()}</span><div class="mei"><b>${e(ME.n||'')}</b>${[ME.r,ME.p,ME.m].filter(Boolean).map(v=>`<span>${e(v)}</span>`).join('')}</div></div><div class="mea2"><button class="btn" id="meE" type="button">${IC.pen}<span>Edit</span></button><button class="btn" id="meR" type="button">${IC.reset}<span>Reset</span></button></div></section>`;
 const f=(l,k,t='text')=>`<label class="sfl">${l}<input type="${t}" data-md="${k}" value="${e(meD[k]||'')}" autocomplete="off"></label>`;
 return`<section class="pane meedit"><h3>Your details</h3><p class="lead">Used for your greeting on Home and for emailing backups to you. Kept on this device only.</p><div class="mev"><span class="mea">${avIn(meD)}</span><div class="mei"><label class="btn">${IC.cam}<span>${meD.pic?'Change photo':'Add photo'}</span><input type="file" accept="image/*" hidden data-pic="1"></label>${meD.pic?'<button class="btn" id="mePx" type="button">Remove photo</button>':''}</div></div>${f('Full name','n')}${f('Role / title','r')}${f('Phone (WhatsApp)','p','tel')}${f('Email','m','email')}<div class="mea2"><button class="btn p" id="meS" type="button">${IC.save}<span>Save</span></button>${hasMe()?'<button class="btn" id="meC" type="button">Cancel</button><button class="btn" id="meR" type="button">'+IC.reset+'<span>Reset</span></button>':''}</div></section>`};
function picFile(f){const im=new Image(),u=URL.createObjectURL(f);im.onload=()=>{try{const c=document.createElement('canvas'),n=256,k=Math.min(im.naturalWidth,im.naturalHeight),sx=(im.naturalWidth-k)/2,sy=(im.naturalHeight-k)/2;c.width=c.height=n;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,n,n);x.drawImage(im,sx,sy,k,k,0,0,n,n);if(meD)meD.pic=c.toDataURL('image/jpeg',.85);render()}catch{toast('Could not use that picture')}URL.revokeObjectURL(u)};im.onerror=()=>{URL.revokeObjectURL(u);toast('Could not use that picture')};im.src=u}
document.addEventListener('input',ev=>{const k=ev.target.dataset&&ev.target.dataset.md;if(k&&meD)meD[k]=ev.target.value});
document.addEventListener('change',ev=>{const i=ev.target;if(i.dataset&&i.dataset.pic&&i.files&&i.files[0]){picFile(i.files[0]);i.value=''}});
document.addEventListener('click',ev=>{const ct=ev.target.closest('[data-ct]');if(ct&&view==='cfg'){cfgTab=ct.dataset.ct;render();scrollTo({top:0});const m=document.querySelector('main.wrap');if(m)m.scrollTop=0;return}const t=ev.target.closest('#thm,#meE,#meS,#meC,#meR,#mePx');if(!t)return;
 if(t.id==='thm'){theme=eff()==='dark'?'light':'dark';SV('dw.theme',theme);applyTheme();document.querySelectorAll('#thm').forEach(b=>b.innerHTML=thIc());if(view==='cfg')render();return}
 if(t.id==='meE'){meEdit=true;meD={...ME};render();return}
 if(t.id==='meC'){meEdit=false;meD=null;render();return}
 if(t.id==='mePx'){if(meD){delete meD.pic;render()}return}
 if(t.id==='meR'){if(confirm('Clear your name, photo and contact details from this device?')){ME={};SV('dw.me',ME);AU.on=false;SV('dw.auto',AU);meEdit=null;meD=null;toast('Details reset');render();scrollTo({top:0});{const m=document.querySelector('main.wrap');if(m)m.scrollTop=0}}return}
 if(t.id==='meS'&&meD){const d={};['n','r','p','m'].forEach(k=>{const v=String(meD[k]||'').trim();if(v)d[k]=v});if(meD.pic)d.pic=meD.pic;
  if(d.m&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.m)){toast('Check your email address');return}
  ME=d;SV('dw.me',ME);meEdit=false;meD=null;toast('Details saved');render();scrollTo({top:0});{const m=document.querySelector('main.wrap');if(m)m.scrollTop=0}}});
IC.fd='<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const BRAND=window.DG_UI||'danholsen-full.png';
const brand=`<div class="brand bp" id="home"><img class="bpi" src="${BRAND}" width="${Math.round(30*1600/364)}" height="30" decoding="sync" alt="Danholsen Global Services"><span class="bpv"></span><span class="bpw">WORKSPACE</span></div>`;
const nav=v=>{const B=(id,ic,l,x='')=>`<button id="${id}" class="${v===id||(id==='set'&&v==='set')?'on':''}"${v===id?' aria-current="page"':''} aria-label="${l}">${ic}<span>${l}</span>${x}</button>`;return`<nav class="nav" aria-label="Main">${B('home',IC.home,'Home')}${B('files',IC.files,'Files')}${B('set',IC.set,'Library')}${B('cfg',IC.cfg,'Settings',upd&&v!=='cfg'?'<i class="ndot" role="img" aria-label="Update ready"></i>':'')}</nav>`};
function applyTheme(){const h=document.documentElement;h.classList.add('nt');h.dataset.t=eff();const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=TC();requestAnimationFrame(()=>requestAnimationFrame(()=>h.classList.remove('nt')))}
/* ---------- home: quick actions, attention strip, filters, pinned ---------- */
let hf='all';
/* ---------- template categories ----------
   Edit TCAT to regroup templates. A template that is not listed here appears automatically under "More templates". */
const TCAT=[
 {id:'insp',n:'Inspection & procedures',d:'NDT examination reports and technical procedures',p:'<path d="M9 4h6l1 2h3v15H5V6h3z"/><path d="M9 14l2 2 4-4"/>',t:['mpi','ut','plt','pt','cal','ncr','ipr','vpr','trq']},
 {id:'hse',n:'HSE',d:'Toolbox talks, JSAs, permits, incident reports and safety checklists',p:'<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',t:['tbt','jsa','ptw','inc','pjs']},
 {id:'tank',n:'Tank calibration',d:'Tank calibration certificates, strapping sheets and tape / DET verification',p:'<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',t:['tcc','tsf','ctv']},
 {id:'job',n:'Job & site forms',d:'Client sign-off, transmittals, timesheets, site reports and minutes',p:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M3 13h18"/>',t:['jcf','trn','tsh','dsr','edn','mob','mtg']},
 {id:'biz',n:'Business & admin',d:'Invoices, quotations, expense claims and letters',p:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',t:['inv','ltr','quo','exp']}];
var tcat=null;
const tcList=()=>{const used=new Set(TCAT.flatMap(c=>c.t)),rest=Object.keys(TPL).filter(k=>!used.has(k)),L=TCAT.map(c=>Object.assign({},c,{t:c.t.filter(k=>TPL[k])})).filter(c=>c.t.length);
 if(rest.length)L.push({id:'more',n:'More templates',d:'Other Danholsen templates',p:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',t:rest});return L};

const isRep=d=>/report/i.test((TPL[d.t]||{}).n||''),
 isTd=d=>new Date(d.u).toDateString()===new Date().toDateString(),
 edited=d=>{try{const b=d.b||(()=>{const f=newDoc(d.t);return f.b})();return JSON.stringify([d.title,d.d])!==b||!!(d.sg&&Object.keys(d.sg).length)||!!(d.cf&&d.cf.length)}catch(_){return true}},
 unsig=d=>{try{if(!edited(d))return false;const T=resolveTpl(d),ks=Object.keys(T.F).filter(k=>/^sign(ature)?\s*$/i.test(T.F[k].l)&&!(d.hide||[]).includes(k));return ks.length>0&&!ks.some(k=>(d.sg&&d.sg[k])||String((d.d||{})[k]||'').trim())}catch(_){return false}},
 FL={all:()=>true,rep:isRep,form:d=>!isRep(d),td:isTd,us:unsig},
 STAR='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>',
 qi=p=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`,
 qa=sk=>`<div class="qa${sk?' two':''}">${[['files','<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>','Files','Folders'],['bk','<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>','Back up','Save copy'],['pdf','<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 14l1.5-1.5 3 3L17 12"/>','Edit PDF','Mark up']].filter(x=>!(sk&&x[0]==='bk')).map(([k,ic,l,sm])=>`<button class="qb" data-qa="${k}"><span class="qic">${qi(ic)}</span><span class="qt"><b>${l}</b><small>${sm}</small></span></button>`).join('')}</div>`,
 hero=(NU,NT,N,PNn)=>`<section class="hero2"><div class="h2k"><span>${new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'short'})}</span></div><h1 class="h1">${greet()}</h1><p class="h2p">${NU?NU+(NU>1?' documents need':' document needs')+' a signature.':N?'Pick up where you left off, or start something new.':'Start your first report or form.'}</p><div class="h2s"><div><b>${N}</b><span>Documents</span></div><div><b>${NT}</b><span>Today</span></div>${NU?`<button type="button" class="us" data-qa="us"><b>${NU}</b><span>Unsigned</span></button>`:`<div><b>${PNn}</b><span>Pinned</span></div>`}</div><div class="h2c"><button class="h2b p" data-qa="rep" type="button">${qi('<path d="M12 5v14M5 12h14"/>')}<span>New report</span></button><button class="h2b" data-qa="form" type="button">${qi('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>')}<span>New form</span></button></div></section>`,
 att=n=>n?`<button class="bkbn att" data-qa="us"><span><b>${n} document${n>1?'s':''} not signed yet</b><small>Review and add signatures before sending.</small></span><i>Review</i></button>`:'',
 chips=(nt,nu)=>`<div class="chips" role="group" aria-label="Filter documents">${[['all','All'],['rep','Reports'],['form','Forms'],...(nt?[['td','Today',nt]]:[]),...(nu?[['us','Unsigned',nu]]:[])].map(([k,l,n])=>`<button class="chip${hf===k?' on':''}" data-hf="${k}" aria-pressed="${hf===k}">${l}${n?`<small>${n}</small>`:''}</button>`).join('')}</div>`,
 kindOf=k=>/timesheet/i.test((TPL[k]||{}).n||'')?'Timesheet':/report/i.test((TPL[k]||{}).n||'')?'Report':'Form',
 PLUS='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 shd=(id,t,s,r)=>`<div class="shd"><div><h2 class="sec"${id?` id="${id}"`:''}>${t}</h2>${s?`<p class="shs">${s}</p>`:''}</div>${r?`<span class="shr">${r}</span>`:''}</div>`,
 tcard=k=>{const t=TPL[k],rp=/report/i.test(t.n);return`<button class="drow tpc" type="button" data-n="${k}" data-kind="${rp?'rep':'form'}" aria-label="Create new ${e(t.n)}"><span class="mini tmn dth">${sheet(newDoc(k))}</span><span class="dtx"><b>${t.n}</b><span class="dmeta"><i class="kd">${kindOf(k)}</i><span>Tap to start</span></span></span><i class="dadd" aria-hidden="true">${PLUS}</i></button>`},
 card=(d,i)=>{const T=TPL[d.t]||{n:''},us=unsig(d);return`<div class="drow rcard" role="button" tabindex="0" data-o="${d.id}" data-s="${e((d.title+' '+T.n).toLowerCase())}" data-k="${isRep(d)?'rep':'form'}" data-td="${+isTd(d)}" data-us="${+us}" aria-label="Open ${e(d.title)}"><span class="selbox" aria-hidden="true"></span><span class="mini tmn dth">${i<12?sheet(d):''}</span><span class="dtx"><b>${e(d.title)}</b><span class="dmeta"><i class="kd">${kindOf(d.t)}</i>${us?'<i class="kd warn">Unsigned</i>':''}${svBadge(d)}<span>Edited ${ago(d.u)}</span></span>${d.title!==T.n?`<small class="dsub">${e(T.n)}</small>`:''}</span><span class="dact">${d.sv?`<button class="ib ddl" type="button" data-dlpdf="${d.id}" aria-label="Download saved PDF">${CI.down}</button>`:''}<button class="ib dpin${d.pin?' on':''}" type="button" data-pin="${d.id}" aria-label="${d.pin?'Unpin':'Pin'} document" aria-pressed="${!!d.pin}">${STAR}</button><button class="ib ddel" type="button" data-x="${d.id}" aria-label="Delete document">${IC.x}</button></span></div>`},
 tile=(d,i)=>{const T=TPL[d.t]||{n:''},us=unsig(d);return`<div class="rtile rcard" role="button" tabindex="0" data-o="${d.id}" data-s="${e((d.title+' '+T.n).toLowerCase())}" data-k="${isRep(d)?'rep':'form'}" data-td="${+isTd(d)}" data-us="${+us}" aria-label="Open ${e(d.title)}"><span class="selbox" aria-hidden="true"></span><span class="mini rth">${i<12?sheet(d):''}</span><span class="rtx"><b>${e(d.title)}</b><span class="dmeta"><i class="kd">${kindOf(d.t)}</i>${us?'<i class="kd warn">Unsigned</i>':''}${svBadge(d)}</span><small class="rwhen">Edited ${ago(d.u)}</small></span><span class="ract">${d.sv?`<button class="ib ddl" type="button" data-dlpdf="${d.id}" aria-label="Download saved PDF">${CI.down}</button>`:''}<button class="ib dpin${d.pin?' on':''}" type="button" data-pin="${d.id}" aria-label="${d.pin?'Unpin':'Pin'} document" aria-pressed="${!!d.pin}">${STAR}</button><button class="ib ddel" type="button" data-x="${d.id}" aria-label="Delete document">${IC.x}</button></span></div>`},
 /* the grid of recent documents: 2 tiles on phones, 4 on larger screens, then a See all button */
 recentGrid=L=>`${L.length>2?`<div class="rclose" id="rclose" hidden><span>Showing all ${L.length}</span><button type="button" id="dclose" aria-label="Close the full list"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</button></div>`:''}<div class="rgrid" id="rail">${L.length?L.map((d,i)=>tile(d,i)).join(''):'<p class="empty">Nothing yet. Tap New report or New form above to start.</p>'}</div>${L.length>2?`<button class="dmore${L.length>4?'':' ph'}" id="dmore" type="button" data-cnt="${L.length}">See all ${L.length}</button>`:''}`;
function applyF(){const q=(($('#q')||{}).value||'').toLowerCase().trim(),f=FL[hf]||FL.all;let n=0;
 const rows=[...document.querySelectorAll('#rail .rcard')],rl=$('#rail');
 rows.forEach(r=>{const d=docs.find(x=>x.id===r.dataset.o),ok=!!d&&f(d)&&(!q||r.dataset.s.includes(q));r.style.display=ok?'':'none';if(ok)n++});
 if(rl){if(q||hf!=='all'){rl.dataset.all='1';rl.dataset.force='1'}else{delete rl.dataset.force;if(!rl.dataset.keep)delete rl.dataset.all}}
 const fe=$('#fe');if(fe)fe.style.display=n||!docs.length?'none':''}
let SC0=null;
/* ---------- screen history: Back (button, swipe or phone back key) returns to the screen the person came from, and so on ---------- */
let NAVH=[],pS=null,popping=false,ignorePop=0,rootNext=false;
const navKey=()=>view+'|'+(view==='files'?(fld||''):'')+'|'+(view==='tcat'?(tcat||''):'')+'|'+((view==='ed'||view==='pv')&&cur?cur.id:''),
 navSnap=()=>({view,fld,tcat,cur:cur&&cur.id,ret});
function navReset(){rootNext=true;const n=NAVH.length;NAVH=[];if(n){ignorePop++;try{history.go(-n)}catch(_){ignorePop--}}}
function navTrack(){const k=navKey();
 if(view==='home'&&!popping)navReset();
 else if(rootNext){}
 else if(!popping&&pS&&k!==pS.k){NAVH.push(pS.s);try{history.pushState({dw:1},'')}catch(_){}}
 rootNext=false;pS={k,s:navSnap()}}
function navPop(){let s=null,skip=0;
 while(NAVH.length){const x=NAVH.pop();
  if((x.view==='ed'||x.view==='pv')&&!docs.some(d=>d.id===x.cur)){skip++;continue}
  if(x.view==='pv'&&!pvB){skip++;continue}
  s=x;break}
 if(skip){ignorePop++;try{history.go(-skip)}catch(_){ignorePop--}}
 if(!s)s={view:'home',fld:null,tcat:null,cur:null,ret:'home'};
 view=s.view;fld=s.fld;tcat=s.tcat;ret=s.ret||'home';if(s.cur)cur=docs.find(d=>d.id===s.cur)||cur;
 popping=true;try{render()}finally{popping=false}}
function goBack(){if(NAVH.length)history.back();else{view='home';render()}}
addEventListener('popstate',()=>{if(ignorePop>0){ignorePop--;return}if(NAVH.length)navPop()});
/* ---------- select several documents and delete them together (Files folders and Home > Recent) ---------- */
let SEL=new Set();
const selOn=()=>document.body.classList.contains('selm'),
 selRows=()=>[...document.querySelectorAll('.frow[data-o],.rcard[data-o]')].filter(r=>r.offsetParent!==null),
 selIds=()=>[...new Set(selRows().map(r=>r.dataset.o))];
function selPaint(){document.querySelectorAll('.frow[data-o],.rcard[data-o]').forEach(r=>{const on=SEL.has(r.dataset.o);r.classList.toggle('sel',on);r.setAttribute('aria-pressed',on)});
 let b=$('#selbar');if(!b){b=document.createElement('div');b.id='selbar';b.className='selbar';document.body.appendChild(b)}
 const n=SEL.size,all=selIds(),allOn=all.length>0&&all.every(id=>SEL.has(id));
 b.innerHTML=`<button type="button" class="sb" data-sb="x">Cancel</button><span class="sbn" role="status" aria-live="polite">${n?n+' selected':'Tap documents'}</span><button type="button" class="sb" data-sb="all">${allOn?'None':'All'}</button><button type="button" class="sb d" data-sb="del"${n?'':' disabled'}>Delete${n?' ('+n+')':''}</button>`}
function enterSel(){document.body.classList.add('selm');SEL=new Set();selPaint()}
function exitSel(){document.body.classList.remove('selm');SEL=new Set();const b=$('#selbar');if(b)b.remove();document.querySelectorAll('.frow.sel,.rcard.sel').forEach(r=>{r.classList.remove('sel');r.removeAttribute('aria-pressed')})}
function selDelete(){const ids=[...SEL].filter(id=>docs.some(d=>d.id===id)),n=ids.length;if(!n)return;
 const pdfs=docs.filter(d=>ids.includes(d.id)&&d.sv).length;
 if(!confirm('Delete '+n+' document'+(n>1?'s':'')+'?'+(pdfs?'\n\n'+(pdfs>1?'Their '+pdfs+' saved PDF copies are':'Its saved PDF copy is')+' deleted too.':'')+'\n\nThis cannot be undone.'))return;
 ids.forEach(id=>DWSTORE.pdf.del(id));docs=docs.filter(d=>!ids.includes(d.id));SV('dw.docs',docs);exitSel();render();toast(n+' document'+(n>1?'s':'')+' deleted')}
document.addEventListener('click',ev=>{const t=ev.target;
 const sb=t.closest&&t.closest('[data-sb]');
 if(sb){ev.preventDefault();ev.stopPropagation();const a=sb.dataset.sb;
  if(a==='x')exitSel();else if(a==='all'){const all=selIds();if(all.every(id=>SEL.has(id)))SEL=new Set();else SEL=new Set(all);selPaint()}else if(a==='del')selDelete();return}
 if(t.closest&&t.closest('[data-sel]')){ev.preventDefault();ev.stopPropagation();enterSel();return}
 if(!selOn())return;
 const r=t.closest&&t.closest('.frow[data-o],.rcard[data-o]');
 if(r){ev.preventDefault();ev.stopPropagation();const id=r.dataset.o;SEL.has(id)?SEL.delete(id):SEL.add(id);selPaint();return}
 if(t.closest&&t.closest('.cont,.top .ib,.nav'))return;   /* header and bottom bar still work (leaving the screen ends select mode) */
 },true);
addEventListener('keydown',ev=>{if(ev.key==='Escape'&&selOn())exitSel()});
function render(){exitSel();navTrack();if(view!=='pdfed'&&window.PE)PE.leave();{const m=document.querySelector('main.wrap');SC0=m?m.scrollTop:null}if(view!=='cfg'){meEdit=null;meD=null}document.documentElement.dataset.t=eff();document.querySelectorAll('#lgp,#sgp').forEach(q=>q.remove());{const mt=document.querySelector('meta[name=theme-color]');if(mt)mt.content=TC()}const A=$('#app'),L=[...docs].sort((a,b)=>b.u-a.u),last=L[0];
 if(view==='home'){const NU=docs.filter(unsig).length,NT=docs.filter(isTd).length,PN=L.filter(d=>d.pin);if((hf==='us'&&!NU)||(hf==='td'&&!NT))hf='all';
  const arrow='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
   cont=last?`<section class="cont" role="button" tabindex="0" data-o="${last.id}" aria-label="Open ${e(last.title)}"><div class="mini cpg">${sheet(last)}</div><div class="ci"><small>Continue editing</small><h2>${e(last.title)}</h2><p>${last.title===TPL[last.t].n?'':TPL[last.t].n+' \u00b7 '}Edited ${ago(last.u)}</p></div><button class="btn p cop" type="button" tabindex="-1" data-o="${last.id}"><span>Open</span>${arrow}</button></section>`:'',
   sum=NU?NU+(NU>1?' documents need':' document needs')+' a signature':L.length?L.length+(L.length>1?' documents':' document')+(NT?' \u00b7 '+NT+' edited today':''):'Start your first report or form';
  A.innerHTML=bar(brand)+`<main class="wrap hm">
  <header class="hgr"><div class="hgt"><span class="hgd">${new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</span><h1 class="hgh">${greet()}</h1></div><p class="hgs">${sum}</p></header>
  ${cont}${att(NU)}${bnr()}
  <section class="hsec" aria-labelledby="newdoc">${shd('newdoc','New document','Start from a Danholsen template',Object.keys(TPL).length+' templates')}
   <div class="hnew"><button class="hn p" data-qa="rep" type="button">${qi('<path d="M12 5v14M5 12h14"/>')}<span><b>New report</b><small>Inspection and NDT</small></span></button><button class="hn" data-qa="form" type="button">${qi('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>')}<span><b>New form</b><small>Job and site forms</small></span></button></div>
   <button class="ntb" id="ntpl" type="button" aria-label="Browse templates by category"><span class="nti">${qi('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>')}</span><span class="ntt"><b>Browse all templates</b><small>${tcList().length} categories \u00b7 ${Object.keys(TPL).length} templates</small></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
  </section>
  ${qa(!!bnr())}
  ${PN.length?`<section class="hsec">${shd('','Pinned','Kept at the top for quick access',PN.length+' pinned')}<div class="dlist" id="prail">${PN.map((d,i)=>card(d,i)).join('')}</div></section>`:''}
  <section class="hsec" aria-labelledby="recent">${shd('recent','Recent','Your latest reports and forms',L.length?L.length+(L.length==1?' document':' documents'):'')}
   <div class="srow"><input id="q" class="search" type="search" placeholder="Search reports and forms" aria-label="Search documents">${L.length?'<button class="selb" type="button" data-sel="1">Select</button>':''}</div>${L.length?chips(NT,NU):''}
   ${recentGrid(L)}<p class="empty" id="fe" style="display:none">No documents match this filter.</p>
  </section></main>`+nav('home');applyF()}
 if(view==='tcat'&&!tcList().some(x=>x.id===tcat))view='newdoc';
 if(view==='newdoc'){const C=tcList(),n=Object.keys(TPL).length;A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">New document</h1>`)+`<main class="wrap"><p class="sub">Choose a category \u00b7 ${n} templates</p><div class="cats">${C.map(c=>`<button class="cat" type="button" data-tc="${c.id}" aria-label="${e(c.n)}, ${c.t.length} ${c.t.length==1?'template':'templates'}"><span class="ch"><span class="cic">${qi(c.p)}</span><span class="cn">${c.t.length} ${c.t.length==1?'template':'templates'}</span></span><b>${e(c.n)}</b><p>${e(c.d)}</p><span class="cl">${c.t.map(k=>`<i>${e(TPL[k].n)}</i>`).join('')}</span></button>`).join('')}</div></main>`+nav('home')}
 if(view==='tcat'){const c=tcList().find(x=>x.id===tcat);A.innerHTML=bar(`<button class="ib" id="tcb" aria-label="Back to categories">${IC.back}</button><h1 class="h1 s">${e(c.n)}</h1>`)+`<main class="wrap"><p class="sub">${e(c.d)} \u00b7 ${c.t.length} ${c.t.length==1?'template':'templates'}</p>${c.t.includes('mpi')?impEntry():''}<div id="ngrid" class="flat"><div class="dlist">${c.t.map(tcard).join('')}</div></div></main>`+nav('home')}
 if(view==='pdfed'){A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">Edit PDF</h1>`)+`<main class="wrap pe" id="pe"></main>`;PE.mount()}
 if(view==='set'){A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">Library &amp; messages</h1>`)+`<main class="wrap"><div class="pane"><p class="lead">Every new document starts with the Danholsen logo on the left. Each document then carries its own logos - open a document and tap its header (or the Logos button) to add, remove, reorder or resize them. Save client and certification logos here so they are one tap away.</p><h3>Saved logos</h3>${lib.length?`<div class="fact"><button class="lgbtn dn" type="button" data-libclr="1">${lib.length==1?'Clear saved logo':'Clear all '+lib.length+' saved logos'}</button></div>`:''}<div class="libg"><div class="libc"><img src="${DG}" alt="Danholsen"><small>Default</small></div>${lib.map(l=>`<div class="libc"><img src="${l.src}" alt=""><button class="libx" data-libdel="${l.id}" aria-label="Remove logo">\u00d7</button></div>`).join('')}<label class="libc up"><span>+</span><small>Add logo</small><input type="file" accept="image/*" hidden data-libf="1"></label></div><h3>Saved signatures</h3><p class="lead">Import a signature once and keep as many as you need. Your <b>default</b> signature can be added to any Signature field with one tap (<b>Use default</b>), or placed automatically on new documents. The paper background is removed for you.</p><div class="sgl">${sigs.map((x,n)=>`<div class="sgcard${x.id===sigDef?' isdef':''}"><div class="sgpv"><img src="${x.src}" alt=""></div><div class="sgmeta"><b>${e(sgName(x,n))}</b>${x.id===sigDef?'<span class="dfb2">Default</span>':''}</div><div class="sgact"><button class="lgbtn" data-sgdef="${x.id}">${x.id===sigDef?'Remove default':'Set as default'}</button><button class="lgbtn" data-sgren="${x.id}">Rename</button><button class="lgbtn dn" data-sigdel="${x.id}">Delete</button></div></div>`).join('')}<label class="sgcard up"><span>+</span><b>Import signature</b><small>Photo or scan</small><input type="file" accept="image/*" hidden data-sglib="1"></label></div><label class="sgauto"><input type="checkbox" data-sgauto="1"${sigAuto?' checked':''}><span><b>Sign new documents automatically</b><small>Adds your default signature to the Danholsen signature field of each new report, timesheet and transmittal. The Job Completion Form is left for the client to sign.</small></span></label>${msgSet()}</div></main>`+nav('set')}
 if(view==='cfg'){const lb=LS('dw.lastbk',null),lrl=LS('dw.lastrelay',0),rl=LS('dw.relaylast',null),fresh=lb&&Date.now()-lb<24*36e5,stale=lb&&Date.now()-lb>7*DAY,fd=t=>new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}),ft=t=>new Date(t).toLocaleString(undefined,{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}),
 used=lsBytes(),pct=Math.min(100,Math.round(used/(STQ||LSCAP)*100)),sc=pct>=90?'bad':pct>=70?'mid':'',
 sw=(k,on,b,sm)=>`<label class="tgl"><span><b>${b}</b><small>${sm}</small></span><input type="checkbox" switch role="switch" data-au="${k}" ${on?'checked':''}></label>`;
 A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><h1 class="h1 s">Settings</h1>`)+`<main class="wrap"><div class="stk cfgp">
<div class="ctabs" role="tablist" aria-label="Settings sections">${[['general','General'],['backup','Backup & data'],['about','About']].map(([k,l])=>`<button role="tab" type="button" data-ct="${k}" class="${cfgTab===k?'on':''}" aria-selected="${cfgTab===k}">${l}${k==='about'&&upd?'<i class="ndot" role="img" aria-label="Update ready"></i>':k==='backup'&&(!lb||stale)?'<i class="ndot warn" role="img" aria-label="Backup needed"></i>':''}</button>`).join('')}</div>
${cfgTab==='backup'?`
<section class="pane"><div class="ch"><span class="ci2">${CI.box}</span><div><h3>Back up now</h3><small>Your documents live on this device</small></div></div>
<div class="stat"><div><b>${docs.length}</b><span>Document${docs.length==1?'':'s'}</span></div><div><b>${lib.length}</b><span>Logo${lib.length==1?'':'s'}</span></div><div><b>${sigs.length}</b><span>Signature${sigs.length==1?'':'s'}</span></div></div>
<p class="bkst ${fresh?'ok':stale?'bad':'old'}"><i></i>${lb?(fresh?'Backed up ':'Last backup ')+fd(lb):'No backup yet'}</p>
<div class="btnrow"><button class="btn p" id="bkx" type="button">${CI.up}<span>Export</span></button><label class="btn">${CI.down}<span>Import</span><input type="file" accept=".json,application/json" hidden data-bk="1"></label></div>
<p class="hint">Import shows what will change first and keeps everything you already have.</p>
<h4 class="subh">Storage</h4><div class="sbar" role="img" aria-label="${pct} percent of storage used"><i id="stbar" class="${sc}" style="width:${Math.max(pct,2)}%"></i></div>\n<p class="hint" id="sttx">${SZ(used)} used${STQ?' - about '+SZ(STQ)+' available on this device':''}${pct>=70?'. Getting full: export a backup, then remove unused logos or documents.':'.'}</p>
<p class="hint ${PERSIST===false?'warn':''}" id="persl">${PERSIST===true?'Protected: the browser will not clear this data to free up space.':PERSIST===false?'Not protected: the browser may clear this data if the phone runs low on space. Keep a recent backup.':'Checking storage protection\u2026'}</p>
<h4 class="subh">Restore points</h4>
${SNAPS.length?SNAPS.map((x,n)=>`<div class="snap"><span><b>${ft(x.at)}</b><small>${e(x.why)} \u00b7 ${x.n} document${x.n==1?'':'s'}</small></span><button class="btn" type="button" data-snap="${n}">Restore</button></div>`).join(''):'<p class="hint">None yet. One is saved each day you open the app, and before every import. The last 3 are kept.</p>'}</section>
<section class="pane"><div class="ch"><span class="ci2">${CI.mail}</span><div><h3>Automatic backup</h3><small>Runs when you open the app, once a day</small></div></div>
${sw('on',AU.on,'Email me a backup daily',AU.on?(lrl?'Last sent '+ft(lrl):'Not sent yet'):'Off')}
<p class="hint">${ME.m?'Sent to <b>'+e(ME.m)+'</b>':'Add your email under Your details above first.'}</p>
${rl&&rl.r!=='ok'?`<p class="hint warn">Last attempt failed (${ft(rl.t)}): ${e(rl.r)}</p>`:''}
<button class="btn wide" id="aut" type="button">Send test backup</button>
${sw('remind',AU.remind,'Remind me when overdue','Shows a banner on Home after a day without a backup')}
${window.showDirectoryPicker?`<div class="bkc"><div><b>Save to a folder</b><small>${LS('dw.afname','')?'Folder: '+e(LS('dw.afname',''))+'. A copy is saved there daily.':'Pick a Google Drive or OneDrive folder and a copy is saved there daily.'}</small></div><button class="btn" id="afd">${LS('dw.afname','')?'Change':'Choose'}</button></div>`:''}</section>
<section class="pane danger"><div class="ch"><span class="ci2 r">${CI.trash}</span><div><h3>Reset app</h3><small>Start again from a clean slate</small></div></div>
<p class="hint" style="margin-top:0">Removes every document, logo, signature and setting from this device. Export a backup first.</p>
<button class="btn wide dng" id="rst" type="button">Erase all data\u2026</button></section>
`:cfgTab==='about'?`
<section class="pane about"><div class="ch"><span class="ci2">${CI.info}</span><div><h3>About</h3><small>Danholsen Workspace</small></div></div>
<div class="verc"><img src="icon-96-v6.png" alt="" width="52" height="52"><div class="vm"><div class="vn"><small>Version</small><b id="verl">${VER||'\u2013'}</b></div><code id="bldl">${FP0?'build '+FP0:'build \u2013'}</code></div><span class="vst ${upd?'rdy':navigator.onLine?'ok':'off'}" id="updst"><i></i><em>${upd?'Update ready':navigator.onLine?'Up to date':'Offline'}</em></span></div>
<button class="btn wide" id="upd" type="button">${CI.refresh}<span>Check for updates</span></button>
<p class="hint" id="updnote">The app updates itself when you are online.</p>
<details class="chg"><summary>What\u2019s new in version ${VER||'\u2013'}</summary><ul>${CHANGES[0].map(c=>`<li>${c}</li>`).join('')}</ul></details></section>
`:`
${meSec()}
${window.DWAUTH?DWAUTH.acctHtml():''}
<section class="pane"><div class="ch"><span class="ci2">${CI.sun}</span><div><h3>Appearance</h3><small>Choose how the app looks</small></div></div><div class="seg" role="group" aria-label="Theme">${[['light','Light',CI.sun],['dark','Dark',CI.moon],['auto','Auto',CI.phone]].map(([k,l,ic])=>`<button data-th="${k}" class="${theme===k?'on':''}" aria-pressed="${theme===k}">${ic}<span>${l}</span></button>`).join('')}</div></section>
<section class="pane"><div class="ch"><span class="ci2">${CI.logo}</span><div><h3>Defaults</h3><small>What new documents start with</small></div></div>
<label class="tgl"><span><b>Sign new documents automatically</b><small>Adds your default signature to new reports and timesheets</small></span><input type="checkbox" switch role="switch" data-sgauto="1" ${sigAuto?'checked':''}></label>
<button class="navrow" type="button" data-go="set"><span><b>Logos and signatures</b><small>${lib.length+1} logo${lib.length?'s':''} \u00b7 ${sigs.length} signature${sigs.length==1?'':'s'}</small></span>${CI.chev}</button>
<button class="navrow" type="button" data-go="msg"><span><b>Message wording</b><small>The text in the Send box when you share a PDF</small></span>${CI.chev}</button></section>
`}</div></main>`+nav('cfg');stRefresh()}
 if(view==='files'){const kf=d=>((d.pf||(d.d&&d.d.proj))||'').trim()||'Unfiled',names=[...new Set([...projs,...docs.map(kf)])],cnt=n=>docs.filter(d=>kf(d)===n).length,ls=fld?docs.filter(d=>kf(d)===fld).sort((a,b)=>b.u-a.u):[];
 A.innerHTML=bar(fld?`<button class="ib" id="fall" aria-label="All projects">${IC.back}</button><h1 class="h1 s">${e(fld)}</h1>`:brand)+`<main class="wrap">`+(fld?`<p class="sub">${ls.length} document${ls.length==1?'':'s'} \u00b7 tap one to open it</p><div class="fact">${ls.length?'<button class="lgbtn" data-sel="1">Select documents</button>':''}${fld!=='Unfiled'?'<button class="lgbtn" data-rn="1">Rename folder</button><button class="lgbtn dn" data-dl="1">Delete folder</button>':''}</div>${ls.length?ls.map(d=>`<div class="row frow" role="button" tabindex="0" data-o="${d.id}"><span class="selbox" aria-hidden="true"></span><span class="fic">${IC.files}</span><div class="fmeta"><b>${e(d.title)}</b><small>${TPL[d.t].n} \u00b7 Edited ${ago(d.u)}</small>${svBadge(d)}</div>${d.sv?`<button class="ib ddl" type="button" data-dlpdf="${d.id}" aria-label="Download saved PDF">${CI.down}</button>`:''}<button class="lgbtn" data-mv="${d.id}">Move</button><button class="ib d" data-x="${d.id}" aria-label="Delete">${IC.x}</button></div>`).join(''):'<p class="empty">No documents in this project yet.</p>'}`:`<h1 class="h1">Files</h1>${docs.length?`<section class="fsec"><div class="shd"><div><h2 class="sec">Recent</h2><p class="shs">Your latest reports and forms</p></div><button class="selb" type="button" data-sel="1">Select</button></div>${recentGrid([...docs].sort((a,b)=>b.u-a.u))}</section>`:''}<div class="shd fsh"><div><h2 class="sec">Projects</h2><p class="shs">Your projects and their reports</p></div></div><div class="grid fgrid">${names.map(n=>`<button class="tile ftile" data-fo="${e(n)}"><span class="fi">${IC.fd}</span><b>${e(n)}</b><span>${cnt(n)} document${cnt(n)==1?'':'s'}</span></button>`).join('')}<button class="tile ftile fnew" id="nf"><span class="fi plus">+</span><b>New project</b><span>Create a folder</span></button></div>`)+`</main>`+nav('files')}
 if(view==='pv')A.innerHTML=bar(`<button class="ib" id="pvb" aria-label="Back to editing">${IC.back}</button><h1 class="h1 s">Preview</h1>`)+`<main class="wrap pvw"><p class="sub">${e(pvB?pvB.name:'')} \u00b7 exactly as it will print</p><div class="pvs" id="pvs"></div></main><div class="pvbar pv3">${pvB&&pvB.imp?'':`<button class="pva ed" id="pvb2" type="button">${PVI.ed}<span>Edit</span></button>`}<button class="pva" id="pvfiles" type="button">${PVI.app}<span>Save to Files in app</span></button><button class="pva" id="pvsend" type="button">${PVI.send}<span>Send by WhatsApp or email</span></button><button class="pva" id="pvsave" type="button">${PVI.dl}<span>Download to device</span></button></div>`;
 if(view==='ed')A.innerHTML=bar(`<button class="ib" id="home" aria-label="Back">${IC.back}</button><input id="ttl" value="${e(cur.title)}" aria-label="Document title">`,`<button class="btn" id="dsave">Save</button><button class="btn p" id="pdf">Export PDF</button>`)+`<main class="wrap ew"><div class="ctx"><div class="cx1"><span class="sv ok" id="sv">Saved</span><span class="tp">Tap any text to edit</span></div><div class="cx2"><button class="lgbtn" id="undo" data-undo="1" disabled>Undo</button>${cur.imp?`<button class="lgbtn" data-imtg="1" aria-pressed="${!!impEd}">Highlights</button>`:''}<button class="lgbtn" data-lg="open">Logos \u00b7 ${lgItems(cur).length}</button><span class="zm"><button data-z="-1" aria-label="Zoom out">\u2212</button><button data-z="1" aria-label="Zoom in">+</button></span></div></div><div class="stage${cur.imp&&impEd?' imhl':''}" id="stage"></div></main><div class="etb" id="etb"></div>`;
 if(view==='imp')A.innerHTML=impHtml();if(view==='ed')mountEditor();if(view==='pv')drawPv();if(view==='imp')impFit();if(view!==lv){lv=view;window.scrollTo(0,0);const m=document.querySelector('main.wrap');if(m)m.scrollTop=0}else if(SC0!=null){const m=document.querySelector('main.wrap');if(m)m.scrollTop=SC0}SC0=null;if(view==='home'||view==='newdoc'||view==='tcat'||view==='files')fitThumbs();zoomGate()}
document.addEventListener('input',ev=>{if(ev.target.id==='q')applyF()});
document.addEventListener('click',ev=>{const m=ev.target.closest('#dmore,#dclose');if(!m)return;const r=$('#rail');if(!r)return;
 const mb=$('#dmore'),cl=$('#rclose'),open=m.id==='dmore'&&!r.dataset.keep;
 if(open){r.dataset.all='1';r.dataset.keep='1'}else{delete r.dataset.keep;if(!r.dataset.force)delete r.dataset.all}
 if(mb){mb.textContent=open?'Show fewer':'See all '+(mb.dataset.cnt||'');mb.classList.toggle('open',open)}
 if(cl)cl.hidden=!open;
 if(!open&&m.id==='dclose'){const sc=r.closest('section');if(sc)sc.scrollIntoView({block:'start',behavior:'smooth'})}
 fitThumbs()});
document.addEventListener('click',ev=>{if(view!=='home'&&view!=='files')return;const c=ev.target.closest('[data-hf],[data-qa],[data-pin]');if(!c)return;
 if(c.dataset.pin){ev.stopPropagation();const d=docs.find(x=>x.id===c.dataset.pin);if(d){d.pin=!d.pin;SV('dw.docs',docs);render();toast(d.pin?'Pinned':'Unpinned')}return}
 if(c.dataset.hf){hf=c.dataset.hf;document.querySelectorAll('.chip').forEach(x=>{const on=x.dataset.hf===hf;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});applyF();return}
 const k=c.dataset.qa;
 if(k==='files'){fld=null;view='files';render()}
 else if(k==='bk')exportBk();
 else if(k==='pdf'){view='pdfed';render()}
 else if(k==='us'){hf='us';document.querySelectorAll('.chip').forEach(x=>{const on=x.dataset.hf===hf;x.classList.toggle('on',on);x.setAttribute('aria-pressed',on)});applyF();const r=$('#recent');if(r)r.scrollIntoView({behavior:'smooth',block:'start'})}
 else if(k==='rep'||k==='form'){tcat=k==='rep'?'insp':'job';view='tcat';render()}});
document.addEventListener('click',ev=>{const t=ev.target.closest('button,.row,.brand,.rcard,.cont');if(!t)return;const go=v=>{view=v;render()};window.dwGo=go;
 if(t.id==='ntpl'){go('newdoc')}else if(t.dataset.tc){tcat=t.dataset.tc;go('tcat')}else if(t.id==='tcb'){goBack()}else if(t.id==='files'||t.id==='fall'){if(t.closest('.nav')){navReset();fld=null;go('files')}else if(fld&&NAVH.length)goBack();else{fld=null;go('files')}}else if(t.dataset.fo){fld=t.dataset.fo;go('files')}
 else if(t.id==='nf'){const n=(prompt('Project name')||'').trim();if(n){if(!projs.includes(n)){projs.push(n);SV('dw.proj',projs)}fld=n;go('files')}}
 else if(t.dataset.rn){const n=(prompt('Rename folder',fld)||'').trim();if(n&&n!==fld){docs.forEach(d=>{if(fkey(d)===fld)d.pf=n});const i=projs.indexOf(fld);if(i>=0)projs.splice(i,1);if(!projs.includes(n))projs.push(n);SV('dw.docs',docs);SV('dw.proj',projs);fld=n;go('files')}}
 else if(t.dataset.dl){const mine=docs.filter(d=>fkey(d)===fld),n=mine.length;if(confirm('Delete the folder \u201c'+fld+'\u201d?'+(n?'\n\nIts '+n+' document'+(n>1?'s are':' is')+' not deleted. '+(n>1?'They move':'It moves')+' to Unfiled.':''))){const was=mine.map(d=>[d,d.pf]),op=projs.slice(),name=fld;mine.forEach(d=>d.pf='Unfiled');projs=projs.filter(x=>x!==name);SV('dw.docs',docs);SV('dw.proj',projs);fld=null;go('files');toast('Folder deleted',()=>{was.forEach(([d,p])=>{if(p===undefined)delete d.pf;else d.pf=p});projs=op;SV('dw.docs',docs);SV('dw.proj',projs);fld=name;go('files')})}}
 else if(t.dataset.mv){const d=docs.find(x=>x.id===t.dataset.mv);if(d){const n=prompt('Move "'+(d.title||'document')+'" to which project folder?',fld||'');if(n!==null){const m=n.trim();if(m){d.pf=m;if(!projs.includes(m)){projs.push(m);SV('dw.proj',projs)}}else delete d.pf;SV('dw.docs',docs);render()}}}
 else if(t.id==='pvb'||t.id==='pvb2'){if(pvB&&pvB.imp){if(NAVH.length&&NAVH[NAVH.length-1].view==='imp')goBack();else{view='imp';render()}}else if(NAVH.length&&NAVH[NAVH.length-1].view==='ed')goBack();else{view='ed';render()}}
 else if(t.id==='pvfiles')pvSaveApp(t)
 else if(t.id==='pvsave'){DWPDF.save(pvB.blob,pvB.name,true).then(r=>{if(r==='downloaded')toast('PDF downloaded')})}
 else if(t.id==='pvsend')openSend();else if(t.dataset.snd)doSend(t.dataset.snd);else if(t.dataset.snx)closeSend();
 else if(t.id==='home'){setBack=false;if(t.closest('.nav')){navReset();go('home')}else goBack()}else if(t.id==='set'){setBack=false;if(t.closest('.nav')){navReset();go('set')}else go('set')}
 else if(t.dataset.th){theme=t.dataset.th;SV('dw.theme',theme);applyTheme();render()}else if(t.id==='upd')checkNow(t)
 else if(t.dataset.n){ret='home';cur=newDoc(t.dataset.n);autoSign(cur);docs.push(cur);SV('dw.docs',docs);go('ed')}
 else if(t.dataset.x){ev.stopPropagation();if(confirm('Delete this document?'+(docs.some(d=>d.id===t.dataset.x&&d.sv)?'\n\nIts saved PDF copy is deleted too.':''))){DWSTORE.pdf.del(t.dataset.x);docs=docs.filter(d=>d.id!==t.dataset.x);SV('dw.docs',docs);render()}}
 else if(t.dataset.o){cur=docs.find(d=>d.id===t.dataset.o);ret=view;go('ed')}
 else if(t.dataset.p){pane=t.dataset.p;$('.ed').dataset.v=pane}
 else if(t.id==='cfg'){if(t.closest('.nav'))navReset();go('cfg')}else if(t.id==='bkx')exportBk();
 else if(t.id==='dsave')saveDoc(t);else if(t.dataset.dlpdf){ev.stopPropagation();dlSaved(t.dataset.dlpdf)}
 else if(t.id==='pdf')openPreview(t)});
const PVI={ed:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',app:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 13l2 2 4-4"/></svg>',send:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4L3 11l7 3 3 7z"/><path d="M10 14l11-10"/></svg>',dl:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>'};
const svBadge=d=>{const s=svState(d);return s==='ok'?'<i class="kd ok">Saved</i>':s==='old'?'<i class="kd old">Edited since save</i>':''};
const makePdf=d=>{const LI=lgItems(d);return Promise.race([DWPDF.build(d,{TPL,ST,resolve:resolveTpl,logos:LI.map(l=>l.src),lsz:LI.map(l=>l.s),sigs:Object.fromEntries(Object.entries(d.sg||{}).map(([k,g])=>[k,{src:(sigs.find(x=>x.id===g.id)||{}).src,s:g.s||100}]).filter(([k,v])=>v.src))}),new Promise((_,rj)=>setTimeout(()=>rj(new Error('timed out - please try again')),40000))])};
function dwHash(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
const docSig=d=>dwHash(JSON.stringify([d.title,d.d,d.a,d.o,d.cf,d.hide,d.lg,d.sg,d.fm]));
const svState=d=>!d.sv?'':d.sv.h===docSig(d)?'ok':'old';
async function openPreview(btn){const lab=btn.textContent;btn.disabled=true;btn.textContent='Preparing…';
 try{const blob=await makePdf(cur);pvB={blob,name:cur.title||TPL[cur.t].n,doc:cur};view='pv';render()}
 catch(err){console.error(err);toast('Could not make the PDF: '+(err&&err.message||err))}
 finally{btn.disabled=false;btn.textContent=lab}}
/* Save: keep a PDF copy inside the app with the document (shown in Files) and mark the entry Saved. No download - Export PDF / Preview handle that. */
async function saveDoc(btn){const lab=btn.textContent;btn.disabled=true;btn.textContent='Saving…';
 try{SV('dw.docs',docs);const blob=await makePdf(cur),buf=await blob.arrayBuffer();await DWSTORE.pdf.put(cur.id,buf);
  cur.sv={at:Date.now(),h:docSig(cur),n:blob.size};SV('dw.docs',docs);mark('ok');
  toast('Saved to Files')}
 catch(err){console.error(err);toast('Could not save: '+(err&&err.message||err))}
 finally{btn.disabled=false;btn.textContent=lab}}
async function dlSaved(id){const d=docs.find(x=>x.id===id);if(!d)return;const buf=await DWSTORE.pdf.get(id);let blob=buf?new Blob([buf],{type:'application/pdf'}):null;
 if(!blob){try{blob=await makePdf(d);await DWSTORE.pdf.put(id,await blob.arrayBuffer())}catch(err){toast('Could not make the PDF: '+(err&&err.message||err));return}}
 const r=await DWPDF.save(blob,d.title||TPL[d.t].n);if(r==='downloaded')toast('PDF downloaded')}
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
const CODE=['index.html','app.css','fonts.css','store.js','config.js','auth.js','app.js','pdfedit.js','pdfinc.js','logo.js','pdf.js','publicsans-pdf.js','manifest.webmanifest'];
var VER='',FP0='',upd=false,swr=null,lastChk=0;
const busy=()=>view==='ed'||view==='pv'||view==='pdfed',
 hashStr=t=>{let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)},
 paintVer=()=>{const a=document.getElementById('verl'),b=document.getElementById('bldl');if(a)a.textContent=VER||'\u2013';if(b)b.textContent='build '+(FP0||'\u2013')},
 verText=()=>'Version '+(VER||'\u2013')+(FP0?' \u00b7 build '+FP0:'');
async function fingerprint(){const parts=await Promise.all(CODE.map(u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw 0;return r.text()})));return hashStr(parts.join('\u0001'))}
async function loadVer(){try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(r.ok){const j=await r.json();VER=String(j.v||'')}}catch{}paintVer()}
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
fingerprint().then(f=>{FP0=f;paintVer()}).catch(()=>{});loadVer();
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
 if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:kind==='wa'?pvB.name:subj,text:msg});closeSend();PE.showDone(fn,()=>go('home'));return}catch(err){if(err&&err.name==='AbortError')return}}
 await DWPDF.save(pvB.blob,pvB.name);closeSend();
 if(kind==='wa')window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg),'_blank');
 else location.href='mailto:'+encodeURIComponent(em)+'?subject='+encodeURIComponent(subj)+'&body='+encodeURIComponent(msg);
 toast('PDF saved. Attach it in '+(kind==='wa'?'WhatsApp':'your email'));PE.showDone(fn,()=>go('home'))}

/* ---- v28: settings helpers, clickable continue card, system theme ---- */
document.addEventListener('keydown',ev=>{const c=ev.target.closest&&ev.target.closest('.cont[role=button]');if(c&&ev.target===c&&(ev.key==='Enter'||ev.key===' ')){ev.preventDefault();c.click()}});
async function checkNow(b){const lab=b.innerHTML,st=document.getElementById('updst'),nt=document.getElementById('updnote'),set=(c,t,n)=>{if(st){st.className='vst '+c;st.querySelector('em').textContent=t}if(nt&&n)nt.textContent=n};
 b.disabled=true;b.querySelector('span').textContent='Checking\u2026';set('chk','Checking\u2026');
 try{const r=await chkUpd(true);
  if(r===null){set('off','Offline','Could not check. Connect to the internet and try again.');toast('Could not check. Are you online?')}
  else if(r){set('rdy','Update found','Installing the new version\u2026');toast('Updating\u2026');setTimeout(()=>doReload(true),400)}
  else{set('ok','Up to date','Checked just now. You have the latest version.')}}
 finally{b.disabled=false;b.innerHTML=lab}}
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(theme==='auto'){applyTheme()}})}catch{}

/* ---- v32: automatic backup (email relay on open, reminder banner, synced folder) ---- */
const relayMsg=r=>r==='ok'?'Backup emailed to '+ME.m:r==='noem'?'Add your email under Your details first':r==='unk'?'Not confirmed. Will try again next time you open the app':String(r).startsWith('err:')?String(r).slice(4):'Could not send. Check your connection and try again';
async function sendRelay(test){const r=await sendRelay0(test);SV('dw.relaylast',{t:Date.now(),r:r==='ok'?'ok':relayMsg(r)});return r}
async function sendRelay0(test){
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
  if(due('dw.lastsnap')){await snapTake('Automatic');if(view==='cfg'&&!meEdit)render()}
  if(AU.on&&ME.m&&navigator.onLine&&due('dw.lastrelay')){const r=await sendRelay(false);if(r==='ok'){SV('dw.lastrelay',Date.now());SV('dw.lastbk',Date.now())}toast(relayMsg(r))}
  if(window.showDirectoryPicker&&due('dw.lastfold')){if(await folderBk(false))toast('Backup saved to your folder')}
 }catch{}finally{abBusy=false}}
document.addEventListener('input',ev=>{const k=ev.target.dataset&&ev.target.dataset.au;if(!k||ev.target.type==='checkbox')return;AU[k]=ev.target.value.trim();SV('dw.auto',AU)});
document.addEventListener('change',ev=>{const k=ev.target.dataset&&ev.target.dataset.au;if(!k||ev.target.type!=='checkbox')return;AU[k]=ev.target.checked;SV('dw.auto',AU);if(k==='on'&&AU.on){if(!ME.m){AU.on=false;SV('dw.auto',AU);toast('Add your email under Your details first')}else autoBk()}if(view==='cfg')render()});
document.addEventListener('click',async ev=>{const t=ev.target.closest('#bkn,#aut,#afd');if(!t)return;
 if(t.id==='bkn'){exportBk();return}
 if(t.id==='aut'){const lab=t.textContent;t.disabled=true;t.textContent='Sending\u2026';const r=await sendRelay(true);t.disabled=false;t.textContent=lab;toast(relayMsg(r));if(view==='cfg')render();return}
 if(t.id==='afd'){try{const h=await showDirectoryPicker({mode:'readwrite'});await idbSet('dir',h);SV('dw.afname',h.name);SV('dw.lastfold',0);render();if(await folderBk(true))toast('Saved a copy to '+h.name)}catch(err){if(err&&err.name!=='AbortError')toast('Could not use that folder')}}});
setTimeout(autoBk,3000);addEventListener('online',autoBk);addEventListener('focus',()=>setTimeout(autoBk,1500));setInterval(autoBk,60*60e3);

/* ---- v58: extras ---- */
document.addEventListener('click',ev=>{
 const g=ev.target.closest('[data-go]');if(g){setBack=true;view='set';render();if(g.dataset.go==='msg')setTimeout(()=>{const m=document.querySelector('.mph');if(m){const h=m.previousElementSibling&&m.previousElementSibling.previousElementSibling;(h||m).scrollIntoView({block:'start'})}},80);return}
 const sn=ev.target.closest('[data-snap]');if(sn){snapRestore(+sn.dataset.snap);return}
 if(ev.target.closest('#rst')){resetAll();return}
 if(ev.target.closest('.seg button'))try{navigator.vibrate&&navigator.vibrate(8)}catch{}});
document.addEventListener('change',ev=>{if(ev.target.closest&&ev.target.closest('.tgl'))try{navigator.vibrate&&navigator.vibrate(8)}catch{}});
const offl=()=>document.documentElement.classList.toggle('offl',!navigator.onLine);offl();addEventListener('online',offl);addEventListener('offline',offl);
snapList().then(l=>{SNAPS=l.map(({at,why,n})=>({at,why,n}));if(view==='cfg'&&!meEdit)render()}).catch(()=>{});
try{if(navigator.storage&&navigator.storage.persist){navigator.storage.persisted().then(p=>p||navigator.storage.persist()).then(p=>{PERSIST=!!p;const el=document.getElementById('persl');if(el){el.textContent=PERSIST?'Protected: the browser will not clear this data to free up space.':'Not protected: the browser may clear this data if the phone runs low on space. Keep a recent backup.';el.classList.toggle('warn',!PERSIST)}}).catch(()=>{})}}catch{}


/* ================= v82: read the spreadsheet file itself (.xlsx), no library, works offline ================= */
async function zipRead(buf){
 const u=new Uint8Array(buf),dv=new DataView(buf),td=new TextDecoder();
 let p=u.length-22;while(p>=0&&dv.getUint32(p,true)!==0x06054b50)p--;
 if(p<0)throw new Error('This is not an .xlsx file');
 const n=dv.getUint16(p+10,true);let o=dv.getUint32(p+16,true);const F={};
 for(let i=0;i<n;i++){
  if(dv.getUint32(o,true)!==0x02014b50)break;
  const meth=dv.getUint16(o+10,true),csz=dv.getUint32(o+20,true),nl=dv.getUint16(o+28,true),el=dv.getUint16(o+30,true),cl=dv.getUint16(o+32,true),lo=dv.getUint32(o+42,true);
  F[td.decode(u.subarray(o+46,o+46+nl))]={meth,csz,lo};o+=46+nl+el+cl}
 return{get:async nm=>{const f=F[nm];if(!f)return null;
  const ln=dv.getUint16(f.lo+26,true),le=dv.getUint16(f.lo+28,true),s=f.lo+30+ln+le,raw=u.subarray(s,s+f.csz);
  if(f.meth===0)return td.decode(raw);
  if(f.meth!==8)throw new Error('This file uses a zip format the app cannot read');
  const ds=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return td.decode(await new Response(ds).arrayBuffer())}}}
const XE=s=>String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/&amp;/g,'&');
function xAttrs(s){const o={};for(const m of s.matchAll(/([\w:.-]+)="([^"]*)"/g))o[m[1]]=m[2];return o}
function xCol(r){let n=0;for(const ch of r.replace(/\d/g,''))n=n*26+ch.charCodeAt(0)-64;return n}
function xDMY(n){const d=new Date(Math.round((n-25569)*864e5)),p=x=>String(x).padStart(2,'0');return p(d.getUTCDate())+'/'+p(d.getUTCMonth()+1)+'/'+d.getUTCFullYear()}
function xDate(id,code){return(id>=14&&id<=22)||(id>=45&&id<=47)||!!(code&&!/^general$/i.test(code)&&/[dmyhs]/i.test(code.replace(/"[^"]*"|\[[^\]]*\]|\\./g,'')))}
async function xlsxRead(buf){
 const z=await zipRead(buf),wbx=await z.get('xl/workbook.xml');
 if(!wbx)throw new Error('This file is not an Excel workbook (.xlsx)');
 const rmap={};for(const m of(await z.get('xl/_rels/workbook.xml.rels')||'').matchAll(/<Relationship\b([^>]*?)\/?>/g)){const a=xAttrs(m[1]);rmap[a.Id]=a.Target}
 const ss=[];for(const m of(await z.get('xl/sharedStrings.xml')||'').matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)){let t='';for(const q of(m[1]||'').replace(/<rPh\b[\s\S]*?<\/rPh>/g,'').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))t+=q[1];ss.push(XE(t))}
 const sty=await z.get('xl/styles.xml')||'',nf={};
 for(const m of sty.matchAll(/<numFmt\b([^>]*?)\/?>/g)){const a=xAttrs(m[1]);nf[a.numFmtId]=XE(a.formatCode||'')}
 const isD=[];for(const m of((/<cellXfs\b[\s\S]*?<\/cellXfs>/.exec(sty)||[''])[0]).matchAll(/<xf\b([^>]*?)\/?>/g)){const id=xAttrs(m[1]).numFmtId;isD.push(xDate(+id,nf[id]))}
 const sheets=[];
 for(const m of wbx.matchAll(/<sheet\b([^>]*?)\/?>/g)){const a=xAttrs(m[1]);if(a.state==='hidden'||a.state==='veryHidden')continue;
  let t=rmap[a['r:id']];if(!t)continue;t=t.replace(/^\//,'');if(!/^xl\//.test(t))t='xl/'+t;
  const sx=await z.get(t);if(!sx)continue;const rows={};
  for(const c of sx.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const b=xAttrs(c[1]),inn=c[2]||'';if(!b.r)continue;
   const rn=+b.r.replace(/\D/g,''),cn=xCol(b.r),vm=/<v>([\s\S]*?)<\/v>/.exec(inn);let v=null;
   if(b.t==='s'&&vm)v=ss[+vm[1]];
   else if(b.t==='inlineStr'){let s='';for(const q of inn.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))s+=q[1];v=XE(s)}
   else if(b.t==='str'&&vm)v=XE(vm[1]);
   else if(b.t==='b'&&vm)v=vm[1]==='1'?'TRUE':'FALSE';
   else if(b.t!=='e'&&vm&&vm[1]!==''){const n=parseFloat(vm[1]);v=isD[+(b.s||0)]&&n>0?xDMY(n):n}
   if(v===null||v==='')continue;(rows[rn]=rows[rn]||{})[cn]=v}
  sheets.push({name:XE(a.name||''),rows})}
 return sheets}

/* ---- find the NDT request table by its headings, not by fixed cell addresses ---- */
const nTxt=v=>v==null?'':(typeof v==='number'?(Number.isInteger(v)?String(v):String(+v.toFixed(4))):String(v)).replace(/\s+/g,' ').trim();
const nTC=s=>s.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
function ndtSheet(sh){
 const R=sh.rows,RN=Object.keys(R).map(Number).sort((a,b)=>a-b);
 const find=(re,max)=>{for(const r of RN){if(max&&r>=max)break;for(const c of Object.keys(R[r]))if(re.test(nTxt(R[r][c])))return{r,c:+c,v:nTxt(R[r][c])}}return null};
 const hd=find(/^JOINT\s*NO/i);if(!hd)return null;
 const K={},A=[];
 Object.keys(R[hd.r]).forEach(c=>{const t=nTxt(R[hd.r][c]).toUpperCase();let k=null;
  if(/WELDER/.test(t))k='w';else if(/JOINT/.test(t))k='jn';else if(/METHOD/.test(t))k='m';else if(/DESC/.test(t))k='d';else if(/HEAT/.test(t))k='h';else if(/GRADE|MATERIAL/.test(t))k='g';else if(/THK|THICK/.test(t))k='t';else if(/COMPLET|WELD\s*DATE/.test(t))k='dt';else if(/VISUAL/.test(t))k='vi';
  if(k&&!K[k]){K[k]=+c;A.push(+c)}});
 if(!K.jn||!K.m)return null;
 A.sort((a,b)=>a-b);const sub=R[hd.r+1]||{};
 const two=k=>{const a=K[k];if(a==null)return[0,0];const nx=A.find(x=>x>a)||a+2;let c1=a,c2=a+1;
  Object.keys(sub).map(Number).filter(c=>c>=a&&c<nx).forEach(c=>{const t=nTxt(sub[c]);if(/ITEM\s*1/i.test(t))c1=c;if(/ITEM\s*2/i.test(t))c2=c});return[c1,c2]};
 const D=two('d'),H=two('h'),G=two('g'),T=two('t');
 const g=(r,c)=>c?nTxt(R[r][c]):'';
 const after=re=>{const f=find(re,hd.r);if(!f)return'';const i=f.v.indexOf(':');return i<0?'':f.v.slice(i+1).trim()};
 const stf=find(/\bSTRUCTURE\b/i,hd.r),joints=[];
 RN.filter(r=>r>hd.r).forEach(r=>{const row=R[r],wn=g(r,K.jn),m=g(r,K.m).toUpperCase();
  if(!wn||!/^[A-Z]{2,6}$/.test(m)||/^JOINT/i.test(wn))return;
  let dv=K.dt?row[K.dt]:'';if(typeof dv==='number'&&dv>30000&&dv<80000)dv=xDMY(dv);
  joints.push({wn,m,w:g(r,K.w),i1:g(r,D[0]),i2:g(r,D[1]),h1:g(r,H[0]),h2:g(r,H[1]),g1:g(r,G[0]),g2:g(r,G[1]),t1:g(r,T[0]),t2:g(r,T[1]),d:nTxt(dv)})});
 return{st:stf?nTC(stf.v):sh.name,client:after(/^Client\s*:/i),proj:after(/^Project\s*Tit\w*\s*:/i),loc:after(/^Project\s*Loc\w*\s*:/i),joints}}
function ndtParse(sheets,file){
 const P={file:file||'',structures:[],notes:[]};
 sheets.forEach(sh=>{const x=ndtSheet(sh);
  if(!x||!x.joints.length){P.notes.push('Sheet \u201c'+sh.name+'\u201d has no joint table and was skipped');return}
  let st=P.structures.find(s=>s.n===x.st);
  if(!st){st={n:x.st,client:'',proj:'',loc:'',wd:'',sheets:[],joints:[]};P.structures.push(st)}
  ['client','proj','loc'].forEach(k=>{if(!st[k])st[k]=x[k]});
  st.sheets.push(sh.name);x.joints.forEach(j=>st.joints.push(j))});
 P.structures.forEach(st=>{const c={};st.joints.forEach(j=>{if(j.d)c[j.d]=(c[j.d]||0)+1});st.wd=Object.keys(c).sort((a,b)=>c[b]-c[a])[0]||''});
 return P}

/* ---- turn joints into the report rows ---- */
const nNum=t=>/^\d+(\.\d+)?$/.test(t);
const nTk=t=>t===''?'':nNum(t)?t+' mm':t;
function impDesc(j){const a=[j.i1,j.i2].filter(Boolean).join(' / '),t=(j.t1||j.t2)?' ('+nTk(j.t1)+' / '+nTk(j.t2)+')':'';return a+(a&&t?' ':'')+(t?' '+t.trim():'')}
function impUtThk(j){const it=[[j.i1,j.t1],[j.i2,j.t2]].filter(x=>x[1]),pl=it.filter(x=>/PLATE/i.test(x[0])&&nNum(x[1]));return(pl.length?pl:it).map(x=>x[1]).join(' / ')}
function impThk(J){const s=new Set();J.forEach(j=>[j.t1,j.t2].forEach(t=>{if(t)s.add(t)}));const a=[...s];return a.length===1&&nNum(a[0])?a[0]+' mm':a.length?'See below':''}

/* ---- things worth a second look, worked out from the file itself ---- */
function impChecks(P){
 const L=[],ST=P.structures,nm=s=>s.n.replace(/\s*Structure$/i,''),uniq=a=>[...new Set(a)],list=(a,n)=>{n=n||5;return a.length>n?a.slice(0,n).join(', ')+' and '+(a.length-n)+' more':a.join(', ')};
 L.push(['No inspection results in the sheet.','Defect, Accept, Reject, report number, dates and sign-off stay blank. \u201cACC\u201d is visual inspection, so it is not copied.']);
 L.push(['Reports built.','One per method for each structure: '+ST.map(s=>nm(s)+' ('+['MPI','UT'].map(m=>{const n=s.joints.filter(j=>j.m===m).length;return n?n+' '+m:''}).filter(Boolean).join(' + ')+')').join(', ')+'. Sheets read: '+uniq([].concat(...ST.map(s=>s.sheets))).join(', ')+'.']);
 const oth={};ST.forEach(s=>s.joints.forEach(j=>{if(j.m!=='MPI'&&j.m!=='UT')oth[j.m]=(oth[j.m]||0)+1}));
 if(Object.keys(oth).length)L.push(['Not imported.',Object.entries(oth).map(([m,n])=>n+' '+m+' joint'+(n>1?'s':'')).join(', ')+'. The app has MPI and UT reports only.']);
 if(ST.length>1){const sg=s=>s.joints.map(j=>[j.wn,j.m,j.w,j.i1,j.i2,j.t1,j.t2].join('|')).join('\n'),same=ST.every(s=>sg(s)===sg(ST[0])),wd=uniq(ST.map(s=>s.wd));
  if(same){const J=ST[0].joints;L.push(['The structures match.','All '+ST.length+' list the same '+J.length+' joints ('+J[0].wn+' to '+J[J.length-1].wn+')'+(wd.length>1?'; only the weld date differs ('+ST.map(s=>nm(s)+' '+s.wd).join(', ')+')':'')+'.'])}
  else L.push(['The structures differ.',ST.map(s=>nm(s)+' has '+s.joints.length+' joints').join(', ')+'.'])}
 const gp=s=>{const k=new Set();s.joints.forEach(j=>{const m=/(\d+)/.exec(j.wn);if(m)k.add(+m[1])});const a=[...k].sort((x,y)=>x-y),o=[];for(let i=a[0];i<a[a.length-1];i++)if(!k.has(i))o.push(i);return o};
 const pre=((ST[0].joints[0].wn.match(/^\D*/)||[''])[0].trim())||'WN',gs=ST.map(gp),fm=a=>a.map(n=>pre+' '+String(n).padStart(2,'0')).join(', ');
 if(gs.some(a=>a.length)){if(gs.every(a=>a.join()===gs[0].join()))L.push(['Missing from the numbering.',fm(gs[0])+' is not in the sheet, in '+(ST.length>1?'any structure':'the structure')+'.']);
  else L.push(['Missing from the numbering.',ST.map((s,i)=>gs[i].length?nm(s)+': '+fm(gs[i]):'').filter(Boolean).join('; ')+'.'])}
 const du=[];ST.forEach(s=>{const c={};s.joints.forEach(j=>c[j.wn]=(c[j.wn]||0)+1);Object.keys(c).filter(k=>c[k]>1).forEach(k=>du.push(k+' twice in '+nm(s)))});
 if(du.length)L.push(['Repeated joint numbers.',list(du)+'.']);
 const gc={};ST.forEach(s=>s.joints.forEach(j=>[[j.i1,j.g1],[j.i2,j.g2]].forEach(([i,g])=>{if(!i||!g)return;const k=i.replace(/\(.*\)/,'').trim().toUpperCase();((gc[k]=gc[k]||{})[g]=gc[k][g]||[]).push(j.wn)})));
 Object.entries(gc).forEach(([k,o])=>{const e2=Object.entries(o).sort((a,b)=>b[1].length-a[1].length),tot=e2.reduce((a,b)=>a+b[1].length,0);
  if(tot<5||e2.length<2||e2[0][1].length/tot<.85)return;
  L.push([nTC(k)+' grade is not the same everywhere.',e2[0][0]+' on '+e2[0][1].length+' items, but '+e2.slice(1).map(x=>x[0]+' on '+list(uniq(x[1]),4)).join('; ')+'.'])});
 const inch=uniq([].concat(...ST.map(s=>s.joints.filter(j=>[j.t1,j.t2].some(t=>t&&!nNum(t))).map(j=>j.wn))));
 if(inch.length)L.push(['Thickness mixes mm and inches.',inch.length+' joint'+(inch.length>1?'s':'')+' give inches (like 1.5\u2033) under THK [MM], so the header Thickness says \u201cSee below\u201d. Each joint\u2019s own thickness is shown in brackets beside its item (UT shows it in the Plate column).']);
 const hg=uniq([].concat(...ST.map(s=>s.joints.filter(j=>[j.h1,j.h2].some(h=>h&&(/^(S\d{3}|API\b|ASTM\b)/i.test(h)||h===j.g1||h===j.g2))).map(j=>j.wn))));
 if(hg.length)L.push(['A material grade is typed under Heat No.',hg.length+' joint'+(hg.length>1?'s':'')+' ('+list(hg,4)+'). Reports have no heat number field, so nothing is affected.']);
 const nw=uniq([].concat(...ST.map(s=>s.joints.filter(j=>!j.w).map(j=>j.wn))));
 if(nw.length)L.push(['No welder ID.',list(nw)+' have none, so that cell is left blank.']);
 L.push(['Page layout.','The MPI list runs to several pages. The table heading repeats on each page and the signing block stays on the last page.']);
 return L}

var IMPP={"file":"LAYDOWN_NDT.xlsx","structures":[{"n":"Laydown Head Structure","client":"MARINE PLATFORMS","proj":"LAYDOWN HEAD AND START UP HEAD","loc":"PORT HARCOURT","wd":"15/09/2026","sheets":["Sheet1","Sheet2","Sheet3","Sheet4"],"joints":[{"wn":"WN 02","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 03","m":"UT","w":"MPL-IPSL-WID-01","i1":"PLATE(PADEYE)","i2":"PIPE","h1":"255406","h2":"200735","g1":"S355KT+20","g2":"A105","t1":"25","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 04","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PLATE","h1":"3050615","h2":"255353","g1":"API 5L\u00d765","g2":"S355KT-20","t1":"10","t2":"15","d":"15/09/2026"},{"wn":"WN 05","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 06","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 07","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 08","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 09","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 10","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 11","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 12","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 13","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 14","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 15","m":"UT","w":"MPL-IPSL-WID-03","i1":"PLATE(PADEYE)","i2":"PLATE","h1":"234106","h2":"255406","g1":"S355KT+20","g2":"S355KT-20","t1":"25","t2":"50","d":"15/09/2026"},{"wn":"WN 16","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PLATE","h1":"3050615","h2":"292404","g1":"API 5L\u00d765","g2":"S355KT-20","t1":"10","t2":"20","d":"15/09/2026"},{"wn":"WN 17","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"CHEEKPLATE","h1":"234106","h2":"255353","g1":"S355KT-40","g2":"S355KT-40","t1":"50","t2":"15","d":"15/09/2026"},{"wn":"WN 18","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PLATE","h1":"234106","h2":"292404","g1":"S355KT-40","g2":"S355KT-20","t1":"50","t2":"20","d":"15/09/2026"},{"wn":"WN 19","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"CHEEKPLATE","h1":"234106","h2":"255353","g1":"S355KT-40","g2":"S355KT-40","t1":"50","t2":"15","d":"15/09/2026"},{"wn":"WN 20","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"292404","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"20","t2":"10","d":"15/09/2026"},{"wn":"WN 21","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PLATE","h1":"292404","h2":"255406","g1":"S355KT-20","g2":"S355KT-40","t1":"20","t2":"50","d":"15/09/2026"},{"wn":"WN 22","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 23","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 24","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 25","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 26","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 27","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 28","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 29","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 30","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 31","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 32","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 33","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 34","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 35","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 36","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 37","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 37A","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 38","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 39","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 40","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 41","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 42","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN42A","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 43","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 44","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 45","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 46","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 47","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 49","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 50","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"15/09/2026"},{"wn":"WN 51","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 52","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 53","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A695","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 54","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 55","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 56","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 57","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 58","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 59","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 60","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A695","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 61","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 62","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 63","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 64","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 65","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 66","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 67","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 68","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 69","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 70","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 71","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 72","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 73","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 74","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 75","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 76","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 77","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"},{"wn":"WN 78","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"15/09/2026"}]},{"n":"Start Up Head Structure","client":"MARINE PLATFORMS","proj":"LAYDOWN HEAD AND START UP HEAD","loc":"PORT HARCOURT","wd":"16/09/2026","sheets":["Sheet5","Sheet6","Sheet7","Sheet8"],"joints":[{"wn":"WN 02","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 03","m":"UT","w":"MPL-IPSL-WID-01","i1":"PLATE(PADEYE)","i2":"PIPE","h1":"255406","h2":"200735","g1":"S355KT+20","g2":"A105","t1":"25","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 04","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PLATE","h1":"3050615","h2":"255353","g1":"API 5L\u00d765","g2":"S355KT-20","t1":"10","t2":"15","d":"16/09/2026"},{"wn":"WN 05","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 06","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 07","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 08","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 09","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 10","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 11","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 12","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 13","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 14","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"WELDOLET","h1":"3050615","h2":"NA","g1":"API 5L\u00d765","g2":"A105","t1":"10","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 15","m":"UT","w":"MPL-IPSL-WID-03","i1":"PLATE(PADEYE)","i2":"PLATE","h1":"234106","h2":"255406","g1":"S355KT+20","g2":"S355KT-20","t1":"25","t2":"50","d":"16/09/2026"},{"wn":"WN 16","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PLATE","h1":"3050615","h2":"292404","g1":"API 5L\u00d765","g2":"S355KT-20","t1":"10","t2":"20","d":"16/09/2026"},{"wn":"WN 17","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"CHEEKPLATE","h1":"234106","h2":"255353","g1":"S355KT-40","g2":"S355KT-40","t1":"50","t2":"15","d":"16/09/2026"},{"wn":"WN 18","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PLATE","h1":"234106","h2":"292404","g1":"S355KT-40","g2":"S355KT-20","t1":"50","t2":"20","d":"16/09/2026"},{"wn":"WN 19","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"CHEEKPLATE","h1":"234106","h2":"255353","g1":"S355KT-40","g2":"S355KT-40","t1":"50","t2":"15","d":"16/09/2026"},{"wn":"WN 20","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"292404","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"20","t2":"10","d":"16/09/2026"},{"wn":"WN 21","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PLATE","h1":"292404","h2":"255406","g1":"S355KT-20","g2":"S355KT-40","t1":"20","t2":"50","d":"16/09/2026"},{"wn":"WN 22","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 23","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 24","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 25","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 26","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 27","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 28","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 29","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 30","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 31","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 32","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 33","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 34","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 35","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 36","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 37","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 37A","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 38","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 39","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"158840","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 40","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 41","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 42","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN42A","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 43","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"158840","h2":"S235KL+20","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 44","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 45","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 46","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 47","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 49","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 50","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PLATE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S355KT-20","g2":"API 5L\u00d765","t1":"15","t2":"10","d":"16/09/2026"},{"wn":"WN 51","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 52","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 53","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A695","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 54","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 55","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 56","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 57","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 58","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 59","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 60","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A695","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 61","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 62","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 63","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 64","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 65","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 66","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 67","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 68","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 69","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 70","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 71","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 72","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 73","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 74","m":"MPI","w":"MPL-IPSL-WID-03","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 75","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 76","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"FLANGE","h1":"3050615","h2":"26C105","g1":"S235KL+20","g2":"ASTM A694","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 77","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"},{"wn":"WN 78","m":"MPI","w":"MPL-IPSL-WID-01","i1":"PIPE","i2":"PIPE","h1":"3050615","h2":"3050615","g1":"S235KL+20","g2":"S235KL+20","t1":"1.5''","t2":"1.5''","d":"16/09/2026"}]}],"notes":[],"builtin":1};
var IMPERR='';
function impDocs(){const out=[];
 IMPP.structures.forEach(S=>['mpi','ut'].forEach(m=>{const J=S.joints.filter(j=>j.m===m.toUpperCase());if(!J.length)return;
  const doc=newDoc(m),d=doc.d;
  [['client',S.client],['proj',S.proj],['loc',S.loc]].forEach(([k,v])=>{if(v)d[k]=v});d.thk=impThk(J)||d.thk;
  if(m==='mpi'){d.item=S.n.toUpperCase();d.res=J.map(j=>[impDesc(j),j.wn,j.w,'','','','']);}
  else{d.comp=S.n.toUpperCase();if(S.wd)d.wd=S.wd;d.def=J.map(j=>[j.w,j.wn,impUtThk(j),'','','','','','']);}
  doc.title=S.n.replace(/\s*Structure$/i,'')+(m==='mpi'?' - MPI Report':' - UT Report');doc.imp=1;
  doc.b=JSON.stringify([TPL[m].n,d]);autoSign(doc);out.push(doc)}));
 return out}
async function impLoad(f){IMPERR='';
 try{const P=ndtParse(await xlsxRead(await f.arrayBuffer()),f.name);
  if(!P.structures.length)throw new Error('No NDT joint table was found. The sheet needs a heading row with JOINT NO. and NDT METHOD.');
  const keep=IMPP;IMPP=P;IMPD=impDocs();if(!IMPD.length){IMPP=keep;IMPD=impDocs();throw new Error('The sheet has no MPI or UT joints.')}impK=0;
  toast('Read '+P.structures.length+' structure'+(P.structures.length>1?'s':'')+' and '+IMPD.length+' reports from '+f.name)}
 catch(err){console.error(err);IMPERR=(err&&err.message)||String(err);toast('Could not read that file')}
 render()}
function impEntry(){return`<button class="imgo" id="impgo" type="button"><span class="imgi"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg></span><span class="imgt"><b>Import spreadsheet</b><small>Laydown and Start Up joints into MPI and UT reports</small></span><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>`}
function impHtml(){const D=IMPD,d=D[impK],saved=x=>docs.some(y=>y.id===x.id),nS=D.filter(saved).length;
 return bar(`<button class="ib" id="impb" aria-label="Back">${IC.back}</button><h1 class="h1 s">Import spreadsheet</h1>`)+`<main class="wrap impw"><p class="sub">Nothing is saved until you choose</p>
<div class="imsrc"><div class="imsi"><b>${e(IMPP.file)}</b><small>${IMPP.builtin?'Built-in copy of your spreadsheet. Choose the file to read a new or updated one.':IMPP.structures.length+' structure'+(IMPP.structures.length>1?'s':'')+' \u00b7 '+IMPP.structures.reduce((a,x)=>a+x.joints.length,0)+' joints read from the file'}</small>${IMPERR?`<small class="imer">${e(IMPERR)}</small>`:''}</div><label class="btn p imfb">Choose spreadsheet<input type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden data-imx="1"></label></div>
<div class="imtabs" role="tablist">${D.map((x,i)=>`<button type="button" role="tab" data-imk="${i}" aria-selected="${i===impK}">${e(x.title.replace(' - ',' \u00b7 ').replace(' Report',''))}<small>${x.t==='mpi'?x.d.res.length:x.d.def.length} joints${saved(x)?' \u00b7 Saved':''}</small></button>`).join('')}</div>
<div class="imbar"><label class="imsw"><input type="checkbox" id="imhl" ${impHL?'checked':''}>Show what was filled in</label><div class="imkey"><span class="k1">From your spreadsheet</span><span class="k2">Technician fills in</span></div></div>
<div class="imv${impHL?' hl':''}" id="imv">${sheet(d)}</div>
<details class="imchk" open><summary>Things to check before saving</summary><ol>${impChecks(IMPP).map(c=>`<li><b>${e(c[0])}</b> ${e(c[1])}</li>`).join('')}</ol></details></main>
<div class="pvbar imact"><button class="btn" id="imprev" type="button">Preview PDF</button><button class="btn p" id="impall" type="button">${nS===D.length?'All saved to Files in app':'Save all 4 to Files in app'}</button></div>`}
function impFit(){const v=$('#imv');if(!v)return;const s=v.firstElementChild;if(!s)return;const k=Math.min(1,v.clientWidth/794);s.style.transform='scale('+k+')';v.style.height=Math.ceil(s.offsetHeight*k)+'px'}
async function impPreview(btn){const lab=btn.textContent,d=IMPD[impK];btn.disabled=true;btn.textContent='Preparing\u2026';
 try{const blob=await makePdf(d);pvB={blob,name:d.title,doc:d,imp:1};cur=d;ret='imp';view='pv';render()}
 catch(err){console.error(err);toast('Could not make the PDF: '+(err&&err.message||err))}
 finally{btn.disabled=false;btn.textContent=lab}}
async function impSaveAll(btn){const lab=btn.textContent;btn.disabled=true;let n=0;
 try{for(const d of IMPD){if(docs.some(x=>x.id===d.id))continue;btn.textContent='Saving '+(n+1)+' of '+IMPD.filter(x=>!docs.some(y=>y.id===x.id)).length+'\u2026';
   const blob=await makePdf(d);await DWSTORE.pdf.put(d.id,await blob.arrayBuffer());d.sv={at:Date.now(),h:docSig(d),n:blob.size};d.u=Date.now();docs.push(d);SV('dw.docs',docs);n++}
  toast(n?n+' report'+(n>1?'s':'')+' saved to Files in the app':'Already saved');render()}
 catch(err){console.error(err);toast('Could not save: '+(err&&err.message||err));btn.disabled=false;btn.textContent=lab}}
async function pvSaveApp(btn){const d=pvB&&pvB.doc;if(!d)return;const lab=btn.querySelector('span').textContent;btn.disabled=true;btn.querySelector('span').textContent='Saving\u2026';
 try{await DWSTORE.pdf.put(d.id,await pvB.blob.arrayBuffer());
  if(!docs.some(x=>x.id===d.id))docs.push(d);
  d.sv={at:Date.now(),h:docSig(d),n:pvB.blob.size};d.u=Date.now();SV('dw.docs',docs);toast('Saved to Files in the app');
  btn.classList.add('done');btn.querySelector('span').textContent='Saved to Files in app'}
 catch(err){console.error(err);toast('Could not save: '+(err&&err.message||err));btn.querySelector('span').textContent=lab}
 finally{btn.disabled=false}}
document.addEventListener('click',ev=>{
 if(ev.target.closest('#impgo')){IMPERR='';IMPD=impDocs();impK=0;ret=view;view='imp';render();return}
 if(view==='ed'&&ev.target.closest('[data-imtg]')){impEd=!impEd;SV('dw.imhl',impEd);const st=$('#stage');if(st)st.classList.toggle('imhl',impEd);ev.target.closest('[data-imtg]').setAttribute('aria-pressed',impEd);return}
 if(view!=='imp')return;const t=ev.target.closest('[data-imk],#impb,#imprev,#impall');if(!t)return;
 if(t.dataset.imk!=null){impK=+t.dataset.imk;render()}
 else if(t.id==='impb')goBack();else if(t.id==='imprev')impPreview(t);else if(t.id==='impall')impSaveAll(t)});
document.addEventListener('change',ev=>{if(ev.target.dataset&&ev.target.dataset.imx){const f=ev.target.files&&ev.target.files[0];ev.target.value='';if(f)impLoad(f);return}if(ev.target.id==='imhl'){impHL=ev.target.checked;const v=$('#imv');if(v)v.classList.toggle('hl',impHL)}});
addEventListener('resize',()=>{if(view==='imp')impFit()});
