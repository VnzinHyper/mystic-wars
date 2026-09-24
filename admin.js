let DB = Store.load();
Store.mode='staff';
const BRL=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.add('hidden'),2400)}
function semHash(){ return !localStorage.getItem('kaizen_db_v1_hash'); }
function syncBadge(){
 const el=document.getElementById('syncBadge');
 if(!el) return;
 const sujo=!!(DB&&DB._dirty);
 if(!Store.online){
  const via=typeof API!=='undefined'?API:'api';
  el.innerHTML=`<a href="#" onclick="forcarSync();return false" style="color:#ef4444;font-weight:700" title="Servidor: ${via}&#10;${Store.ultimoErro||'sem resposta'}">🔴 Sem banco — clique para tentar de novo</a>`;
  el.title='Sem resposta do banco em '+via+'. '+(Store.ultimoErro||'');
 }else if(sujo){
  el.innerHTML='🟡 <a href="#" onclick="forcarSync();return false" style="color:#facc15;font-weight:700">Enviando… (se nao sair, clique)</a>';
  el.title='Voce tem alteracoes que ainda nao foram para o banco. Nada sera apagado.';
 }else if(semHash()){
  el.innerHTML='🟡 <a href="#" onclick="forcarSync();return false" style="color:#facc15;font-weight:700">Banco ok — clique para registrar a senha</a>';
  el.title='Clique para gravar sua senha no banco. Ate la, as mudancas ficam so aqui.';
 }else{
  el.textContent='🟢 Sincronizado com todos';
  el.style.color='#22c55e';
  el.title='O que voce mexe aparece para todos os clientes, em qualquer dispositivo.';
 }
}
// ---------- diagnostico: mostra exatamente onde a conexao falha ----------
async function diag(){
 const box=document.getElementById('diagBox');
 if(!box) return;
 box.classList.remove('hidden');
 const L=[];
 L.push('=== DIAGNÓSTICO ===');
 L.push('página : '+location.href);
 L.push('protocolo: '+location.protocol);
 L.push('API    : '+(typeof API!=='undefined'?API:'(indefinida)'));
 L.push('store.js carregado: '+(typeof Store!=='undefined'?'sim, v'+Store._v:'NAO'));
 L.push('hash senha no PC: '+(passHashSalvo()?'SIM':'nao'));
 L.push('');
 L.push('testando…');
 box.textContent=L.join('\n');
 try{
  const url=(typeof API!=='undefined'?API:'/api/store')+'?site='+(typeof SITE_ID!=='undefined'?SITE_ID:'legend');
  const t0=Date.now();
  const r=await fetch(url,{cache:'no-store'});
  const txt=await r.text();
  L.push('resposta: HTTP '+r.status+' em '+(Date.now()-t0)+'ms');
  L.push('corpo   : '+txt.slice(0,220));
  let n=null; try{const j=JSON.parse(txt);n=j&&j.data?(j.data.categories||[]).length:null}catch(e){}
  if(n!==null) L.push('categorias no banco: '+n);
 }catch(e){
  L.push('ERRO DE REDE: '+(e&&e.message?e.message:e));
  L.push('');
  L.push('Se apareceu "Failed to fetch" ou "NetworkError":');
  L.push('  1) o painel pode estar aberto pelo arquivo local (file://)');
  L.push('  2) bloqueador de anuncios/privacidade do navegador pode estar');
  L.push('     barrando. No Brave, desative os escudos para este site.');
  L.push('  3) falta rede ou ha VPN/extensao bloqueando');
 }
 L.push('');
 L.push('Store.online = '+(typeof Store!=='undefined'?Store.online:'?'));
 L.push('ultimoErro  = '+(typeof Store!=='undefined'?(Store.ultimoErro||'(nenhum)'):'?'));
 box.textContent=L.join('\n');
}
async function forcarSync(){
 toast('⏳ Sincronizando…');
 await Store.hydrate();
 DB=Store.load();
 await Store.pushRemote();
 DB=Store.load();
 refresh();
 if(Store.ultimoErro) toast('❌ '+Store.ultimoErro+' — endereço: '+(typeof API!=='undefined'?API:'?'));
 else toast('✅ Sincronizado com todos!');
}
function pass(){return localStorage.getItem('nexos_staff_pass')||'admin123'}
async function staffLogin(){
 const senha=document.getElementById('staffPass').value;
 const gate=document.getElementById('loginGate');
 if(senha!==pass()){toast('❌ Senha incorreta');return}
 gate.innerHTML='<p style="color:#9aa7c7">Conectando ao banco…</p>';
 const h=await Store.setSenha(senha);
 try{
  const r=await Store.apiAuth(h);
  if(r.ok===false){
   gate.innerHTML='';toast('❌ '+(r.erro||'senha nao confere com o banco'));buildGate();return
  }
  // primeira senha: publica o catalogo atual no banco
  if(r.first) await Store.pushRemote();
  localStorage.setItem('nexos_staff_auth','1');
  location.reload();
 }catch(e){
  // sem banco: funciona igual antes, so neste dispositivo
  localStorage.setItem('nexos_staff_auth','1');
  location.reload();
 }
}
function buildGate(){
 const gate=document.getElementById('loginGate');
 if(!gate) return;
 gate.innerHTML=`<div class="gate-box"><div class="logo">L <span>Staff</span></div>
 <h2>Painel da Loja</h2><p>Acesso restrito à equipe.</p>
 <input id="staffPass" type="password" placeholder="Senha">
 <button onclick="staffLogin()">Entrar no painel</button>
 <small><a href="index.html">← Voltar à loja</a></small></div>`;
}
function staffLogout(){localStorage.removeItem('nexos_staff_auth');location.reload()}
async function savePass(){
 const v=$('f-pass').value.trim();
 if(!v) return toast('⚠️ Digite a nova senha');
 if(v.length<4) return toast('⚠️ Mínimo 4 caracteres');
 const nova=await Store.hashDe(v);
 if(!Store.online){
  localStorage.setItem('nexos_staff_pass',v);
  localStorage.setItem('kaizen_db_v1_hash',nova);
  return toast('⚠️ Sem banco: senha guardada so neste navegador');
 }
 try{
  // rotacao segura: o servidor confere a senha antiga e grava a nova
  await Store.apiStaff({action:'changePass',oldHash:passHashSalvo(),newHash:nova});
  localStorage.setItem('nexos_staff_pass',v);
  localStorage.setItem('kaizen_db_v1_hash',nova);
  $('f-pass').value='';
  toast('🔑 Senha atualizada e sincronizada');
  DB=Store.load(); refresh();
 }catch(e){
  toast('❌ '+(e.message||'falha ao trocar a senha'));
 }
}
function tab(name,el){document.querySelectorAll('.side button').forEach(b=>b.classList.remove('active'));if(el)el.classList.add('active');document.querySelectorAll('.tab').forEach(t=>t.classList.add('hidden'));document.getElementById('t-'+name).classList.remove('hidden');document.getElementById('tabTitle').textContent=el?el.textContent.replace(/[0-9]/g,'').trim():name;refresh()}
function refresh(){DB=Store.load();renderDash();renderLoja();renderCats();renderProds();renderOrders();renderTickets();renderUsers();renderCoupons();renderRevs();renderAff();renderProofs();syncBadge();document.querySelector('.js-sname').textContent=(DB.settings.storeName||'MysticWars')}
function renderDash(){const paid=DB.orders.filter(o=>o.status!=='cancelado');const rev=paid.reduce((a,o)=>a+(+o.total||0),0);document.getElementById('stRev').textContent=BRL(rev);document.getElementById('stOrd').textContent=DB.orders.length;document.getElementById('stProd').textContent=DB.products.length;document.getElementById('stStock').textContent=DB.products.reduce((a,p)=>a+(+p.stock||0),0);document.getElementById('ordBadge').textContent=DB.orders.filter(o=>o.status==='aguardando'||o.status.startsWith('pago')).length?`(${DB.orders.filter(o=>o.status==='aguardando'||o.status.startsWith('pago')).length}!)`:(DB.orders.length?`(${DB.orders.length})`:'');document.getElementById('tickBadge').textContent=(DB.tickets||[]).filter(t=>t.status==='aberto').length?`(${(DB.tickets||[]).filter(t=>t.status==='aberto').length})`:'';
 document.getElementById('dashOrders').innerHTML=DB.orders.slice(0,5).map(o=>`<div class="row"><div class="grow"><b>${o.id}</b> · ${o.email}<br><small>${o.date} · ${o.pay} · ${o.status} · ${o.items.map(i=>i.q+'x '+i.name).join(', ')}</small></div><b>${BRL(o.total)}</b></div>`).join('')||'<p style="color:#9aa7c7">Nenhuma venda ainda. Faça um pedido teste na loja.</p>'}
// ---------- Loja / PIX ----------
// le e grava TUDO que estiver com id comecando em "f-", sem lista fixa
// (assim novos campos aparecem sozinhos e nada se perde)
function camposLoja(){
 const s=DB.settings||{};
 const ids=[...document.querySelectorAll('input[id^="f-"],select[id^="f-"],textarea[id^="f-"]')].map(el=>el.id);
 return {ids,s};
}
function renderLoja(){
 const {ids,s}=camposLoja();
 for(const id of ids){ if(id==='f-pass') continue; const el=document.getElementById(id); if(!el) continue;
  const chave=id.slice(2);
  el.value=(s[chave]!==undefined&&s[chave]!==null)?s[chave]:'';
 }
}
function saveLoja(){
 const {ids,s}=camposLoja();
 const novo=Object.assign({},s);
 for(const id of ids){ if(id==='f-pass') continue; const el=document.getElementById(id); if(!el) continue;
  const chave=id.slice(2);
  novo[chave]=(el.type==='checkbox')?el.checked:el.value.trim();
 }
 DB.settings=novo;
 Store.save(DB);
 toast('✅ Loja atualizada!');
}
function renderCats(){document.getElementById('catList').innerHTML=DB.categories.map(c=>{const n=DB.products.filter(p=>p.cat===c.id).length;return `<div class="row"><span style="font-size:24px">${c.icon}</span><div class="grow"><b>${c.label}</b> <span class="pill">${c.id}</span> <span class="pill">${n} produtos</span></div><button onclick="delCat('${c.id}')">🗑️</button></div>`}).join('')}
function addCat(){const l=document.getElementById('nc-label').value.trim(),ic=document.getElementById('nc-icon').value.trim()||'📦';if(!l)return toast('⚠️ Nome obrigatório');const id=l.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');DB.categories.push({id,label:l,icon:ic});Store.save(DB);refresh();toast('✅ Categoria criada')}
function delCat(id){if(!confirm('Excluir categoria? Produtos dela ficarão sem categoria.'))return;DB.categories=DB.categories.filter(c=>c.id!==id);Store.save(DB);refresh()}
function renderProds(){const q=(document.getElementById('prodSearch').value||'').toLowerCase();const sel=document.getElementById('pf-cat');sel.innerHTML=DB.categories.map(c=>`<option value="${c.id}">${c.label}</option>`).join('');
 document.getElementById('prodList').innerHTML=DB.products.filter(p=>p.name.toLowerCase().includes(q)).map(p=>`<div class="row">${p.img?`<img src="${p.img}" onerror="this.remove()">`:`<span style="font-size:28px">${p.emoji||'📦'}</span>`}<div class="grow"><b>${p.name}</b><br><small>${p.cat} · estoque ${p.stock} · ${BRL(p.price)}</small></div><button onclick="editProd('${p.id}')">✏️</button><button onclick="delProd('${p.id}')">🗑️</button></div>`).join('')}
function clearProd(){['pf-id','pf-name','pf-price','pf-old','pf-stock','pf-emoji','pf-img','pf-desc'].forEach(id=>document.getElementById(id).value='');document.getElementById('pf-delivery').value='Automática';document.getElementById('pfTitle').textContent='Adicionar produto'}
function editProd(id){const p=DB.products.find(x=>x.id===id);if(!p)return;document.getElementById('pf-id').value=p.id;document.getElementById('pf-name').value=p.name;document.getElementById('pf-cat').value=p.cat;document.getElementById('pf-price').value=p.price;document.getElementById('pf-old').value=p.old||'';document.getElementById('pf-stock').value=p.stock;document.getElementById('pf-delivery').value=p.delivery||'Automática';document.getElementById('pf-emoji').value=p.emoji||'';document.getElementById('pf-img').value=p.img||'';document.getElementById('pf-desc').value=p.desc||'';document.getElementById('pfTitle').textContent='Editar: '+p.name;window.scrollTo({top:document.body.scrollHeight});}
function saveProd(){const id=document.getElementById('pf-id').value||('p'+Date.now().toString(36));const obj={id,name:document.getElementById('pf-name').value.trim(),cat:document.getElementById('pf-cat').value,price:+document.getElementById('pf-price').value||0,old:+document.getElementById('pf-old').value||0,stock:+document.getElementById('pf-stock').value||0,delivery:document.getElementById('pf-delivery').value||'Automática',emoji:document.getElementById('pf-emoji').value||'📦',img:document.getElementById('pf-img').value.trim(),desc:document.getElementById('pf-desc').value.trim()};if(!obj.name)return toast('⚠️ Nome obrigatório');
 const i=DB.products.findIndex(x=>x.id===id);if(i>=0)DB.products[i]=obj;else DB.products.unshift(obj);Store.save(DB);clearProd();refresh();toast('✅ Produto salvo e já aparece na loja!')}
function delProd(id){if(!confirm('Excluir produto?'))return;DB.products=DB.products.filter(x=>x.id!==id);Store.save(DB);refresh()}
function loadSamples(){if(!confirm('Adicionar 3 produtos modelo ao catálogo?'))return;sampleProducts().forEach(p=>{if(!DB.products.find(x=>x.id===p.id))DB.products.push(p)});Store.save(DB);refresh();toast('✨ Modelos adicionados!')}
let orderFilter='wait';
function renderOrders(){const list=DB.orders.filter(o=>orderFilter==='all'?true:orderFilter==='wait'?['aguardando','pago — conferindo','pago'].includes(o.status):o.status==='entregue');
 document.getElementById('orderList').innerHTML=list.map(o=>{const idx=DB.orders.indexOf(o);return `<div class="row"><div class="grow"><b>${o.id}</b> · ${o.email} ${o.ref?'<span class="pill">ref:'+o.ref+'</span>':''} ${o.gatewayOk?'<span class="pill">🤖 gateway OK</span>':''}<br><small>📅 ${o.date} · ${o.pay} · <b>${o.status}</b> · Esperado: <b>${BRL(o.total)}</b><br>🧾 ${o.items.map(i=>i.q+'x '+i.name).join(' | ')}${o.receipt?'<br>🧾 Comprovante cliente: <b>'+o.receipt+'</b>':''}${o.keys&&o.keys.length?'<br>🔑 '+o.keys.join(' | '):''}</small></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="primary" onclick="quickDeliver(${idx})">⚡ Pix caiu → entregar</button><button onclick="confirmPay(${idx})">✅ Só confirmar</button><button onclick="deliver(${idx})">📦 Entregar c/ chaves próprias</button><select onchange="orderStatus(${idx},this.value)">${['aguardando','pago — conferindo','pago','entregue','cancelado'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}</select><button onclick="delOrder(${idx})">🗑️</button></div></div>`}).join('')||'<p style="color:#9aa7c7">Nada aqui. 🎉</p>'}
function confirmPay(i){const o=DB.orders[i];o.status='pago';Store.save(DB);refresh();toast('✅ Pagamento de '+o.id+' confirmado')}
function quickDeliver(i){const o=DB.orders[i];o.status='pago';o.keys=o.items.map(()=> 'LEGEND-'+Math.random().toString(36).slice(2,10).toUpperCase());o.status='entregue';
 if(o.ref&&!o.comPaid){const aff=DB.users.find(u=>u.affCode===o.ref);if(aff){const v=(o.commission&&o.commission.value)||0;aff.wallet=(+aff.wallet||0)+v;o.comPaid=true;}}
 Store.save(DB);refresh();toast('⚡ '+o.id+' confirmado e entregue!')}
function deliver(i){const o=DB.orders[i];const keys=o.items.map(()=> 'LEGEND-'+Math.random().toString(36).slice(2,10).toUpperCase());const extra=prompt('Chaves/contas (separadas por |) — vazio p/ gerar automático:','')||'';o.keys=extra?extra.split('|').map(s=>s.trim()):keys;o.status='entregue';
 if(o.ref&&!o.comPaid){const aff=DB.users.find(u=>u.affCode===o.ref);if(aff){const v=(o.commission&&o.commission.value)||0;aff.wallet=(+aff.wallet||0)+v;o.comPaid=true;}}
 Store.save(DB);refresh();toast('📦 '+o.id+' entregue!')}
function renderTickets(){document.getElementById('ticketList').innerHTML=(DB.tickets||[]).map((t,idx)=>`<div class="row"><div class="grow"><b>#${t.id}</b> ${t.subject} · ${t.email} ${t.orderId?('· pedido '+t.orderId):''} · <b>${t.status}</b><br>${t.msgs.map(m=>`<small><b>${m.by}:</b> ${m.text}</small>`).join('<br>')}<br><input id="ta-${idx}" placeholder="Responder como staff..."></div><div style="display:flex;gap:6px"><button onclick="ansTicket(${idx})">Responder</button><button onclick="closeTicket(${idx})">✔️ Fechar</button></div></div>`).join('')||'<p style="color:#9aa7c7">Sem tickets.</p>'}
// ---------- comprovantes ----------
let proofFilter='enviado';
let proofCache=[];
async function renderProofs(){
 const box=document.getElementById('proofList'); if(!box) return;
 box.innerHTML='<p style="color:#9aa7c7">Carregando…</p>';
 try{
  const r=await Store.apiStaff({action:'proofs'});
  proofCache=r.orders||[];
 }catch(e){
  box.innerHTML=`<p style="color:#facc15">⚠️ ${e.message||'Falha ao buscar comprovantes'}</p>`;return;
 }
 const badge=document.getElementById('proofBadge');
 if(badge){const n=proofCache.filter(o=>o.proof.status==='enviado').length;badge.textContent=n?`(${n})`:'';}
 const lista=proofFilter==='todos'?proofCache:proofCache.filter(o=>o.proof.status===proofFilter);
 box.innerHTML=lista.map(o=>proofCard(o)).join('')||'<p style="color:#9aa7c7">Nada aqui 🎉</p>';
}
function proofCard(o){
 const p=o.proof;
 const st=p.status==='aprovado'?'<span class="pill" style="background:#22c55e;color:#04140a">aprovado</span>':p.status==='recusado'?'<span class="pill" style="background:#ef4444;color:#fff">recusado</span>':'<span class="pill" style="background:#facc15;color:#111">aguardando</span>';
 const img=p.dataUrl?`<a href="${p.dataUrl}" target="_blank"><img src="${p.dataUrl}" style="max-width:100%;max-height:340px;border-radius:10px;border:1px solid #2a2a55;cursor:zoom-in"></a>`:'<small style="color:#9aa7c7">sem imagem</small>';
 return `<div class="row" style="flex-direction:column;align-items:stretch">
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
   <b>${o.id}</b> ${st}
   <span class="pill">${o.nick||o.email}</span>
   <span class="pill">esperado ${BRL(o.total)}</span>
   <span class="pill">informado ${BRL(p.amount||o.total)}</span>
   ${o.items.map(i=>`<span class="pill">${i.q}x ${i.name}</span>`).join('')}
   ${p.amount&&Math.abs(p.amount-o.total)>0.01?'<span class="pill" style="background:#ef4444;color:#fff">VALOR DIVERGENTE</span>':''}
   <small style="color:#9aa7c7">enviado ${p.sentAt||''}${p.tentativas>1?' · tentativa '+p.tentativas:''}</small>
  </div>
  ${p.e2eId?`<div><small>ID informado: <b>${p.e2eId}</b></small></div>`:''}
  ${p.payer?`<div><small>Pagou: <b>${p.payer}</b></small></div>`:''}
  <div style="margin:8px 0">${img}</div>
  ${p.note?`<div><small>Observação do staff: ${p.note}</small></div>`:''}
  ${p.status==='enviado'?`
   <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
    <input id="pk-${o.id}" placeholder="Chaves próprias (opcional, separe por |)" style="flex:1;min-width:220px">
    <button class="primary" onclick="aprovar('${o.id}',true)">✅ Pix caiu — aprovar e entregar</button>
    <button onclick="aprovar('${o.id}',false)">❌ Recusar</button>
   </div>`:`<small style="color:#9aa7c7">${p.reviewedAt?'analisado em '+p.reviewedAt:''}</small>`}
 </div>`;
}
async function aprovar(orderId,aprovar){
 const keysInput=document.getElementById('pk-'+orderId);
 const keys=keysInput?keysInput.value.trim():'';
 let note='';
 if(!aprovar){
  note=prompt('Por que recusar? (o cliente vai ver isso)','O comprovante não confere com o pedido')||'';
  if(note===null) return;
 }
 if(aprovar&&!confirm('Confirmar que o Pix '+'chegou' + '? O cliente recebe a entrega na hora.')) return;
 try{
  const r=await Store.apiStaff({action:'reviewProof',orderId,approve:aprovar,keys,note,deliver:aprovar});
  toast(aprovar?'✅ Aprovado e entregue! '+((r.keys||[]).length)+' chave(s) enviada(s)':'❌ Comprovante recusado');
  await Store.hydrate(); DB=Store.load(); refresh(); renderProofs();
 }catch(e){ toast('⚠️ '+(e.message||'falha')); }
}
function ansTicket(i){const v=document.getElementById('ta-'+i).value.trim();if(!v)return;DB.tickets[i].msgs.push({by:'Staff',text:v,date:new Date().toLocaleString('pt-BR')});DB.tickets[i].status='respondido';Store.save(DB);refresh();toast('✉️ Respondido')}
function closeTicket(i){DB.tickets[i].status='fechado';Store.save(DB);refresh()}
function renderUsers(){document.getElementById('userList').innerHTML=(DB.users||[]).map((u,idx)=>{const n=DB.orders.filter(o=>o.email===u.email).length;return `<div class="row"><div class="grow"><b>${u.email}</b> <span class="pill">${u.affCode}</span><br><small>desde ${u.created} · ${n} pedidos · carteira ${BRL(u.wallet||0)} ${u.refBy?('· indicado por '+u.refBy):''}</small></div><button onclick="addWallet(${idx})">💰 Crédito</button></div>`}).join('')||'<p style="color:#9aa7c7">Nenhum cliente ainda.</p>'}
function addWallet(i){const v=+prompt('Valor R$ (pode ser negativo):','10');if(!v)return;DB.users[i].wallet=(+DB.users[i].wallet||0)+v;Store.save(DB);refresh()}
function orderStatus(i,v){DB.orders[i].status=v;Store.save(DB);toast('Status: '+v)}
function delOrder(i){DB.orders.splice(i,1);Store.save(DB);refresh()}
function renderCoupons(){document.getElementById('couponList').innerHTML=DB.coupons.map((c,i)=>`<div class="row"><div class="grow"><b>${c.code}</b> — ${c.percent}% OFF</div><button onclick="DB=Store.load();DB.coupons.splice(${i},1);Store.save(DB);refresh()">🗑️</button></div>`).join('')}
function addCoupon(){const code=document.getElementById('cp-code').value.trim().toUpperCase(),pc=+document.getElementById('cp-percent').value||0;if(!code)return toast('⚠️ Código obrigatório');DB.coupons.push({code,percent:pc});Store.save(DB);refresh();toast('✅ Cupom criado')}
function renderRevs(){document.getElementById('revList').innerHTML=DB.reviews.map((r,i)=>`<div class="row"><div class="grow"><b>${r.n}</b> <small>${r.d}</small><br>“${r.t}” <small>${r.p||''}</small></div><button onclick="DB=Store.load();DB.reviews.splice(${i},1);Store.save(DB);refresh()">🗑️</button></div>`).join('')}
function renderAff(){document.getElementById('cm-steam').value=DB.commissions.steam;document.getElementById('cm-ass').value=DB.commissions.assinaturas;document.getElementById('cm-out').value=DB.commissions.outros;
 document.getElementById('wdList').innerHTML=(DB.withdrawals||[]).map((w,i)=>`<div class="row"><div class="grow"><b>${w.email}</b> · ${BRL(w.value)} → ${w.pix}<br><small>${w.date} · <b>${w.status}</b></small></div><button onclick="wdStatus(${i},'pago')">✅ Paguei</button><button onclick="wdStatus(${i},'recusado')">❌</button></div>`).join('')||'<p style="color:#9aa7c7">Nenhum saque.</p>';
 const agg={};(DB.clicks||[]).forEach(c=>agg[c.code]=(agg[c.code]||0)+1);
 document.getElementById('clickList').innerHTML=Object.entries(agg).map(([k,v])=>`<div class="row"><div class="grow"><b>?ref=${k}</b></div><span class="pill">${v} cliques</span></div>`).join('')||'<p style="color:#9aa7c7">Sem cliques.</p>'}
function wdStatus(i,s){DB.withdrawals[i].status=s;Store.save(DB);refresh()}
function saveComm(){DB.commissions={steam:+document.getElementById('cm-steam').value||0,assinaturas:+document.getElementById('cm-ass').value||0,outros:+document.getElementById('cm-out').value||0};Store.save(DB);toast('✅ Comissões salvas')}
function exportJSON(){const b=new Blob([JSON.stringify(Store.load(),null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='mystic-backup.json';a.click()}
function importJSON(inp){const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{Store.save(JSON.parse(r.result));refresh();toast('✅ Backup importado')}catch(e){toast('❌ Arquivo inválido')}};r.readAsText(f)}
function resetAll(){if(!confirm('Restaurar tudo para o padrão?'))return;Store.reset();Store.pushRemote();refresh();toast('♻️ Restaurado')}
async function boot(){
 buildGate();
 if(localStorage.getItem('nexos_staff_auth')!=='1'){
  document.getElementById('loginGate').classList.remove('hidden');
  document.getElementById('panel').classList.add('hidden');
  // ja tenta conectar para mostrar o estado do banco no login
  Store.hydrate().then(()=>{});
  return;
 }
 document.getElementById('loginGate').classList.add('hidden');
 document.getElementById('panel').classList.remove('hidden');
 refresh();
 const okSync=await Store.hydrate();
 DB=Store.load(); refresh();
 if(okSync&&semHash()) setTimeout(()=>toast('Clique no selo amarelo no topo para registrar sua senha no banco'),900);
 // atualiza sozinho de tempos em tempos (outro staff pode ter mudado algo)
 setInterval(async()=>{ if(document.hidden) return; await Store.hydrate(); DB=Store.load(); refresh(); },20000);
}
boot();
