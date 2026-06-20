// ══════════════════════════════════════
// SUPABASE INIT
// ══════════════════════════════════════
const SUPA_URL = 'https://ltsqledmcbuxdlbkyqui.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0c3FsZWRtY2J1eGRsYmt5cXVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MzUwMDUsImV4cCI6MjA5NjUxMTAwNX0.R55UGBjXdSPEoZBfWWsCuUgi1cjgEQIX-wzvPNfSDpM';
const { createClient } = supabase;
const sb = createClient(SUPA_URL, SUPA_KEY);

let currentUser = null;
let currentBrand = null;
let allEntries = [];
let charts = {};
let curPage = 'dashboard';
let authMode = 'login'; // 'login' | 'signup'

// ══════════════════════════════════════
// SCREEN ROUTING
// ══════════════════════════════════════
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
}

// ══════════════════════════════════════
// INIT
// ══════════════════════════════════════
async function init(){
  const { data: { session } } = await sb.auth.getSession();
  if(session){
    currentUser = session.user;
    await afterLogin();
  } else {
    showAuthScreen();
  }
}

sb.auth.onAuthStateChange(async (event, session)=>{
  if(event==='SIGNED_IN' && session && !currentUser){
    currentUser = session.user;
    await afterLogin();
  }
  if(event==='SIGNED_OUT'){
    currentUser = null; currentBrand = null; allEntries=[];
    showAuthScreen();
  }
});

function showAuthScreen(){ showScreen('auth'); }

// ══════════════════════════════════════
// AUTH — EMAIL + PASSWORD
// ══════════════════════════════════════
function switchAuthTab(mode){
  authMode = mode;
  document.getElementById('tab-login').classList.toggle('active', mode==='login');
  document.getElementById('tab-signup').classList.toggle('active', mode==='signup');
  document.getElementById('auth-confirm-group').classList.toggle('hide', mode==='login');
  document.getElementById('auth-submit-btn').textContent = mode==='login' ? 'Log in →' : 'Create account →';
  document.getElementById('auth-err').textContent='';
  document.getElementById('auth-msg-box').innerHTML='';
}

function togglePw(){
  const inp = document.getElementById('auth-password');
  const btn = document.querySelector('.af-pw-toggle');
  if(inp.type==='password'){ inp.type='text'; btn.textContent='HIDE'; }
  else { inp.type='password'; btn.textContent='SHOW'; }
}

async function submitAuth(){
  const emailEl = document.getElementById('auth-email');
  const pwEl = document.getElementById('auth-password');
  const email = (emailEl.value||'').trim();
  const pw = pwEl.value||'';
  const errEl = document.getElementById('auth-err');
  const btn = document.getElementById('auth-submit-btn');
  errEl.textContent='';

  if(!email || !email.includes('@')){ errEl.textContent='Enter a valid email address.'; emailEl.focus(); return; }
  if(!pw){ errEl.textContent='Enter your password.'; pwEl.focus(); return; }
  if(pw.length<6){ errEl.textContent=`Password is ${pw.length} character${pw.length===1?'':'s'} — needs at least 6.`; pwEl.focus(); return; }

  if(authMode==='signup'){
    const pw2El = document.getElementById('auth-password2');
    const pw2 = pw2El.value||'';
    if(!pw2){ errEl.textContent='Confirm your password.'; pw2El.focus(); return; }
    if(pw!==pw2){ errEl.textContent='Passwords do not match.'; pw2El.focus(); return; }
  }

  btn.disabled=true; btn.textContent='Please wait…';

  if(authMode==='signup'){
    const { data, error } = await sb.auth.signUp({ email, password: pw });
    if(error){ errEl.textContent=error.message; btn.disabled=false; switchAuthTab('signup'); return; }
    if(data.session){
      currentUser = data.user;
      await afterLogin();
    } else {
      document.getElementById('auth-msg-box').innerHTML = '<div class="af-msg ok">✓ Account created. Check your email to confirm, then log in.</div>';
      switchAuthTab('login');
    }
  } else {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if(error){ errEl.textContent='Incorrect email or password.'; btn.disabled=false; switchAuthTab('login'); return; }
    currentUser = data.user;
    await afterLogin();
  }
  btn.disabled=false;
  switchAuthTab(authMode);
}

async function signOut(){
  await sb.auth.signOut();
  localStorage.removeItem('cetara_pin');
  localStorage.removeItem('cetara_pin_email');
  showAuthScreen();
}

// ══════════════════════════════════════
// PIN QUICK LOGIN
// ══════════════════════════════════════
let pinValue='';

function showPinScreen(){
  const savedEmail = localStorage.getItem('cetara_pin_email');
  if(!savedEmail){ document.getElementById('pin-err').textContent='No PIN set up yet. Log in with email first.'; }
  document.getElementById('pin-email-sub').textContent = savedEmail ? savedEmail : 'Enter your PIN';
  pinValue=''; updatePinDots();
  showScreen('pin');
}

function pinKey(k){
  if(pinValue.length>=4) return;
  pinValue+=k; updatePinDots();
  if(pinValue.length===4) setTimeout(checkPin,150);
}
function pinDel(){ pinValue=pinValue.slice(0,-1); updatePinDots(); document.getElementById('pin-err').textContent=''; }
function updatePinDots(){ for(let i=0;i<4;i++) document.getElementById('d'+i).classList.toggle('filled', i<pinValue.length); }

async function checkPin(){
  const stored = localStorage.getItem('cetara_pin');
  const storedEmail = localStorage.getItem('cetara_pin_email');
  if(!stored || !storedEmail){ document.getElementById('pin-err').textContent='No PIN set up. Use email login.'; pinValue=''; updatePinDots(); return; }
  if(pinValue!==stored){ document.getElementById('pin-err').textContent='Wrong PIN.'; pinValue=''; updatePinDots(); return; }
  const { data: { session } } = await sb.auth.getSession();
  if(session){ currentUser=session.user; await afterLogin(); }
  else { document.getElementById('pin-err').textContent='Session expired. Use email login.'; pinValue=''; updatePinDots(); }
}

function setupPin(){
  document.getElementById('new-pin-input').value='';
  document.getElementById('pin-setup-modal').classList.add('open');
}
function savePinSetup(){
  const v = document.getElementById('new-pin-input').value;
  if(!/^\d{4}$/.test(v)){ alert('PIN must be exactly 4 digits.'); return; }
  localStorage.setItem('cetara_pin', v);
  localStorage.setItem('cetara_pin_email', currentUser.email);
  closeModal('pin-setup-modal');
  alert('PIN saved. You can now use Quick Login on this device.');
}

// ══════════════════════════════════════
// AFTER LOGIN — ROUTE TO ONBOARDING OR DASHBOARD
// ══════════════════════════════════════
async function afterLogin(){
  showScreen('loading');

  let { data: user } = await sb.from('users').select('*').eq('email', currentUser.email).single();
  if(!user){
    const { data: newUser } = await sb.from('users').insert({ email: currentUser.email }).select().single();
    user = newUser;
  }

  let { data: brands } = await sb.from('brands').select('*').eq('user_id', user.id).order('created_at');
  if(!brands || !brands.length){
    const { data: newBrand } = await sb.from('brands').insert({ user_id: user.id, name:'My Brand', data:{} }).select().single();
    brands = [newBrand];
  }
  currentBrand = brands[0];

  const { data: entries } = await sb.from('entries').select('*').eq('brand_id', currentBrand.id).order('date',{ascending:false});
  allEntries = entries || [];

  // MANDATORY onboarding gate: brand_name + health_score must exist
  const b = currentBrand.data || {};
  if(!b.brand_name || !currentBrand.health_score){
    curSec=1; renderOBSidebar();
    showScreen('onboard');
  } else {
    launchDashboard();
  }
}

// ══════════════════════════════════════
// ONBOARDING STATE
// ══════════════════════════════════════
let curSec=1;
const TIPS=[
  'This is required once — it powers your health score, connections, and AI advisor.',
  'Revenue numbers let us calculate margins, run rates, and growth trends.',
  'COGS and fixed costs power your break-even and real net margin.',
  'Connect Shopify and Meta for live data, or skip and enter manually.',
  'Daily sales rate × lead time = your reorder point, calculated automatically.',
  'Your goals tell the AI advisor which problems to prioritize first.',
  'Last step — review and generate your score to enter the dashboard.'
];
const STEP_INFO=[
  {t:'Brand identity',d:'Name, industry, model'},
  {t:'Revenue & sales',d:'Numbers, AOV'},
  {t:'Costs & expenses',d:'COGS, fixed, cash'},
  {t:'Connections',d:'Shopify + Meta Ads'},
  {t:'Inventory & ops',d:'Stock, fulfillment'},
  {t:'Goals & context',d:'Targets, challenges'},
  {t:'Generate score',d:'Enter dashboard'},
];

function renderOBSidebar(){
  document.getElementById('ob-steps').innerHTML = STEP_INFO.map((s,i)=>{
    const n=i+1, done=n<curSec, active=n===curSec;
    return `<div class="ob-step ${done?'done':''} ${active?'active':''}" onclick="${done?`goSec(${n})`:''}">
      <div class="snum">${done?'✓':n}</div>
      <div><div class="stitle">${s.t}</div><div class="sdesc">${s.d}</div></div>
    </div>`;
  }).join('');
  const pct = Math.round((curSec-1)/7*100);
  document.getElementById('prog-fill').style.width=pct+'%';
  document.getElementById('prog-pct').textContent=`Step ${curSec} of 7`;
  document.getElementById('tip-txt').textContent=TIPS[curSec-1];
}

function goSec(n){
  // gate step 1 -> 2: must have brand name + industry + model
  document.getElementById('sec-'+curSec).classList.remove('active');
  curSec=n;
  document.getElementById('sec-'+curSec).classList.add('active');
  renderOBSidebar();
  document.querySelector('.ob-main').scrollTop=0;
}

function sf(k,v){
  if(!currentBrand.data) currentBrand.data={};
  currentBrand.data[k]=v;
  saveBrandData();
  if(k==='brand_name'){
    document.getElementById('next-1').disabled = !(currentBrand.data.brand_name && currentBrand.data.industry && currentBrand.data.model);
  }
}
function sr2(el,k,v){
  el.closest('.rc-grid').querySelectorAll('.rc').forEach(r=>r.classList.remove('sel'));
  el.classList.add('sel');
  sf(k,v);
  if(k==='industry'||k==='model'){
    document.getElementById('next-1').disabled = !(currentBrand.data.brand_name && currentBrand.data.industry && currentBrand.data.model);
  }
}
function tc(el,k){
  el.classList.toggle('on');
  if(!currentBrand.data) currentBrand.data={};
  currentBrand.data[k]=el.classList.contains('on');
  saveBrandData();
}

let saveTimeout=null;
function saveBrandData(){
  clearTimeout(saveTimeout);
  saveTimeout=setTimeout(async ()=>{
    await sb.from('brands').update({ data: currentBrand.data }).eq('id', currentBrand.id);
  }, 600);
}

// ══════════════════════════════════════
// SHOPIFY CONNECTION
// ══════════════════════════════════════
async function connectShopify(fromDash){
  const sfx = fromDash ? '-2' : '';
  const domain = document.getElementById('shopify-domain'+sfx).value.trim();
  const token = document.getElementById('shopify-token'+sfx).value.trim();
  if(!domain || !token){ alert('Enter both store domain and access token.'); return; }

  const dotIds = fromDash ? ['shopify-dot-2'] : ['shopify-dot'];
  const statusIds = fromDash ? ['shopify-status-2'] : ['shopify-status'];
  dotIds.forEach(id=>document.getElementById(id).className='sdot off');
  statusIds.forEach(id=>document.getElementById(id).textContent='Connecting…');

  const cleanDomain = domain.replace('https://','').replace('http://','').replace(/\/$/,'');
  const url = `https://${cleanDomain}/admin/api/2024-01/orders.json?status=any&limit=50`;

  try{
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': token } });
    if(!res.ok) throw new Error('Connection failed — check domain and token.');
    const json = await res.json();
    const orders = json.orders || [];
    const totalRev = orders.reduce((a,o)=>a+parseFloat(o.total_price||0),0);

    sf('shopify_connected', true);
    sf('shopify_domain', cleanDomain);
    sf('shopify_token', token);
    sf('shopify_order_count', orders.length);
    sf('shopify_revenue_synced', totalRev);

    if(fromDash){
      document.getElementById('shopify-dot-2').className='sdot on';
      document.getElementById('shopify-status-2').textContent='Connected';
      document.getElementById('shopify-domain-display').textContent=cleanDomain;
    } else {
      document.getElementById('shopify-dot').className='sdot on';
      document.getElementById('shopify-status').textContent='Connected';
    }
    alert(`Shopify connected. Synced ${orders.length} recent orders (EGP ${Math.round(totalRev).toLocaleString()}).`);
  }catch(err){
    dotIds.forEach(id=>document.getElementById(id).className='sdot err');
    statusIds.forEach(id=>document.getElementById(id).textContent='Failed');
    alert('Shopify connection error: '+err.message+'\n\nNote: Shopify blocks direct browser requests (CORS) for most stores — this works best via a backend proxy. For now, you can enter Shopify revenue manually using Add Entry.');
  }
}

// ══════════════════════════════════════
// META ADS CONNECTION
// ══════════════════════════════════════
async function connectMeta(fromDash){
  const sfx = fromDash ? '-2' : '';
  const acct = document.getElementById('meta-accid'+sfx).value.trim();
  const token = document.getElementById('meta-token'+sfx).value.trim();
  if(!acct || !token){ alert('Enter both Ad Account ID and Access Token.'); return; }

  const dotIds = fromDash ? ['meta-dot-2'] : ['meta-dot'];
  const statusIds = fromDash ? ['meta-status-2'] : ['meta-status'];
  statusIds.forEach(id=>document.getElementById(id).textContent='Connecting…');

  const accountId = acct.startsWith('act_') ? acct : 'act_'+acct;
  const url = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=spend,impressions,actions,action_values&date_preset=last_30d&access_token=${token}`;

  try{
    const res = await fetch(url);
    const json = await res.json();
    if(json.error) throw new Error(json.error.message);
    const d = json.data && json.data[0];
    if(!d) throw new Error('No data returned for the last 30 days.');

    const spend = parseFloat(d.spend)||0;
    const impr = parseInt(d.impressions)||0;
    const purchases = (d.actions||[]).find(a=>a.action_type==='purchase');
    const revenue = (d.action_values||[]).find(a=>a.action_type==='purchase');
    const orders = purchases ? parseInt(purchases.value)||0 : 0;
    const rev = revenue ? parseFloat(revenue.value)||0 : 0;

    sf('meta_connected', true);
    sf('meta_account_id', accountId);
    sf('meta_token', token);
    sf('ads_spend', spend);
    sf('ads_rev', rev);
    sf('ads_orders', orders);
    sf('meta_impr', impr);

    if(fromDash){
      document.getElementById('meta-dot-2').className='sdot on';
      document.getElementById('meta-status-2').textContent='Connected';
      document.getElementById('meta-acc-display').textContent=accountId;
    } else {
      document.getElementById('meta-dot').className='sdot on';
      document.getElementById('meta-status').textContent='Connected';
    }
    alert(`Meta Ads connected. Spend: EGP ${spend.toLocaleString()} · ROAS: ${spend>0?(rev/spend).toFixed(2):'—'}x`);
  }catch(err){
    dotIds.forEach(id=>document.getElementById(id).className='sdot err');
    statusIds.forEach(id=>document.getElementById(id).textContent='Failed');
    alert('Meta API Error: '+err.message+'\n\nCheck: token is valid, account ID format is act_XXXXXXX, permissions include ads_read and read_insights.');
  }
}

// ══════════════════════════════════════
// HEALTH SCORE ENGINE
// ══════════════════════════════════════
async function generateScore(){
  const b = currentBrand.data || {};
  const btn=document.getElementById('gen-btn');
  btn.textContent='Calculating…'; btn.disabled=true;

  setTimeout(async ()=>{
    const rev=parseFloat(b.rev_now)||0;
    const prevRev=parseFloat(b.rev_prev)||rev;
    const cogs=parseFloat(b.cogs_month)||0;
    const fc=(parseFloat(b.rent)||0)+(parseFloat(b.salaries)||0)+(parseFloat(b.software)||0);
    const spend=parseFloat(b.ads_spend)||0;
    const adsRev=parseFloat(b.ads_rev)||0;
    const stock=parseFloat(b.stock)||0;
    const rate=parseFloat(b.daily_rate)||1;

    const netProfit=rev-cogs-fc-spend;
    const nm=rev>0?(netProfit/rev)*100:0;
    const nmS=Math.min(100,Math.max(0,nm>30?100:nm>20?80:nm>10?60:nm>0?40:nm>-10?20:0));

    const roas=(spend>0&&adsRev>0)?adsRev/spend:0;
    const roasS=Math.min(100,Math.max(0,roas>=4?100:roas>=3?80:roas>=2?60:roas>=1.5?40:roas>=1?20:0));

    const growth=prevRev>0?((rev-prevRev)/prevRev)*100:0;
    const grS=Math.min(100,Math.max(0,growth>=30?100:growth>=15?80:growth>=5?65:growth>=0?50:growth>=-10?30:10));

    const daysLeft=rate>0?stock/rate:0;
    const srS=Math.min(100,Math.max(0,daysLeft>=30?100:daysLeft>=21?80:daysLeft>=14?60:daysLeft>=7?40:daysLeft>=3?20:0));

    const hs=Math.round(nmS*0.35+roasS*0.30+grS*0.20+srS*0.15);
    const STATES=[['Critical','#ff4757',0,39],['Struggling','#ff8c00',40,54],['Stable','#ffc048',55,69],['Growing','#4dabff',70,84],['Thriving','#00e67a',85,100]];
    const st=STATES.find(s=>hs>=s[2]&&hs<=s[3]);

    const issues=[];
    if(nmS<60) issues.push({title:'Improve net margin',sub:`Current margin is ${nm.toFixed(1)}%. Target 25%+ by reducing COGS or raising prices.`,impact:'high'});
    if(roasS<60 && spend>0) issues.push({title:'Optimize ad campaigns',sub:`ROAS of ${roas.toFixed(1)}x is below target 3x. Test new creatives and tighten audience.`,impact:'high'});
    if(grS<50) issues.push({title:'Fix revenue consistency',sub:'Month-over-month growth is flat or negative. Launch a reactivation campaign.',impact:'med'});
    if(srS<60 && stock>0) issues.push({title:'Restock urgently',sub:`Only ${Math.round(daysLeft)} days of stock remaining.`,impact:'high'});
    if(!issues.length) issues.push({title:'Maintain performance',sub:'Your brand is healthy. Focus on scaling what already works.',impact:'med'});

    currentBrand.health_score = hs;
    currentBrand.brand_state = st[0];
    await sb.from('brands').update({ data: currentBrand.data, health_score: hs, brand_state: st[0] }).eq('id', currentBrand.id);

    const card=document.getElementById('score-card');
    card.style.display='block';
    const sn=document.getElementById('score-num');
    sn.textContent=hs; sn.style.color=st[1];
    const sb_=document.getElementById('score-state-badge');
    sb_.textContent=st[0]; sb_.style.color=st[1]; sb_.style.background=st[1]+'20'; sb_.style.borderColor=st[1]+'40';
    document.getElementById('action-list').innerHTML=issues.map((item,i)=>`
      <div class="action-item">
        <div class="action-num">${i+1}</div>
        <div style="flex:1"><div class="action-title">${item.title}</div><div class="action-sub">${item.sub}</div></div>
        <span class="action-impact ${item.impact}">${item.impact.toUpperCase()}</span>
      </div>`).join('');

    btn.textContent='✓ Enter Dashboard →';
    btn.disabled=false;
    btn.onclick=()=>launchDashboard();
    card.scrollIntoView({behavior:'smooth'});
  },900);
}

// ══════════════════════════════════════
// LAUNCH DASHBOARD
// ══════════════════════════════════════
function launchDashboard(){
  const b = currentBrand.data || {};
  document.getElementById('dn-bname').textContent=b.brand_name||'Brand';
  document.getElementById('dn-btype').textContent=b.industry||'—';
  document.getElementById('dash-uname').textContent=currentUser.email;
  document.getElementById('dash-avatar').textContent=(b.brand_name||currentUser.email||'U')[0].toUpperCase();

  if(currentBrand.health_score){
    document.getElementById('hs-banner').style.display='flex';
    document.getElementById('hs-num').textContent=currentBrand.health_score;
    document.getElementById('hs-state').textContent=currentBrand.brand_state+' — Brand Health Score';
    document.getElementById('hs-sub').textContent='Tap "Ask AI Advisor" for a deeper analysis.';
  }

  document.getElementById('set-bname').textContent=b.brand_name||'—';
  document.getElementById('set-ind').textContent=b.industry||'—';
  document.getElementById('set-mod').textContent=b.model||'—';
  document.getElementById('set-goal').textContent=b.goal||'—';
  document.getElementById('set-email').textContent=currentUser.email;

  if(b.shopify_connected){
    document.getElementById('shopify-dot-2').className='sdot on';
    document.getElementById('shopify-status-2').textContent='Connected';
    document.getElementById('shopify-domain-display').textContent=b.shopify_domain;
  }
  if(b.meta_connected){
    document.getElementById('meta-dot-2').className='sdot on';
    document.getElementById('meta-status-2').textContent='Connected';
    document.getElementById('meta-acc-display').textContent=b.meta_account_id;
  }

  renderDashboardKPIs();
  showScreen('app');
}

// ══════════════════════════════════════
// DASHBOARD NAV & RENDER
// ══════════════════════════════════════
function navTo(page, el, mobile){
  const navClass = mobile ? '.mn-item' : '.ni';
  document.querySelectorAll('.ni, .mn-item').forEach(n=>n.classList.remove('active'));
  document.querySelectorAll(navClass).forEach(n=>{ if(n===el) n.classList.add('active'); });
  // sync the other nav set too
  document.querySelectorAll('.ni').forEach(n=>{ if(n.getAttribute('onclick')&&n.getAttribute('onclick').includes(`'${page}'`)) n.classList.add('active'); });
  document.querySelectorAll('.mn-item').forEach(n=>{ if(n.getAttribute('onclick')&&n.getAttribute('onclick').includes(`'${page}'`)) n.classList.add('active'); });

  document.querySelectorAll('.dpage').forEach(p=>p.classList.remove('active'));
  document.getElementById('dp-'+page).classList.add('active');
  const titles={dashboard:'Dashboard',expenses:'Expenses',revenues:'Revenues',pnl:'P&L Report',connections:'Connections',inventory:'Inventory',history:'History',settings:'Settings'};
  document.getElementById('page-ttl').textContent=titles[page]||page;
  curPage=page;
  if(page==='dashboard') renderDashboardKPIs();
  if(page==='expenses') renderExpenses();
  if(page==='revenues') renderRevenues();
  if(page==='pnl') renderPnl();
  if(page==='inventory') renderInventory();
  if(page==='history') renderHistory();
}

const fmtEGP=(n)=>'EGP '+Math.round(n).toLocaleString();

function renderDashboardKPIs(){
  const exps=allEntries.filter(e=>e.type==='expense');
  const revs=allEntries.filter(e=>e.type==='revenue');
  const totalRev=revs.reduce((a,e)=>a+ +e.amount,0);
  const totalExp=exps.reduce((a,e)=>a+ +e.amount,0);
  const net=totalRev-totalExp;
  const margin=totalRev>0?Math.round(net/totalRev*100):0;
  document.getElementById('d-rev').textContent=fmtEGP(totalRev);
  document.getElementById('d-exp').textContent=fmtEGP(totalExp);
  document.getElementById('d-profit').textContent=(net>=0?'+':'')+fmtEGP(net);
  document.getElementById('d-margin').textContent=margin+'%';
  document.getElementById('exp-badge').textContent=exps.length;

  const ibox=document.getElementById('insights-box');
  const insights=[];
  if(totalRev>0) insights.push(`<div class="ins ${margin>20?'g':margin>0?'y':'r'}"><div class="ins-lbl">${margin>20?'● Profitable':margin>0?'⚠ Low margin':'✕ Losing money'}</div><div class="ins-txt">${margin}% net margin</div><div class="ins-sub">Revenue ${fmtEGP(totalRev)} · Expenses ${fmtEGP(totalExp)}</div></div>`);
  else insights.push(`<div class="ins y"><div class="ins-lbl">ℹ No entries yet</div><div class="ins-txt">Add your first revenue and expense entries.</div></div>`);
  const cats={}; exps.forEach(e=>{cats[e.category]=(cats[e.category]||0)+ +e.amount;});
  const topCat=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  if(topCat) insights.push(`<div class="ins r"><div class="ins-lbl">● Top Spend</div><div class="ins-txt">${topCat[0]} — ${Math.round(topCat[1]/totalExp*100)}%</div><div class="ins-sub">EGP ${topCat[1].toLocaleString()}</div></div>`);
  if(currentBrand.health_score) insights.push(`<div class="ins ${currentBrand.health_score>=70?'g':'y'}"><div class="ins-lbl">● Health Score</div><div class="ins-txt">${currentBrand.health_score}/100 — ${currentBrand.brand_state}</div></div>`);
  ibox.innerHTML=insights.join('');

  document.getElementById('recent-tbody').innerHTML=allEntries.slice(0,8).map(e=>`
    <tr><td style="color:var(--t2)">${e.date||'—'}</td><td>${e.description||'—'}</td><td><span class="tag ${e.type==='expense'?'r':'g'}">${e.type}</span></td><td class="${e.type==='expense'?'an':'ap'}">${e.type==='expense'?'-':'+'}${fmtEGP(+e.amount)}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--t3)">No entries yet</td></tr>';

  setTimeout(()=>{
    const months=['Jan','Feb','Mar','Apr','May','Jun'];
    const mRevs=months.map((_,i)=>revs.filter(e=>e.date&&new Date(e.date).getMonth()===i).reduce((a,e)=>a+ +e.amount,0));
    const mExps=months.map((_,i)=>exps.filter(e=>e.date&&new Date(e.date).getMonth()===i).reduce((a,e)=>a+ +e.amount,0));
    mkChart('ch-revexp','bar',{labels:months,datasets:[
      {label:'Revenue',data:mRevs,backgroundColor:'rgba(0,230,122,.65)',borderRadius:4},
      {label:'Expenses',data:mExps,backgroundColor:'rgba(255,71,87,.5)',borderRadius:4}
    ]},{plugins:{legend:{display:true,labels:{color:'#888',font:{family:'DM Sans',size:11}}}}});
  },80);
}

function renderExpenses(){
  const exps=allEntries.filter(e=>e.type==='expense');
  const total=exps.reduce((a,e)=>a+ +e.amount,0);
  document.getElementById('e-total').textContent=fmtEGP(total);
  document.getElementById('e-avg').textContent=fmtEGP(exps.length?total/Math.max(1,new Set(exps.map(e=>e.date?.slice(0,7))).size):0);
  document.getElementById('e-count').textContent=exps.length;
  const cats={};exps.forEach(e=>{cats[e.category]=(cats[e.category]||0)+ +e.amount;});
  const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('e-top').textContent=top?top[0]:'—';
  document.getElementById('exp-tbody').innerHTML=exps.sort((a,b)=>b.date>a.date?1:-1).map(e=>`
    <tr><td style="color:var(--t2)">${e.date}</td><td>${e.description}</td><td><span class="tag r">${e.category}</span></td><td class="an">-${fmtEGP(+e.amount)}</td><td><span style="cursor:pointer;color:var(--t3)" onclick="delEntry('${e.id}')">✕</span></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--t3)">No expenses yet</td></tr>';
}
function renderRevenues(){
  const revs=allEntries.filter(e=>e.type==='revenue');
  const total=revs.reduce((a,e)=>a+ +e.amount,0);
  document.getElementById('r-total').textContent=fmtEGP(total);
  document.getElementById('r-avg').textContent=fmtEGP(revs.length?total/Math.max(1,new Set(revs.map(e=>e.date?.slice(0,7))).size):0);
  document.getElementById('r-count').textContent=revs.length;
  const cats={};revs.forEach(e=>{cats[e.category]=(cats[e.category]||0)+ +e.amount;});
  const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  document.getElementById('r-top').textContent=top?top[0]:'—';
  document.getElementById('rev-tbody').innerHTML=revs.sort((a,b)=>b.date>a.date?1:-1).map(e=>`
    <tr><td style="color:var(--t2)">${e.date}</td><td>${e.description}</td><td><span class="tag g">${e.category}</span></td><td class="ap">+${fmtEGP(+e.amount)}</td><td><span style="cursor:pointer;color:var(--t3)" onclick="delEntry('${e.id}')">✕</span></td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--t3)">No revenues yet</td></tr>';
}
function renderPnl(){
  const exps=allEntries.filter(e=>e.type==='expense');
  const revs=allEntries.filter(e=>e.type==='revenue');
  const rev=revs.reduce((a,e)=>a+ +e.amount,0);
  const exp=exps.reduce((a,e)=>a+ +e.amount,0);
  const net=rev-exp;
  const gm=rev>0?Math.round(net/rev*100):0;
  document.getElementById('pnl-rev').textContent=fmtEGP(rev);
  document.getElementById('pnl-exp').textContent=fmtEGP(exp);
  document.getElementById('pnl-net').textContent=(net>=0?'+':'')+fmtEGP(net);
  document.getElementById('pnl-margin').textContent=gm+'%';
  document.getElementById('pnl-statement').innerHTML=`
    <div class="sr"><span class="sr-k">Total Revenue</span><span class="sr-v ap">+${fmtEGP(rev)}</span></div>
    <div class="sr"><span class="sr-k">Total Expenses</span><span class="sr-v an">-${fmtEGP(exp)}</span></div>
    <div class="sr" style="background:var(--gd);border-radius:6px;padding:8px 10px;margin-top:6px;"><span class="sr-k" style="color:var(--gr);font-weight:600;">NET PROFIT</span><span class="sr-v ap" style="font-size:16px;font-weight:600;">${net>=0?'+':''}${fmtEGP(net)}</span></div>`;
}
function renderInventory(){
  const b=currentBrand.data||{};
  const stock=parseFloat(b.stock)||0;
  const rate=parseFloat(b.daily_rate)||1;
  const lead=parseFloat(b.lead_time)||14;
  const daysLeft=rate>0?Math.round(stock/rate):0;
  const reorderAt=Math.round(rate*lead);
  document.getElementById('inv-skus').textContent=b.skus||'—';
  document.getElementById('inv-days').textContent=daysLeft?daysLeft+' days':'—';
  document.getElementById('inv-reorder').textContent=reorderAt+' units';
  const alerts=[];
  if(daysLeft<7) alerts.push(`<div class="ins r"><div class="ins-lbl">✕ Critical — ${daysLeft} days left</div><div class="ins-txt">Restock immediately.</div></div>`);
  else if(daysLeft<lead+5) alerts.push(`<div class="ins y"><div class="ins-lbl">⚠ Low stock — ${daysLeft} days left</div><div class="ins-txt">Trigger reorder now. Lead time ${lead} days.</div></div>`);
  else alerts.push(`<div class="ins g"><div class="ins-lbl">● Stock healthy — ${daysLeft} days remaining</div><div class="ins-txt">Reorder at ${reorderAt} units.</div></div>`);
  document.getElementById('inv-alerts').innerHTML=alerts.join('');
}
function renderHistory(){
  const all=[...allEntries].sort((a,b)=>b.date>a.date?1:-1);
  document.getElementById('hist-count').textContent=all.length+' entries';
  document.getElementById('hist-tbody').innerHTML=all.map(e=>`
    <tr><td style="color:var(--t2)">${e.date}</td><td><span class="tag ${e.type==='expense'?'r':'g'}">${e.type}</span></td><td>${e.description}</td><td><span class="tag gray">${e.category}</span></td><td class="${e.type==='expense'?'an':'ap'}">${e.type==='expense'?'-':'+'}${fmtEGP(+e.amount)}</td><td><span style="cursor:pointer;color:var(--t3)" onclick="delEntry('${e.id}')">✕</span></td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--t3)">No entries yet</td></tr>';
}

// ══════════════════════════════════════
// ENTRY CRUD
// ══════════════════════════════════════
function openAddModal(type){
  document.getElementById('add-modal').classList.add('open');
  document.getElementById('ent-date').value=new Date().toISOString().split('T')[0];
  if(type) document.getElementById('ent-type').value=type;
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded',()=>{
  ['add-modal','ai-modal','pin-setup-modal'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('click',function(e){ if(e.target===this) closeModal(id); });
  });
});

async function saveEntry(){
  const type=document.getElementById('ent-type').value;
  const date=document.getElementById('ent-date').value;
  const description=document.getElementById('ent-desc').value.trim();
  const category=document.getElementById('ent-cat').value;
  const amount=parseFloat(document.getElementById('ent-amt').value)||0;
  const notes=document.getElementById('ent-notes').value.trim();
  if(!description||!amount){alert('Fill description and amount.');return;}
  const { data, error } = await sb.from('entries').insert({brand_id:currentBrand.id,type,date,description,category,amount,notes}).select().single();
  if(error){alert('Error: '+error.message);return;}
  allEntries.unshift(data);
  closeModal('add-modal');
  document.getElementById('ent-desc').value='';
  document.getElementById('ent-amt').value='';
  document.getElementById('ent-notes').value='';
  navTo(curPage, document.querySelector(`.ni[onclick*="'${curPage}'"]`) || document.querySelector('.ni.active'));
}
async function delEntry(id){
  if(!confirm('Delete this entry?'))return;
  await sb.from('entries').delete().eq('id',id);
  allEntries=allEntries.filter(e=>e.id!==id);
  navTo(curPage, document.querySelector('.ni.active'));
}

// ══════════════════════════════════════
// CHARTS
// ══════════════════════════════════════
const CGRID={color:'rgba(255,255,255,0.04)',drawBorder:false};
const CTICK={color:'#555',font:{family:'JetBrains Mono',size:10}};
const BASE_OPTS={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{backgroundColor:'#1f1f1f',borderColor:'#333',borderWidth:1}},scales:{x:{grid:CGRID,ticks:CTICK,border:{display:false}},y:{grid:CGRID,ticks:CTICK,border:{display:false}}}};
function mkChart(id,type,data,extra={}){
  const c=document.getElementById(id); if(!c)return;
  if(charts[id])charts[id].destroy();
  charts[id]=new Chart(c,{type,data,options:{...BASE_OPTS,...extra,plugins:{...BASE_OPTS.plugins,...(extra.plugins||{})}}});
}

// ══════════════════════════════════════
// AI ADVISOR — CLAUDE API
// ══════════════════════════════════════
let aiHistory=[];

function openAiModal(){
  document.getElementById('ai-modal').classList.add('open');
  if(!aiHistory.length){
    addAiMsg('bot', `Hi! I'm your AI Advisor. I can see your brand's financial data, ads performance, and inventory. Ask me anything — like "what's holding back my margin?" or "should I scale my ads?"`);
  }
}
function addAiMsg(role,text){
  const box=document.getElementById('ai-msgs');
  const div=document.createElement('div');
  div.className='ai-msg '+role;
  div.textContent=text;
  box.appendChild(div);
  box.scrollTop=box.scrollHeight;
}
function aiAsk(q){
  document.getElementById('ai-input').value=q;
  aiSend();
}
async function aiSend(){
  const input=document.getElementById('ai-input');
  const q=input.value.trim();
  if(!q) return;
  input.value='';
  addAiMsg('user',q);
  aiHistory.push({role:'user',content:q});

  const box=document.getElementById('ai-msgs');
  const typing=document.createElement('div');
  typing.className='ai-msg bot';
  typing.innerHTML='<div class="ai-typing"><span></span><span></span><span></span></div>';
  box.appendChild(typing);
  box.scrollTop=box.scrollHeight;

  const b=currentBrand.data||{};
  const exps=allEntries.filter(e=>e.type==='expense');
  const revs=allEntries.filter(e=>e.type==='revenue');
  const totalRev=revs.reduce((a,e)=>a+ +e.amount,0);
  const totalExp=exps.reduce((a,e)=>a+ +e.amount,0);

  const contextSummary=`Brand: ${b.brand_name||'Unknown'} | Industry: ${b.industry||'—'} | Sales model: ${b.model||'—'} | Goal: ${b.goal||'—'}
Health Score: ${currentBrand.health_score||'—'}/100 (${currentBrand.brand_state||'—'})
Revenue this month: EGP ${b.rev_now||0} | Last month: EGP ${b.rev_prev||0}
COGS: EGP ${b.cogs_month||0} | Fixed costs: rent ${b.rent||0}, salaries ${b.salaries||0}, software ${b.software||0}
Ads: spend EGP ${b.ads_spend||0}, revenue from ads EGP ${b.ads_rev||0}, ROAS ${b.ads_spend>0?(b.ads_rev/b.ads_spend).toFixed(2):'—'}x
Inventory: ${b.stock||0} units, selling ${b.daily_rate||0}/day, lead time ${b.lead_time||0} days
Logged entries — total revenue: EGP ${totalRev}, total expenses: EGP ${totalExp}, net: EGP ${totalRev-totalExp}
Known challenges: ${[b.prob_cpa&&'high CPA',b.prob_margin&&'low margin',b.prob_cancel&&'high cancel rate',b.prob_stock&&'stock issues'].filter(Boolean).join(', ')||'none flagged'}
Notes: ${b.notes||'none'}`;

  try{
    const resp = await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-6',
        max_tokens:700,
        system:`You are CETARA's AI Brand Advisor — a sharp, direct financial and growth advisor for e-commerce brand owners in MENA. You have access to this brand's real data below. Be concise, concrete, and actionable. Use specific numbers from the data. Format with short paragraphs or bullet points, no markdown headers. Never invent data not given to you — if something is missing, say so and tell them what to add.\n\nBRAND DATA:\n${contextSummary}`,
        messages:[...aiHistory]
      })
    });
    const data = await resp.json();
    typing.remove();
    let reply = '';
    if(data.content){
      reply = data.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
    } else if(data.error){
      reply = 'AI Advisor is temporarily unavailable: '+(data.error.message||'unknown error');
    } else {
      reply = 'Sorry, I could not generate a response right now.';
    }
    addAiMsg('bot',reply);
    aiHistory.push({role:'assistant',content:reply});
  }catch(err){
    typing.remove();
    addAiMsg('bot','Connection error reaching AI Advisor: '+err.message);
  }
}

// ══════════════════════════════════════
// EXPORT
// ══════════════════════════════════════
function exportData(){
  const blob=new Blob([JSON.stringify({brand:currentBrand,entries:allEntries},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='cetara-export.json';a.click();
}

// ══════════════════════════════════════
// START
// ══════════════════════════════════════
init();
