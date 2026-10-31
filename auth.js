/* Danholsen Workspace - sign-in, approval check, account panel and staff manager.
   Access works by approved address: a person gets in only if an admin has added their exact email address to the staff list.
   Plain fetch against Supabase (no library), so it stays inside the flat file set and the offline cache. */
(function(){
'use strict';
var C=window.DW_CONFIG||{},URL_=String(C.SUPABASE_URL||'').replace(/\/+$/,''),KEY=C.SUPABASE_KEY||'',KS='dw.auth',GRACE=(+C.OFFLINE_DAYS||14)*864e5;
var S=null,gateRes=null,entered=false,ov=null,modal=null,staffList=[],staffMe='',busyChk=null,refreshing=null,lastChk=0;

/* ---------- small helpers ---------- */
var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
var say=function(m){try{if(typeof toast==='function')toast(m)}catch(_){}};
function load(){try{var j=JSON.parse(localStorage.getItem(KS));return j&&j.rt&&j.uid?j:null}catch(_){return null}}
function save(){try{if(S)localStorage.setItem(KS,JSON.stringify(S));else localStorage.removeItem(KS)}catch(_){}}
function netErr(m){var e=new Error(m||'No connection');e.code='net';return e}
function authErr(m){var e=new Error(m||'Signed out');e.code='auth';return e}

async function call(path,o,ms){
  o=o||{};var ac=typeof AbortController==='function'?new AbortController():null,tm=ac?setTimeout(function(){ac.abort()},ms||15000):null,h=Object.assign({apikey:KEY},o.headers||{});
  if(o.body&&!h['Content-Type'])h['Content-Type']='application/json';
  try{
    var r=await fetch(URL_+path,{method:o.method||'GET',headers:h,body:o.body,signal:ac?ac.signal:undefined,cache:'no-store'});
    var j=null;try{j=await r.json()}catch(_){}
    return{ok:r.ok,status:r.status,j:j}
  }catch(_){throw netErr()}
  finally{if(tm)clearTimeout(tm)}
}

/* ---------- session ---------- */
function adopt(j){
  var exp=j.expires_at?j.expires_at*1000:Date.now()+(+j.expires_in||3600)*1000;
  S=Object.assign({},S||{},{at:j.access_token,rt:j.refresh_token,exp:exp,uid:(j.user&&j.user.id)||(S&&S.uid),email:((j.user&&j.user.email)||(S&&S.email)||'').toLowerCase()});
  save()
}
function refresh(ms){
  if(refreshing)return refreshing;
  refreshing=(async function(){
    if(!S)throw authErr();
    var r=await call('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:S.rt})},ms);
    if(!r.ok){if(r.status>=500)throw netErr();throw authErr((r.j&&(r.j.msg||r.j.error_description))||'Signed out')}
    adopt(r.j)
  })();
  var clear=function(){refreshing=null};refreshing.then(clear,clear);return refreshing
}
async function token(ms){
  if(!S)throw authErr();
  if(S.exp-Date.now()<60e3)await refresh(ms);
  return S.at
}
async function getStaffRow(ms){
  for(var n=0;n<2;n++){
    var t=await token(ms);
    var r=await call('/rest/v1/staff?select=id,email,name,role,active&id=eq.'+encodeURIComponent(S.uid)+'&limit=1',{headers:{Authorization:'Bearer '+t}},ms);
    if(r.status===401&&n===0){S.exp=0;continue}
    if(r.status===401)throw authErr();
    if(r.status>=500)throw netErr();
    if(!r.ok)throw new Error((r.j&&r.j.message)||'Could not check access');
    return Array.isArray(r.j)&&r.j[0]||null
  }
}
var inGrace=function(){return !!(S&&S.ver&&Date.now()-S.ver<GRACE)};

/* Returns 'ok' | 'offline' (allowed on the last good check) | 'denied' | 'expired' | 'neednet'. */
async function check(ms){
  if(!S)return'expired';
  try{
    var row=await getStaffRow(ms);
    if(!row||!row.active){return'denied'}
    S.ver=Date.now();S.role=row.role;S.name=row.name||'';S.email=(row.email||S.email).toLowerCase();save();lastChk=Date.now();
    return'ok'
  }catch(err){
    if(err.code==='net')return inGrace()?'offline':'neednet';
    if(err.code==='auth')return'expired';
    return inGrace()?'offline':'neednet'
  }
}

async function signIn(email,pw){
  var r;
  try{r=await call('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email:email,password:pw})})}
  catch(_){return{err:'Cannot reach the server. Check your internet connection and try again.'}}
  if(!r.ok){
    var c=r.j&&(r.j.error_code||r.j.code),m=(r.j&&(r.j.msg||r.j.error_description||r.j.message))||'';
    if(c==='user_banned'||/banned/i.test(m))return{err:'Access for this account has been turned off. Ask an admin.'};
    if(r.status===429||c==='over_request_rate_limit')return{err:'Too many attempts. Wait a minute and try again.'};
    if(r.status>=500)return{err:'The server had a problem. Try again in a moment.'};
    return{err:'That email or password is not right.'}
  }
  S=null;adopt(r.j);
  var res=await check();
  if(res==='ok')return{ok:true};
  if(res==='denied'){await dropSession();return{err:'This email address has not been approved. Ask an admin to add it.'}}
  await dropSession();return{err:'Could not check your access. Try again.'}
}
async function dropSession(){
  var t=S&&S.at;S=null;save();
  if(t){try{await call('/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer '+t}},4000)}catch(_){}}
}

/* ---------- lock screen ---------- */
function mkOv(){
  if(ov)return ov;ov=document.createElement('div');ov.className='dwa-ov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Sign in');
  document.body.appendChild(ov);document.documentElement.classList.add('dwa-lock');return ov
}
function hideOv(){if(ov){ov.remove();ov=null}document.documentElement.classList.remove('dwa-lock')}
function splash(msg){mkOv().innerHTML='<div class="dwa-box dwa-c"><img class="dwa-logo" src="danholsen-full.png" alt="Danholsen"><p class="dwa-sub"><span class="dwa-spin"></span>'+esc(msg)+'</p></div>'}
function showLogin(msg,email){
  mkOv().innerHTML='<form class="dwa-box" id="dwaf" novalidate><img class="dwa-logo" src="danholsen-full.png" alt="Danholsen">'+
   '<h1>Sign in</h1><p class="dwa-sub">Danholsen Workspace is for approved staff. Use the email address an admin added for you.</p>'+
   '<p class="dwa-msg" id="dwam" role="alert" aria-live="polite">'+esc(msg||'')+'</p>'+
   '<label class="dwa-l">Email<input id="dwae" type="email" inputmode="email" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required value="'+esc(email||'')+'"></label>'+
   '<label class="dwa-l">Password<span class="dwa-pw"><input id="dwap" type="password" autocomplete="current-password" required><button type="button" class="dwa-eye" id="dwaeye" aria-label="Show password">Show</button></span></label>'+
   '<button class="btn p dwa-go" id="dwago" type="submit">Sign in</button>'+
   '<p class="dwa-foot">No account? Access is by invitation only. Ask an admin to add your email address.</p></form>';
  var f=ov.querySelector('#dwaf'),em=ov.querySelector('#dwae'),pw=ov.querySelector('#dwap'),go=ov.querySelector('#dwago'),mg=ov.querySelector('#dwam');
  ov.querySelector('#dwaeye').onclick=function(){var s=pw.type==='password';pw.type=s?'text':'password';this.textContent=s?'Hide':'Show';this.setAttribute('aria-label',s?'Hide password':'Show password')};
  f.onsubmit=async function(ev){
    ev.preventDefault();var e=em.value.trim().toLowerCase(),p=pw.value;
    if(!e||!p){mg.textContent='Enter your email and password.';return}
    go.disabled=true;go.textContent='Signing in\u2026';mg.textContent='';
    var r=await signIn(e,p);
    if(r.ok){enter();return}
    go.disabled=false;go.textContent='Sign in';mg.textContent=r.err;pw.value='';pw.focus()
  };
  setTimeout(function(){(email?pw:em).focus()},50)
}
function lockScreen(msg){closeModal();var em=S&&S.email||'';showLogin(msg,em)}

/* ---------- gate: the app does not start until this resolves ---------- */
function enter(){
  hideOv();entered=true;
  if(gateRes){var g=gateRes;gateRes=null;g()}
  else if(typeof render==='function'){try{render()}catch(_){}}
}
function gate(){
  return new Promise(function(res){
    gateRes=res;S=load();
    if(!URL_||!KEY){showLogin('This copy of the app is not connected to its server yet.');return}
    if(!S){showLogin();return}
    splash('Checking your access\u2026');
    check(6000).then(function(r){
      if(r==='ok'||r==='offline'){enter();return}
      if(r==='denied'){dropSession().then(function(){showLogin('Your access has been removed. Ask an admin if this is a mistake.')});return}
      if(r==='neednet'){showLogin('You need an internet connection to sign in again.',S&&S.email);return}
      S=null;save();showLogin('Please sign in again.')
    })
  })
}

/* Keep checking while the app is open, so removing someone takes effect quickly. */
async function recheck(force){
  if(!entered||!S||busyChk||(!force&&Date.now()-lastChk<60e3))return;
  busyChk=check(8000);var r=await busyChk;busyChk=null;
  if(r==='denied'){await dropSession();lockScreen('Your access has been removed. Ask an admin if this is a mistake.')}
  else if(r==='expired'){S=null;save();lockScreen('Your session ended. Please sign in again.')}
}
document.addEventListener('visibilitychange',function(){if(!document.hidden)recheck()});
addEventListener('focus',function(){recheck()});
addEventListener('online',function(){recheck(true)});
setInterval(function(){recheck()},5*60e3);

/* ---------- account section (Settings > General) ---------- */
function acctHtml(){
  if(!S)return'';
  var adm=S.role==='admin',chev=(typeof CI!=='undefined'&&CI.chev)||'';
  return'<section class="pane dwa-acct"><div class="ch"><span class="ci2"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg></span><div><h3>Account</h3><small>Signed in'+(adm?' \u00b7 Admin':'')+'</small></div></div>'+
   '<p class="dwa-who"><b>'+esc(S.name||S.email)+'</b>'+(S.name?'<span>'+esc(S.email)+'</span>':'')+'</p>'+
   (adm?'<button class="navrow" type="button" data-dwa="staff"><span><b>Staff access</b><small>Add people, remove access, reset passwords</small></span>'+chev+'</button>':'')+
   '<button class="navrow" type="button" data-dwa="pw"><span><b>Change password</b><small>Choose your own instead of the one you were given</small></span>'+chev+'</button>'+
   '<button class="btn wide" type="button" data-dwa="out">Sign out</button>'+
   '<p class="hint">Signing out locks the app. Your documents stay on this device.</p></section>'
}

/* ---------- modal plumbing ---------- */
function openModal(title,html,wide){
  closeModal();modal=document.createElement('div');modal.className='dwa-ov dwa-mo';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
  modal.innerHTML='<div class="dwa-card'+(wide?' dwa-w':'')+'"><div class="dwa-hd"><h2>'+esc(title)+'</h2><button type="button" class="ib" data-dwa="close" aria-label="Close">\u2715</button></div><div class="dwa-bd">'+html+'</div></div>';
  document.body.appendChild(modal);modal.addEventListener('click',function(ev){if(ev.target===modal)closeModal()});return modal
}
function closeModal(){if(modal){modal.remove();modal=null}}
function copy(t){try{return navigator.clipboard.writeText(t).then(function(){return true},function(){return false})}catch(_){return Promise.resolve(false)}}

/* ---------- change password ---------- */
function pwModal(){
  var m=openModal('Change password','<p class="dwa-sub">Use at least 8 characters. A password manager is the easiest way to keep a long one.</p><p class="dwa-msg" id="dwpm" role="alert"></p>'+
   '<label class="dwa-l">New password<input id="dwp1" type="password" autocomplete="new-password"></label><label class="dwa-l">Type it again<input id="dwp2" type="password" autocomplete="new-password"></label>'+
   '<div class="dwa-row"><button class="btn" type="button" data-dwa="close">Cancel</button><button class="btn p" type="button" id="dwpgo">Save password</button></div>');
  var mg=m.querySelector('#dwpm'),a=m.querySelector('#dwp1'),b=m.querySelector('#dwp2'),go=m.querySelector('#dwpgo');
  go.onclick=async function(){
    if(a.value.length<8){mg.textContent='Use at least 8 characters.';return}
    if(a.value!==b.value){mg.textContent='The two passwords are not the same.';return}
    go.disabled=true;mg.textContent='';
    try{
      var t=await token(),r=await call('/auth/v1/user',{method:'PUT',headers:{Authorization:'Bearer '+t},body:JSON.stringify({password:a.value})});
      if(r.ok){closeModal();say('Password changed');return}
      var msg=(r.j&&(r.j.msg||r.j.message))||'Could not change the password.';
      mg.textContent=/reauth|recent/i.test(msg)?'For safety, sign out, sign in again, then change the password.':msg
    }catch(err){mg.textContent=err.code==='net'?'No connection. Try again when you are online.':'Could not change the password.'}
    go.disabled=false
  };
  setTimeout(function(){a.focus()},50)
}

/* ---------- staff manager (admins) ---------- */
async function admin(body){
  var t=await token(),r=await call('/functions/v1/staff-admin',{method:'POST',headers:{Authorization:'Bearer '+t},body:JSON.stringify(body)},20000);
  if(!r.ok){
    var msg=(r.j&&(r.j.error||r.j.message||r.j.msg))||'';
    if(r.status===404)msg='The staff-admin function has not been deployed yet. See the setup steps.';
    else if(r.status===403)msg=msg||'Admins only.';
    throw new Error(msg||'Something went wrong ('+r.status+').')
  }
  return r.j
}
function staffRows(){
  if(!staffList.length)return'<p class="hint">No one on the list yet.</p>';
  return staffList.map(function(p){
    var me=p.id===staffMe,off=!p.active,id=esc(p.id);
    return'<div class="dwa-p'+(off?' off':'')+'"><div class="dwa-pi"><b>'+esc(p.name||p.email)+(me?' <em>(you)</em>':'')+'</b>'+(p.name?'<span>'+esc(p.email)+'</span>':'')+
      '<span class="dwa-tags"><i class="'+(p.role==='admin'?'ad':'')+'">'+(p.role==='admin'?'Admin':'Staff')+'</i><i class="'+(off?'bad':'ok')+'">'+(off?'Access off':'Active')+'</i></span></div>'+
      (me?'':'<div class="dwa-pa">'+
        (off?'<button class="btn" type="button" data-dwa="react" data-id="'+id+'">Turn access on</button>':'<button class="btn" type="button" data-dwa="deact" data-id="'+id+'">Turn access off</button>')+
        '<button class="btn" type="button" data-dwa="reset" data-id="'+id+'">New password</button>'+
        '<button class="btn" type="button" data-dwa="role" data-id="'+id+'" data-r="'+(p.role==='admin'?'staff':'admin')+'">'+(p.role==='admin'?'Make staff':'Make admin')+'</button>'+
        '<button class="btn d" type="button" data-dwa="rem" data-id="'+id+'">Remove</button></div>')+'</div>'
  }).join('')
}
function paintStaff(note){
  var l=modal&&modal.querySelector('#dwsl');if(l)l.innerHTML=staffRows();
  var n=modal&&modal.querySelector('#dwsn');if(n&&note!==undefined)n.innerHTML=note
}
async function loadStaff(){
  try{var j=await admin({action:'list'});staffList=j.staff||[];staffMe=j.me||'';paintStaff()}
  catch(err){var l=modal&&modal.querySelector('#dwsl');if(l)l.innerHTML='<p class="dwa-msg">'+esc(err.message||'Could not load the list.')+'</p>'}
}
function pwCard(r,title){
  return'<div class="dwa-new"><b>'+esc(title)+'</b><p>Give this password to <b>'+esc(r.email)+'</b> in person, by phone or in a private message. It is shown only once and is not sent by email.</p>'+
   '<code id="dwcode">'+esc(r.password)+'</code><div class="dwa-row"><button class="btn p" type="button" data-dwa="copy" data-t="'+esc(r.password)+'">Copy password</button><button class="btn" type="button" data-dwa="hide">Done</button></div>'+
   '<p class="hint">They can change it themselves under Settings, Account.</p></div>'
}
function staffModal(){
  openModal('Staff access','<p class="dwa-sub">A person can sign in only if their exact email address is on this list. Gmail and @danholsen.com addresses both work. Turning access off or removing someone locks them out within minutes, or straight away the next time they open the app.</p>'+
   '<div id="dwsn"></div>'+
   '<form class="dwa-add" id="dwadd" novalidate><h3>Add a person</h3><p class="dwa-msg" id="dwam2" role="alert"></p>'+
   '<label class="dwa-l">Email address<input id="dwne" type="email" inputmode="email" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="name@danholsen.com or name@gmail.com"></label>'+
   '<label class="dwa-l">Name (optional)<input id="dwnn" type="text" autocomplete="off"></label>'+
   '<label class="dwa-l">Role<select id="dwnr"><option value="staff">Staff</option><option value="admin">Admin (can manage this list)</option></select></label>'+
   '<button class="btn p dwa-go" id="dwng" type="submit">Add and create password</button></form>'+
   '<h3 class="dwa-h3">People</h3><div id="dwsl"><p class="hint">Loading\u2026</p></div>',true);
  var f=modal.querySelector('#dwadd'),mg=modal.querySelector('#dwam2'),go=modal.querySelector('#dwng');
  f.onsubmit=async function(ev){
    ev.preventDefault();var em=modal.querySelector('#dwne').value.trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){mg.textContent='Check the email address. Please type it again carefully.';return}
    go.disabled=true;mg.textContent='';
    try{
      var r=await admin({action:'add',email:em,name:modal.querySelector('#dwnn').value,role:modal.querySelector('#dwnr').value});
      f.reset();paintStaff(pwCard(r,'Added. Their password:'));await loadStaff();
      var n=modal.querySelector('#dwsn');if(n)n.scrollIntoView({block:'nearest'})
    }catch(err){mg.textContent=err.message}
    go.disabled=false
  };
  loadStaff()
}
async function staffAct(a,id,btn){
  var p=staffList.find(function(x){return x.id===id});if(!p)return;var who=p.name||p.email;
  var ask={deact:'Turn off access for '+who+'? They will be locked out of the app.',rem:'Remove '+who+' completely? Their login is deleted and cannot be undone.',reset:'Make a new password for '+who+'? Their old password stops working.'}[a];
  if(ask&&!confirm(ask))return;
  if(btn)btn.disabled=true;
  try{
    if(a==='deact')await admin({action:'deactivate',id:id});
    else if(a==='react')await admin({action:'reactivate',id:id});
    else if(a==='rem')await admin({action:'remove',id:id});
    else if(a==='role')await admin({action:'role',id:id,role:btn.dataset.r});
    else if(a==='reset'){var r=await admin({action:'reset',id:id});paintStaff(pwCard(r,'New password:'))}
    await loadStaff();if(a!=='reset')say('Done')
  }catch(err){say(err.message);if(btn)btn.disabled=false}
}

/* ---------- clicks ---------- */
document.addEventListener('click',function(ev){
  var t=ev.target.closest&&ev.target.closest('[data-dwa]');if(!t)return;var a=t.dataset.dwa;
  if(a==='close')closeModal();
  else if(a==='pw')pwModal();
  else if(a==='staff')staffModal();
  else if(a==='out'){if(confirm('Sign out? The app will lock. Your documents stay on this device.'))dropSession().then(function(){lockScreen('You have signed out.')})}
  else if(a==='copy')copy(t.dataset.t).then(function(ok){t.textContent=ok?'Copied':'Copy failed - select and copy it'});
  else if(a==='hide')paintStaff('');
  else staffAct(a,t.dataset.id,t)
});
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&modal)closeModal()});

window.DWAUTH={gate:gate,acctHtml:acctHtml,token:function(){return token()},user:function(){return S?{id:S.uid,email:S.email,name:S.name||'',role:S.role||'staff'}:null},signOut:function(){return dropSession().then(function(){lockScreen('You have signed out.')})}};
})();
