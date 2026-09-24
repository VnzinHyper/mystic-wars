// MysticWars — DB compartilhado Loja + Staff
const DB_KEY = 'kaizen_db_v1';
const KCDN = (id)=>`https://kaizenmc.gg/cdn/stores/9644/packages/${id}.png`;
function defaultDB(){ return {
 settings:{
  storeName:'MysticWars',
  banner:'PROMOÇÃO RELAMPAGO!',
  heroTitle:'Conheça a nossa loja online!',
  heroSub:'Nos destacamos como a referência no mercado, oferecendo uma ampla variedade de produtos com preços competitivos e qualidade incomparável.',
  heroImg:'https://kaizenmc.gg/cdn/stores/9644/template_options/6a28268b-f9e7-4aa0-b321-ccb9a0b7572a.png',
  logo:'logo.png',
  discord:'https://discord.gg/kaizenmc',
  instagram:'https://www.instagram.com/redekaizenmc/',
  twitter:'https://x.com/RedeKaizenMC',
  youtube:'https://www.youtube.com/@RedeKaizenMC',
  tiktok:'https://www.tiktok.com/@redekaizenmc',
  whatsapp:'',
  pixKey:'seu-pix@mysticwars.gg', pixName:'MYSTICWARS', pixCity:'BRASIL',
  autoConfirmUrl:'',
  supportEmail:'suporte@mysticwars.gg', phone:'',
  cnpj:'© 2026 - MysticWars. Todos os direitos reservados.',
  primary:'#8b5cf6', secondary:'#22d3ee',
  rating:'4,9'
 },
 commissions:{steam:30, assinaturas:15, outros:12},
 categories:[],
 products:[
  {id:'prime-1',name:'PRIME - 1 MÊS',cat:'prime',price:29.99,old:29.99,emoji:'👑',img:KCDN('6996dc08-8d09-4c12-9a34-87bee4b84c42'),stock:100,delivery:'Automática',desc:'VIP Prime por 30 dias no servidor.'},
  {id:'prime-3',name:'PRIME - 3 MESES',cat:'prime',price:49.99,old:89.99,emoji:'👑',img:KCDN('e1c77132-9b55-41c2-8c20-76b59e0673ac'),stock:100,delivery:'Automática',desc:'VIP Prime por 90 dias. Economize 44%.'},
  {id:'prime-6',name:'PRIME - 6 MESES',cat:'prime',price:79.99,old:179.99,emoji:'👑',img:KCDN('055994f4-d597-4b9b-8e9c-b89fe7bd87b8'),stock:100,delivery:'Automática',desc:'VIP Prime por 180 dias. Economize 56%.'},
  {id:'prime-12',name:'PRIME - 12 MESES',cat:'prime',price:129.99,old:359.99,emoji:'👑',img:KCDN('c1d9d72d-7ae7-4cec-9e89-e4b465903ab3'),stock:100,delivery:'Automática',desc:'VIP Prime por 1 ano. Economize 64%.'}
 ],
 coupons:[{code:'MYSTIC10',percent:10}],
 orders:[], users:[], tickets:[], withdrawals:[], clicks:[],
 _v:2,
 reviews:[
  {n:'Pedro H.',d:'20/09/2026',t:'Ativou na hora, recomendo',p:'PRIME - 1 MÊS'},
  {n:'Lucas M.',d:'18/09/2026',t:'Melhor custo-benefício o anual',p:'PRIME - 12 MESES'},
  {n:'Gabi',d:'15/09/2026',t:'Suporte respondeu rapidinho',p:'PRIME - 3 MESES'}
 ]
}}
const Store = {
 load(){
  try{
   const r=localStorage.getItem(DB_KEY);
   if(r){ const db=JSON.parse(r);
    db.users=db.users||[]; db.tickets=db.tickets||[]; db.withdrawals=db.withdrawals||[]; db.clicks=db.clicks||[];
    db.settings.pixCity=db.settings.pixCity||'BRASIL';
    db.settings.pixName=db.settings.pixName||'MYSTICWARS';
    // renomeação KaizenMC → MysticWars (só onde ainda está o padrão antigo)
    if(db.settings.storeName==='KaizenMC') db.settings.storeName='MysticWars';
    if(db.settings.pixName==='KAIZENMC') db.settings.pixName='MYSTICWARS';
    if(db.settings.pixKey==='seu-pix@kaizenmc.gg') db.settings.pixKey='seu-pix@mysticwars.gg';
    if(db.settings.supportEmail==='suporte@kaizenmc.gg') db.settings.supportEmail='suporte@mysticwars.gg';
    if(typeof db.settings.cnpj==='string'&&db.settings.cnpj.includes('KaizenMC')) db.settings.cnpj=db.settings.cnpj.replace(/KaizenMC/g,'MysticWars');
    if(db.settings.logo&&db.settings.logo.includes('kaizenmc.gg')) db.settings.logo='logo.png';
    if(db.coupons.find(c=>c.code==='KAIZEN10')&&!db.coupons.find(c=>c.code==='MYSTIC10')) db.coupons.find(c=>c.code==='KAIZEN10').code='MYSTIC10';
    if(db.settings.autoConfirmUrl===undefined) db.settings.autoConfirmUrl='';
    // limpeza única v2: remove as categorias que vinham com o site (dono cria as próprias)
    if(db._v!==2){ const SEED=['prime','ranks','medalhas','outros']; db.categories=(db.categories||[]).filter(c=>!SEED.includes(c.id)); db._v=2; }
    const d=defaultDB();
    d.categories.forEach(c=>{ if(!db.categories.find(x=>x.id===c.id)) db.categories.push(c); });
    if(!db.coupons) db.coupons=d.coupons;
    if(!db.reviews) db.reviews=d.reviews;
    if(!db.commissions) db.commissions=d.commissions;
    localStorage.setItem(DB_KEY,JSON.stringify(db));
    return db;
   }
  }catch(e){}
  const d=defaultDB(); localStorage.setItem(DB_KEY,JSON.stringify(d)); return d;
 },
 save(db){ localStorage.setItem(DB_KEY,JSON.stringify(db)); if(Store.mode==='staff') Store.pushRemote(); },
 reset(){ localStorage.removeItem(DB_KEY); return this.load(); }
};

// ===== BACKEND COMPARTILHADO (Vercel + Upstash) =====
const SITE_ID='mystic';
const API='/api/store';
const PUB='/api/public';
let remoteOnline=false, pushTimer=null, inFlight=false, queued=false;

async function sha256hex(text){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashSenha(senha){ return await sha256hex(SITE_ID+'::'+senha); }
function passHashSalvo(){ return localStorage.getItem(DB_KEY+'_hash')||''; }

Object.assign(Store,{
 mode:'client',
 get online(){ return remoteOnline; },

 async apiGet(){
  const r=await fetch(API+'?site='+SITE_ID,{cache:'no-store'});
  const j=await r.json();
  if(!r.ok||!j.ok) throw new Error(j.error||('http '+r.status));
  return j.data;
 },
 async apiPut(data,passHash){
  const r=await fetch(API+'?site='+SITE_ID,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({passHash,data})});
  const j=await r.json();
  if(!r.ok||!j.ok) throw new Error(j.error||('http '+r.status));
  return j;
 },
 async apiAuth(passHash){
  const r=await fetch(API+'?site='+SITE_ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({passHash})});
  const j=await r.json();
  if(!r.ok) throw new Error(j.error||('http '+r.status));
  return j;
 },
 async pub(body){
  const r=await fetch(PUB+'?site='+SITE_ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();
  if(!r.ok||!j.ok) throw new Error(j.error||('http '+r.status));
  return j;
 },

 async hydrate(){
  try{
   const remoto=await this.apiGet();
   remoteOnline=true;
   if(remoto&&Array.isArray(remoto.products)){
    localStorage.setItem(DB_KEY,JSON.stringify(remoto));
    localStorage.setItem(DB_KEY+'_sync','1');
   }
   return true;
  }catch(e){ remoteOnline=false; return false; }
 },

 async pushRemote(){
  if(remoteOnline===false) return false;
  const passHash=passHashSalvo();
  if(!passHash) return false;
  if(inFlight){ queued=true; return false; }
  inFlight=true;
  try{
   const db=Store.load();
   delete db.passHash;
   await this.apiPut(db,passHash);
   remoteOnline=true;
  }catch(e){
   if(/Senha incorreta/.test(e.message||'')) remoteOnline=false;
  }finally{
   inFlight=false;
   if(queued){ queued=false; setTimeout(()=>Store.pushRemote(),1200); }
  }
  return true;
 },
 pushSoon(){ if(remoteOnline) setTimeout(()=>Store.pushRemote(),700); },

 async setSenha(senha){
  const h=await hashSenha(senha);
  localStorage.setItem(DB_KEY+'_hash',h);
  return h;
 }
});
// === PIX BR Code real (EMVCo) ===
function pixCRC16(s){let crc=0xFFFF;for(let i=0;i<s.length;i++){crc^=s.charCodeAt(i)<<8;for(let j=0;j<8;j++){crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF}}return crc.toString(16).toUpperCase().padStart(4,'0')}
function tlv(id,v){return id+String(v.length).padStart(2,'0')+v}
function genPixCode(key,name,city,amount,txid){
 key=String(key||'').trim(); name=String(name||'MYSTIC').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,25)||'MYSTIC';
 city=String(city||'BRASIL').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,15)||'BRASIL';
 txid=String(txid||'MYSTIC').replace(/[^a-zA-Z0-9]/g,'').slice(0,20)||'MYSTIC';
 const gui=tlv('00','br.gov.bcb.pix')+tlv('01',key);
 let p=tlv('00','01')+tlv('26',gui)+tlv('52','0000')+tlv('53','986')+(amount>0?tlv('54',Number(amount).toFixed(2)):'')+tlv('58','BR')+tlv('59',name)+tlv('60',city)+tlv('62',tlv('05',txid))+tlv('63','04');
 return p+pixCRC16(p+'6304');
}
// Modelos para o staff recomeçar o catálogo em 1 clique
function sampleProducts(){ return defaultDB().products.map(p=>({...p})); }
