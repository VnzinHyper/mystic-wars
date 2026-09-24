// Legend Store — DB compartilhado Loja + Staff (v2 completo)
const DB_KEY = 'kaizen_db_v1';
const DEFAULT_IMG = (id)=>`https://nexosystem.site/cdn/stores/21101/packages/${id}.png`;
function defaultDB(){ return {
 settings:{
  storeName:'Legend Store',
  banner:'🎮 ENTRE NA COMUNIDADE DA LEGEND E RECEBA OFERTAS!',
  discord:'https://discord.gg/HbH4bSktez',
  instagram:'https://www.instagram.com/nexossystem/',
  whatsapp:'', pixKey:'seu-pix@legendstore.site', pixName:'LEGEND STORE', pixCity:'FORTALEZA',
  autoConfirmUrl:'',
  supportEmail:'suporte@legendstore.site', phone:'',
  cnpj:'',
  primary:'#7c5cff', secondary:'#00d4ff',
  heroTitle:'Bem-vindo(a) à',
  heroSub:'Produtos digitais selecionados, pagamento seguro e entrega sem enrolação.',
  rating:'4,6'
 },
 commissions:{steam:30, assinaturas:15, outros:12},
 categories:[],
 products:[],
 coupons:[{code:'LEGEND10',percent:10}],
 orders:[], users:[], tickets:[], withdrawals:[], clicks:[],
 _v:3,
 reviews:[
  {n:'Luciano Dos Santos',d:'20/09/2026',t:'Entrega rápida',p:'Minecraft Java & Bedrock'},
  {n:'Thiago Oliveira',d:'19/09/2026',t:'Muito bom',p:'Game Pass Ultimate 30 Dias'},
  {n:'Maria Zelandia',d:'11/09/2026',t:'Muito bom, Entrega rápida, Confiável',p:'Game Pass Ultimate'},
  {n:'Luiz Oliveira',d:'05/09/2026',t:'Pode comprar sem medo. Chega de vdd',p:'GTA V'},
  {n:'Ivan Da Silva',d:'04/09/2026',t:'Confiável',p:'Disney Plus - 30 dias'}
 ]
}}
const Store = {
 load(){
  try{
   const r=localStorage.getItem(DB_KEY);
   if(r){ const db=JSON.parse(r);
    const OLD=['https://discord.com/invite/nexosystem','https://discord.gg/nexosystem'];
    if(db.settings&&OLD.includes(db.settings.discord)) db.settings.discord='https://discord.gg/HbH4bSktez';
    // renomeação: Nexos System → Legend Store (só onde ainda está o padrão antigo)
    if(db.settings.storeName==='Nexos System') db.settings.storeName='Legend Store';
    if(db.settings.banner==='🎮 ENTRE NA COMUNIDADE DA NEXOS E RECEBA OFERTAS!') db.settings.banner='🎮 ENTRE NA COMUNIDADE DA LEGEND E RECEBA OFERTAS!';
    if(db.settings.pixName==='NEXOS SYSTEM') db.settings.pixName='LEGEND STORE';
    if(db.settings.pixKey==='seu-pix@nexosystem.site') db.settings.pixKey='seu-pix@legendstore.site';
    if(db.settings.supportEmail==='suporte@nexosystem.site') db.settings.supportEmail='suporte@legendstore.site';
    // remove dados da empresa que ainda venham do padrão antigo
    if(db.settings.phone==='(85) 98887-2126') db.settings.phone='';
    if(typeof db.settings.cnpj==='string'&&db.settings.cnpj.includes('68.712.202')) db.settings.cnpj='';
    if(db.coupons.find(c=>c.code==='NEXOS10')&&!db.coupons.find(c=>c.code==='LEGEND10')) db.coupons.find(c=>c.code==='NEXOS10').code='LEGEND10';
    // migração v2: garante tabelas novas
    db.users=db.users||[]; db.tickets=db.tickets||[]; db.withdrawals=db.withdrawals||[]; db.clicks=db.clicks||[];
    db.settings.pixCity=db.settings.pixCity||'FORTALEZA';
    db.settings.pixName=db.settings.pixName||'LEGEND STORE';
    if(db.settings.autoConfirmUrl===undefined) db.settings.autoConfirmUrl='';
    // limpeza única v3: remove as categorias que vinham com o site (dono cria as próprias)
    if(db._v!==3){ const SEED=['assinaturas','steam-offline','minecraft','fortnite','discord','redes-sociais']; db.categories=(db.categories||[]).filter(c=>!SEED.includes(c.id)); db._v=3; }
    // mescla novidades do padrão sem apagar o que o staff editou
    const d=defaultDB();
    d.categories.forEach(c=>{ if(!db.categories.find(x=>x.id===c.id)) db.categories.push(c); });
    d.products.forEach(p=>{ if(!db.products.find(x=>x.id===p.id)) db.products.push(p); });
    if(!db.coupons) db.coupons=d.coupons;
    if(!db.reviews) db.reviews=d.reviews;
    if(!db.commissions) db.commissions=d.commissions;
    localStorage.setItem(DB_KEY,JSON.stringify(db));
    return db;
   }
  }catch(e){}
  const d=defaultDB(); localStorage.setItem(DB_KEY,JSON.stringify(d)); return d;
 },
 save(db){ if(Store.mode==='staff'){ db._rev=(db._rev||0)+1; db._dirty=true; } localStorage.setItem(DB_KEY,JSON.stringify(db)); if(Store.mode==='staff') Store.pushSoon(); },
 reset(){ localStorage.removeItem(DB_KEY); return this.load(); }
};

// ===== BACKEND COMPARTILHADO (Vercel + Upstash) =====
// Quando configurado, tudo que o staff muda no painel passa a valer para
// todos os clientes, em qualquer dispositivo. Sem configuracao, continua
// funcionando com localStorage (modo offline).
const SITE_ID='mystic';
// Se o painel for aberto pelo arquivo local (duplo clique), aponta para a API
// ja publicada. No site normal, usa o caminho relativo da propria Vercel.
const ONLINE_ORIGIN='https://mystic-wars.vercel.app';
const IS_LOCAL=((typeof location!=='undefined'?location.protocol:'')==='file:');
const API=(IS_LOCAL?ONLINE_ORIGIN:'')+'/api/store';
const PUB=(IS_LOCAL?ONLINE_ORIGIN:'')+'/api/public';
let remoteOnline=false, pushTimer=null, inFlight=false, queued=false;
let pushErro='', pendentes=0, ultimoAviso='';

async function sha256hex(text){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashSenha(senha){ return await sha256hex(SITE_ID+'::'+senha); }
function passHashSalvo(){ return localStorage.getItem(DB_KEY+'_hash')||''; }

// ---- controle de versao: nada se perde se o envio falhar ----
function temPendente(){ const db=Store.load(); return !!(db&&db._dirty); }
function avisar(msg){ if(ultimoAviso===msg) return; ultimoAviso=msg; try{ if(typeof toast==='function') toast(msg); }catch(e){} }
// junta duas listas pelo id, sem apagar o que existe so de um lado
function unirPorId(a,b){
 const mapa=new Map();
 for(const x of (Array.isArray(a)?a:[])) if(x&&x.id) mapa.set(x.id,x);
 for(const x of (Array.isArray(b)?b:[])) if(x&&x.id) mapa.set(x.id,x); // remoto tem prioridade
 return [...mapa.values()];
}
// funde navegador e banco preservando o catalogo dos dois lados
function fundir(local,remoto){
 const out=Object.assign({},local);
 if(remoto&&typeof remoto==='object'){
  if(remoto.settings) out.settings=remoto.settings;
  if(remoto.commissions) out.commissions=remoto.commissions;
  out.categories=unirPorId(local&&local.categories,remoto.categories);
  out.products=unirPorId(local&&local.products,remoto.products);
  for(const t of ['orders','users','tickets','coupons','reviews','clicks','withdrawals']){
   if(Array.isArray(remoto[t])) out[t]=remoto[t];
  }
  if(remoto._v!==undefined) out._v=remoto._v;
 }
 out._rev=Math.max((local&&local._rev)||0,(remoto&&remoto._rev)||0);
 out._dirty=!!(local&&local._dirty);
 return out;
}
Object.assign(Store,{
 mode:'client',          // 'staff' faz o save() subir para o banco
 _v:'3.1',               // versao do codigo, util no diagnostico
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
 // acoes do painel do staff, autenticadas
 async apiStaff(body){
  const passHash=passHashSalvo();
  const r=await fetch(API+'?site='+SITE_ID,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,passHash})});
  let j={};
  try{ j=await r.json() }catch(e){}
  if(!r.ok) throw new Error(j.error||('http '+r.status));
  if(j.ok===false) throw new Error('Senha incorreta');
  return j;
 },
 // encolhe a imagem do comprovante antes de enviar
 comprimirImagem(file,maxLarg=1000){
  return new Promise((res,rej)=>{
   if(!file||!/^image\//.test(file.type)) return rej(new Error('Selecione uma imagem'));
   if(file.size>12*1024*1024) return rej(new Error('Imagem muito grande (max 12 MB)'));
   const fr=new FileReader();
   fr.onerror=()=>rej(new Error('Nao consegui ler a imagem'));
   fr.onload=()=>{
    const img=new Image();
    img.onerror=()=>rej(new Error('Arquivo de imagem invalido'));
    img.onload=()=>{
     let w=img.width,h=img.height;
     const esc=Math.min(1,maxLarg/w);
     w=Math.max(1,Math.round(w*esc));h=Math.max(1,Math.round(h*esc));
     const cv=document.createElement('canvas');cv.width=w;cv.height=h;
     const cx=cv.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
     try{ res(cv.toDataURL('image/jpeg',0.7)) }catch(e){ rej(new Error('Nao consegui processar a imagem')) }
    };
    img.src=fr.result;
   };
   fr.readAsDataURL(file);
  });
 },

 // baixa a versao do servidor (fonte da verdade) para o navegador
  // funde o banco com o navegador. NUNCA apaga o que existe so aqui,
  // nem quando o envio das novidades falhou.
  async hydrate(){
   let remoto=null;
   try{
    remoto=await this.apiGet();
    if(typeof remoto==='string'){ try{remoto=JSON.parse(remoto)}catch(e){remoto=null} }
    remoteOnline=true;
   }catch(e){
    remoteOnline=false;
    pushErro=String(e&&e.message?e.message:e);
    console.warn('[loja] banco indisponivel em '+API+':',pushErro);
    return false;
   }
   try{
    const fundido=fundir(Store.load(),remoto);
    localStorage.setItem(DB_KEY,JSON.stringify(fundido));
    if(fundido._dirty&&this.mode==='staff') this.pushRemote();
   }catch(e){}
   return true;
  },

 // sobe o catalogo/pedidos do painel para o servidor
 async pushRemote(){
  if(remoteOnline===false) return false;
  if(!passHashSalvo()){ pendentes++; pushErro='Senha nao registrada no banco'; avisar('⚠️ Saia e entre no painel para registrar sua senha no banco'); return false; }
  if(inFlight){ queued=true; return false; }
  inFlight=true;
  try{
   const db=Store.load();
   delete db.passHash;
   await this.apiPut(db,passHashSalvo());
   const depois=Store.load();
   depois._dirty=false; depois._syncedRev=depois._rev||0;
   localStorage.setItem(DB_KEY,JSON.stringify(depois));
   remoteOnline=true; pushErro=''; pendentes=0;
  }catch(e){
   pushErro=String(e&&e.message?e.message:e);
   pendentes++;
   if(/Senha incorreta/.test(pushErro)){ remoteOnline=false; avisar('❌ Senha do painel nao bate com o banco. Troque em Loja/PIX.'); }
   else avisar('⚠️ Nao consegui enviar: '+pushErro);
  }finally{
   inFlight=false;
   if(queued){ queued=false; setTimeout(()=>Store.pushRemote(),1200); }
  }
  return !pushErro;
 },
 pushSoon(){ setTimeout(()=>Store.pushRemote(),400); },

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
 key=String(key||'').trim(); name=String(name||'LEGEND').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,25)||'LEGEND';
 city=String(city||'BRASIL').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').slice(0,15)||'BRASIL';
 txid=String(txid||'LEGEND').replace(/[^a-zA-Z0-9]/g,'').slice(0,20)||'LEGEND';
 const gui=tlv('00','br.gov.bcb.pix')+tlv('01',key);
 let p=tlv('00','01')+tlv('26',gui)+tlv('52','0000')+tlv('53','986')+(amount>0?tlv('54',Number(amount).toFixed(2)):'')+tlv('58','BR')+tlv('59',name)+tlv('60',city)+tlv('62',tlv('05',txid))+tlv('63','04');
 return p+pixCRC16(p+'6304');
}
// Modelos para o staff recomeçar o catálogo em 1 clique (painel → Produtos)
function sampleProducts(){ return [
 {id:'samp-gamepass',name:'Xbox Game Pass Ultimate — 30 Dias',cat:'assinaturas',price:24.9,old:49.9,emoji:'🎮',img:DEFAULT_IMG('7997f56a-541a-4960-a5b2-93df755ea286'),stock:20,delivery:'Automática',desc:'Conta compartilhada, 30 dias.'},
 {id:'samp-minecraft',name:'Minecraft Java & Bedrock',cat:'minecraft',price:29.9,old:99.9,emoji:'⛏️',img:DEFAULT_IMG('e7332bab-95b1-4097-9df3-73e6dd2e7ef3'),stock:20,delivery:'Automática',desc:'Full acesso Java + Bedrock.'},
 {id:'samp-vbucks',name:'100 V-Bucks Fortnite',cat:'fortnite',price:7.9,old:12.9,emoji:'⚡',img:DEFAULT_IMG('568c647a-faf3-489c-bb88-60666644e150'),stock:50,delivery:'Automática',desc:'Gift via Epic.'}
];}
