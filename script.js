let DB = Store.load();
let PRODUCTS = DB.products, CATS = DB.categories;
let cart = JSON.parse(localStorage.getItem('nexos_cart')||'[]');
let cupomDesc = 0, payMethod='pix', currentOrder=null, pixTimer=null;
const BRL = v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const $=id=>document.getElementById(id);
function S(){ return DB.settings; }
function session(){ return localStorage.getItem('nexos_session')||''; }
function me(){ return DB.users.find(u=>u.email===session()); }
function scrollTop0(){window.scrollTo({top:0,behavior:'smooth'})}
function toast(m){const t=$('toast');t.textContent=m;t.classList.remove('hidden');clearTimeout(t._x);t._x=setTimeout(()=>t.classList.add('hidden'),2800)}
// afiliado via ?ref=
(function(){const u=new URLSearchParams(location.search);const ref=u.get('ref');if(ref){localStorage.setItem('nexos_ref',ref);try{DB=Store.load();DB.clicks.unshift({code:ref,date:new Date().toLocaleString('pt-BR')});Store.save(DB);DB=Store.load()}catch(e){}}})();
// ---------- render loja ----------
let activeTab=null;
function applySettings(){
 document.title=S().storeName+' — Loja Oficial';
 document.querySelectorAll('.js-store').forEach(e=>e.textContent=S().storeName);
 document.querySelectorAll('.js-discord').forEach(a=>a.href=S().discord);
 document.querySelectorAll('.js-insta').forEach(a=>a.href=S().instagram);
 document.querySelectorAll('.js-twitter').forEach(a=>a.href=S().twitter||'#');
 document.querySelectorAll('.js-youtube').forEach(a=>a.href=S().youtube||'#');
 document.querySelectorAll('.js-tiktok').forEach(a=>a.href=S().tiktok||'#');
 document.querySelectorAll('.logo-img').forEach(im=>{if(S().logo)im.src=S().logo});
 const r=document.querySelector(':root'); if(r){r.style.setProperty('--acc',S().primary);r.style.setProperty('--acc2',S().secondary)}
 const ht=$('heroTitle'); if(ht) ht.textContent=S().heroTitle;
 const hs=$('heroSub'); if(hs) hs.textContent=S().heroSub;
 const hi=$('heroImg'); if(hi&&S().heroImg){hi.src=S().heroImg;hi.style.display=''}
 const mq=$('marqueeTrack'); if(mq){const t=('⚡ '+S().banner+' ').repeat(12);mq.textContent=t+t;}
 const fc=$('footCnpj'); if(fc) fc.textContent=S().cnpj;
 const rs=$('revScore'); if(rs) rs.textContent=S().rating;
 const at=$('affText'); if(at) at.innerHTML=`Você ganha <b>até ${DB.commissions.steam}% de comissão</b>: ${DB.commissions.steam}% em Ranks, ${DB.commissions.assinaturas}% em Prime e ${DB.commissions.outros}% nos demais. Saque no PIX.`;
 const u=me(); const btn=$('btnAccount'); if(btn) btn.textContent=u?('👤 '+u.email.split('@')[0]):'👤 Entrar';
}
function desconto(p){if(!p.old||p.old<=p.price)return 0;return Math.round((1-p.price/p.old)*100)}
function catLabel(id){const c=CATS.find(x=>x.id===id);return c?c.label:id}
function cardHTML(p){const esgotado=(p.stock||0)<=0;const off=desconto(p);return `<div class="prod" onclick="verProduto('${p.id}')"><div class="prod-img">${p.img?`<img src="${p.img}" loading="lazy" onerror="this.remove()">`:''}<span style="position:absolute">${p.img?'':(p.emoji||'📦')}</span>${off?`<span class="prod-off">-${off}%</span>`:''}</div><div class="prod-body"><h3>${p.name}</h3><div class="prod-price">${off?`<s>${BRL(p.old)}</s>`:''}<b>${BRL(p.price)}</b></div><button ${esgotado?'disabled':''} onclick="event.stopPropagation();addToCart('${p.id}',true)">${esgotado?'Esgotado':'Comprar agora'}</button></div></div>`}
function setTab(id){activeTab=id;renderAll();document.getElementById('loja').scrollIntoView({behavior:'smooth'})}
function renderAll(){
 DB=Store.load();PRODUCTS=DB.products;CATS=DB.categories;applySettings();
 if(!activeTab||!CATS.find(c=>c.id===activeTab)) activeTab=(CATS[0]||{}).id;
 const tabs=$('tabs');
 if(tabs) tabs.innerHTML=CATS.map(c=>`<button class="tab-btn ${c.id===activeTab?'active':''}" onclick="setTab('${c.id}')">${c.label}</button>`).join('');
 const vit=$('vitrine');
 if(vit){const items=CATS.length?PRODUCTS.filter(p=>p.cat===activeTab):PRODUCTS;
  vit.innerHTML=PRODUCTS.length?`<div class="grid">${items.map(cardHTML).join('')||'<p class="muted">Nenhum produto aqui ainda.</p>'}</div>`:`<div style="text-align:center;padding:40px"><h2>📦 Catálogo em atualização</h2><p class="muted">Novidades chegando. Fale no Discord e receba as ofertas primeiro.</p><a class="btn-primary js-discord" href="${S().discord}" target="_blank">💜 Entrar no Discord</a></div>`;}
 renderCart();renderReviews();
}
function scrollCarrossel(d){$('carrossel').scrollBy({left:d*440,behavior:'smooth'})}
function verCategoria(id){const c=CATS.find(x=>x.id===id);const items=PRODUCTS.filter(p=>p.cat===id);
 $('produtoDetalhe').innerHTML=`<div class="prod-cat">${c.icon} ${c.label}</div><h2>Todos de ${c.label}</h2><div class="grid" style="margin-top:12px">${items.map(cardHTML).join('')||'<p class="muted">Nenhum produto.</p>'}</div>`;abrirModal('modalProduto')}
function verProduto(id){const p=PRODUCTS.find(x=>x.id===id);if(!p)return;const rel=PRODUCTS.filter(x=>x.cat===p.cat&&x.id!==id).slice(0,4);
 $('produtoDetalhe').innerHTML=`<div class="prod-detail-img">${p.img?`<img src="${p.img}" onerror="this.remove()">`:(p.emoji||'📦')}</div>
 <div class="prod-cat" style="margin-top:10px">${catLabel(p.cat)}</div><h2>${p.name}</h2>
 <div class="detail-meta"><span class="tag">⚡ ${p.delivery||'Automática'}</span><span class="tag">📦 ${p.stock} em estoque</span><span class="tag">🔒 Garantia 30 dias</span></div>
 <p class="muted">${p.desc||''}</p>
 <div class="hero-price"><s>${BRL(p.old)}</s> <b style="font-size:28px">${BRL(p.price)}</b></div>
 <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-primary full" onclick="addToCart('${p.id}')">Adicionar ao carrinho</button><button class="btn-secondary" onclick="addToCart('${p.id}',true)">⚡ Comprar agora</button></div>
 ${rel.length?'<h3 style="margin:14px 0 8px">Quem viu, levou também</h3><div class="grid">'+rel.map(cardHTML).join('')+'</div>':''}`;
 abrirModal('modalProduto')}
// ---------- carrinho ----------
function addToCart(id,go=false){const p=PRODUCTS.find(x=>x.id===id);if(!p||p.stock<=0){toast('❌ Sem estoque');return}const f=cart.find(i=>i.id===id);if(f){if(f.q>=p.stock){toast('⚠️ Limite do estoque');return}f.q++}else cart.push({id,q:1});saveCart();renderCart();toast('✅ Adicionado');if(!go)toggleCart(true);else{toggleCart(false);irCheckout()}}
function saveCart(){localStorage.setItem('nexos_cart',JSON.stringify(cart))}
function cartTotal(){return cart.reduce((a,i)=>{const p=PRODUCTS.find(x=>x.id===i.id);return a+(p?p.price*i.q:0)},0)*(1-cupomDesc)}
function renderCart(){const box=$('cartItems');if(!box)return;$('cartCount').textContent=cart.reduce((a,i)=>a+i.q,0);
 box.innerHTML=!cart.length?'<p class="muted" style="text-align:center;padding:30px">Carrinho vazio 👇</p>':cart.map(i=>{const p=PRODUCTS.find(x=>x.id===i.id);if(!p)return '';return `<div class="cart-item"><div class="emoji">${p.img?`<img src="${p.img}" onerror="this.remove()">`:(p.emoji||'📦')}</div><div style="flex:1"><b>${p.name}</b><br><small>${BRL(p.price)} un.</small><div class="qty"><button onclick="chQty('${p.id}',-1)">−</button><b>${i.q}</b><button onclick="chQty('${p.id}',1)">+</button><button onclick="rmItem('${p.id}')" style="margin-left:auto">🗑️</button></div></div><b>${BRL(p.price*i.q)}</b></div>`}).join('');
 $('cartTotal').textContent=BRL(cartTotal())}
function chQty(id,d){const p=PRODUCTS.find(x=>x.id===id);const f=cart.find(i=>i.id===id);if(!f)return;f.q+=d;if(f.q<=0)cart=cart.filter(i=>i.id!==id);if(p&&f.q>p.stock){f.q=p.stock;toast('⚠️ Estoque máximo')}saveCart();renderCart()}
function rmItem(id){cart=cart.filter(i=>i.id!==id);saveCart();renderCart()}
function toggleCart(o){$('cartDrawer').classList.toggle('open',o);$('cartOverlay').classList.toggle('hidden',!o)}
function aplicarCupom(){const v=$('cupomInput').value.trim().toUpperCase();const c=DB.coupons.find(x=>x.code.toUpperCase()===v);if(c){cupomDesc=c.percent/100;toast(`🎉 ${c.code}: -${c.percent}%`)}else{cupomDesc=0;toast('❌ Cupom inválido')}renderCart()}
function filtrarBusca(q){const box=$('searchResults');q=q.trim().toLowerCase();if(q.length<2){box.classList.add('hidden');return}
 const r=PRODUCTS.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8);
 box.innerHTML=r.length?r.map(p=>`<div onclick="verProduto('${p.id}')">🔎 <b>${p.name}</b> — ${BRL(p.price)}</div>`).join(''):'<div>Nada encontrado 😕</div>';box.classList.remove('hidden')}
document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))$('searchResults').classList.add('hidden')});
function abrirModal(id){document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));$(id).classList.remove('hidden')}
function fecharModais(){document.querySelectorAll('.modal').forEach(m=>m.classList.add('hidden'));if(pixTimer)clearInterval(pixTimer);if(typeof watchInt!=='undefined'&&watchInt)clearInterval(watchInt)}
// ---------- auth / conta ----------
function abrirConta(){const u=me();if(!u){abrirModal('modalLogin');return}renderConta();abrirModal('modalConta')}
function fazerLogin(){const e=$('loginEmail').value.trim().toLowerCase(),p=$('loginPass').value;if(!e.includes('@')||!p){toast('⚠️ E-mail e senha');return}
 DB=Store.load();let u=DB.users.find(x=>x.email===e);
 if(!u){u={email:e,pass:p,name:e.split('@')[0],created:new Date().toLocaleString('pt-BR'),wallet:0,affCode:e.split('@')[0].replace(/[^a-z0-9]/gi,'').toLowerCase(),refBy:localStorage.getItem('nexos_ref')||''};DB.users.push(u);Store.save(DB);toast('🎉 Conta criada!')}
 else if(u.pass!==p){toast('❌ Senha incorreta');return}
 localStorage.setItem('nexos_session',e);DB=Store.load();applySettings();fecharModais();toast('👋 Bem-vindo(a)!')}
function logout(){localStorage.removeItem('nexos_session');applySettings();fecharModais();toast('👋 Saiu')}
function commOf(cat){if(cat==='steam-offline')return DB.commissions.steam;if(cat==='assinaturas')return DB.commissions.assinaturas;return DB.commissions.outros}
function renderConta(){const u=me();if(!u)return;const myOrders=DB.orders.filter(o=>o.email===u.email);
 const myTickets=DB.tickets.filter(t=>t.email===u.email);
 const mySales=DB.orders.filter(o=>o.ref===u.affCode);
 const clicks=DB.clicks.filter(c=>c.code===u.affCode).length;
 const link=location.href.split('?')[0]+'?ref='+u.affCode;
 const saques=DB.withdrawals.filter(w=>w.email===u.email);
 $('contaBody').innerHTML=`
 <p class="muted">👤 ${u.email} · membro desde ${u.created}</p>
 <div class="detail-meta"><span class="tag">🧾 ${myOrders.length} pedidos</span><span class="tag">💰 Carteira ${BRL(u.wallet||0)}</span><span class="tag">🔗 ${clicks} cliques</span><span class="tag">💵 ${mySales.length} vendas indicadas</span></div>
 <h3>🔗 Meu link afiliado (${commOf('steam-offline')}%/${commOf('assinaturas')}%/${commOf('outros')}%)</h3>
 <div class="keys">${link}<br><button class="btn-secondary" style="margin-top:8px" onclick="navigator.clipboard&&navigator.clipboard.writeText('${link}');toast('🔗 Copiado!')">Copiar link</button>
 <button class="btn-secondary" style="margin-top:8px" onclick="sacarAfiliado()">💸 Sacar via PIX</button></div>
 ${saques.length?'<small class="muted">Saques: '+saques.map(s=>s.status+' '+BRL(s.value)).join(' · ')+'</small>':''}
 <h3 style="margin-top:12px">🧾 Meus pedidos</h3>
 ${myOrders.map(o=>`<div class="keys"><b>${o.id}</b> · ${BRL(o.total)} · <b>${o.status}</b><br><small>${o.date} · ${o.items.map(i=>i.q+'x '+i.name).join(', ')}</small>${o.status==='entregue'?'<br>🔑 '+(o.keys||[]).join(' | '):'<br><small class="muted">Aguarde confirmação. Suporte: '+S().discord+'</small>'}<br><button class="btn-secondary" style="margin-top:6px" onclick="abrirTicket('${o.id}')">🎫 Suporte deste pedido</button></div>`).join('')||'<p class="muted">Nenhum pedido ainda.</p>'}
 <h3 style="margin-top:12px">🎫 Meus tickets</h3>
 ${myTickets.map(t=>`<div class="keys"><b>#${t.id}</b> ${t.subject} · <b>${t.status}</b><br>${t.msgs.map(m=>`<small><b>${m.by}:</b> ${m.text}</small>`).join('<br>')}<br><input id="rp-${t.id}" placeholder="Responder..."><button class="btn-secondary" onclick="respTicket('${t.id}')">Enviar</button></div>`).join('')||'<p class="muted">Sem tickets. <button class="btn-secondary" onclick="abrirTicket(\'\')">Abrir ticket</button></p>'}
 <button class="btn-secondary full" onclick="logout()">🚪 Sair da conta</button>`;}
function sacarAfiliado(){const u=me();if((u.wallet||0)<10){toast('⚠️ Mínimo R$ 10 para saque');return}const chave=prompt('Sua chave PIX para receber:');if(!chave)return;DB.withdrawals.unshift({email:u.email,value:u.wallet,pix:chave,status:'pendente',date:new Date().toLocaleString('pt-BR')});u.wallet=0;Store.save(DB);renderConta();toast('💸 Saque solicitado!')}
// ---------- checkout PIX real ----------
function irCheckout(){if(!cart.length){toast('🛒 Carrinho vazio');return}toggleCart(false);
 const u=me();$('checkoutEmail').value=u?u.email:($('checkoutEmail').value||'');
 $('checkoutResumo').innerHTML=cart.map(i=>{const p=PRODUCTS.find(x=>x.id===i.id);return `<div style="display:flex;justify-content:space-between;font-size:14px;padding:4px 0"><span>${i.q}x ${p.name}</span><b>${BRL(p.price*i.q)}</b></div>`}).join('')+`<div style="display:flex;justify-content:space-between;border-top:1px solid #223055;margin-top:8px;padding-top:8px"><span>Total ${cupomDesc?'com cupom':''}</span><b>${BRL(cartTotal())}</b></div>`;
 $('checkoutTotalBtn').textContent=BRL(cartTotal());atualizarPix();abrirModal('modalCheckout')}
function setPay(m,el){payMethod=m;document.querySelectorAll('.pay-method').forEach(b=>b.classList.remove('active'));el.classList.add('active');$('pixArea').classList.toggle('hidden',m!=='pix');$('cartaoArea').classList.toggle('hidden',m!=='cartao')}
function atualizarPix(){const total=cartTotal();const tx='MW'+Date.now().toString().slice(-8);
 const code=genPixCode(S().pixKey,S().pixName,S().pixCity,total,tx);
 $('pixCode').textContent=code;
 $('pixMeta').innerHTML=`🏦 <b>${S().pixName}</b><br>🔑 ${S().pixKey} · 💰 ${BRL(total)}`;
 $('pixQR').src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&data='+encodeURIComponent(code);
 let seg=30*60;if(pixTimer)clearInterval(pixTimer);pixTimer=setInterval(()=>{seg--;const m=String(Math.floor(seg/60)).padStart(2,'0'),s=String(seg%60).padStart(2,'0');const el=$('pixTimer');if(el)el.textContent=`⏳ Expira em ${m}:${s}`;if(seg<=0)clearInterval(pixTimer)},1000)}
function copiarPix(){try{navigator.clipboard.writeText($('pixCode').textContent)}catch(e){}toast('📋 Pix copia-e-cola copiado')}
function confirmarPagamento(){
 const raw=$('checkoutEmail').value.trim();
 if(raw.length<3){toast('⚠️ Informe seu nick ou e-mail');return}
 const u0=me();
 const email=raw.includes('@')?raw.toLowerCase():(u0?u0.email:'');
 const nick=raw;
 if(payMethod==='cartao'){const n=$('ccNum').value.replace(/\D/g,'');if(n.length<12){toast('⚠️ Cartão inválido');return}}
 DB=Store.load();
 for(const i of cart){const p=DB.products.find(x=>x.id===i.id);if(!p||p.stock<i.q){toast('❌ Estoque insuficiente: '+(p?p.name:''));return}}
 const total=cartTotal();
 const orderId='MW'+Date.now().toString().slice(-6);
 const ref=localStorage.getItem('nexos_ref')||'';
 const order={id:orderId,email,nick,items:cart.map(i=>{const p=DB.products.find(x=>x.id===i.id);return{id:i.id,name:p.name,price:p.price,q:i.q,cat:p.cat}}),total,pay:payMethod,date:new Date().toLocaleString('pt-BR'),status:'aguardando',pix:payMethod==='pix'?$('pixCode').textContent:'',ref,keys:[]};
 cart.forEach(i=>{const p=DB.products.find(x=>x.id===i.id);p.stock-=i.q});
 DB.orders.unshift(order);
 // comissão afiliado (pendente)
 if(ref){const aff=DB.users.find(u=>u.affCode===ref);if(aff&&aff.email!==email){let com=0;order.items.forEach(it=>{com+=it.price*it.q*(commOf(it.cat)/100)});aff.wallet=(aff.wallet||0)+0;order.commission={to:ref,value:+com.toFixed(2)};}}
 Store.save(DB);
 currentOrder=orderId;cart=[];cupomDesc=0;saveCart();renderAll();fecharModais();
 $('sucessoMsg').innerHTML=`Pedido <b>${orderId}</b> de <b>${BRL(total)}</b> criado via <b>${payMethod==='pix'?'Pix':'Cartão'}</b>.<br>${payMethod==='pix'?`Pague o QR e clique em “Já paguei”.<br>📝 Na <b>descrição/mensagem do Pix</b> escreva a referência <b>${orderId}</b> — é assim que confirmamos seu pagamento rapidinho.`:'Pagamento do cartão em análise. Você recebe por e-mail.'}<br><small>Entrega para <b>${nick}</b>${email?' · '+email:''} · Acompanhe em 👤 Conta → Meus pedidos</small>`;
 $('sucessoKeys').innerHTML=`<div id="watchBox"><b>Status: aguardando pagamento</b><br><button class="btn-primary full" onclick="jaPaguei('${orderId}')">✅ Já paguei, liberar entrega</button><button class="btn-secondary full" onclick="abrirTicket('${orderId}')">🎫 Preciso de ajuda neste pedido</button></div>`;
 $('modalSucesso').classList.remove('hidden');watchOrder(orderId)}
function jaPaguei(id){DB=Store.load();const o=DB.orders.find(x=>x.id===id);if(!o)return;
 o.status='pago — conferindo';Store.save(DB);
 toast('✅ Pagamento avisado! Deixe esta tela aberta: confirmamos e a entrega aparece aqui sozinha.');
 if(me()){try{renderConta()}catch(e){}}
 watchOrder(id);pollGateway(id)}
// observa o pedido: quando o staff confirmar, a tela atualiza sozinha
let watchInt=null;
function watchOrder(id){if(watchInt)clearInterval(watchInt);watchInt=setInterval(()=>{let db;try{db=Store.load()}catch(e){return}const o=db.orders.find(x=>x.id===id);if(!o)return;const box=$('watchBox');if(!box){clearInterval(watchInt);return}
 if(o.status==='entregue'){clearInterval(watchInt);box.innerHTML=`<div style="font-size:40px">🎉</div><b>Pagamento confirmado! Aqui está sua entrega:</b><div class="keys">🔑 ${(o.keys||[]).join('<br>🔑 ')}</div>`;toast('🎉 Pagamento confirmado!')}
 else if(o.status==='pago'||o.status==='pago — conferindo'){box.querySelector('b').textContent='Status: pagamento recebido, preparando entrega…'}},4000)}
// gancho de confirmação automática via gateway (quando o dono conectar o backend)
async function pollGateway(id){const url=(S().autoConfirmUrl||'').trim();if(!url)return;try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:id})});const j=await r.json();if(j&&j.paid){DB=Store.load();const o=DB.orders.find(x=>x.id===id);if(o&&o.status!=='entregue'){o.status='pago — conferindo';o.gatewayOk=true;Store.save(DB);toast('✅ Pagamento detectado automaticamente!')}}}catch(e){}}
// ---------- tickets ----------
function abrirTicket(orderId){const u=me();const email=(u?u.email:($('checkoutEmail').value||prompt('Seu nick ou e-mail:')||'')).trim();if(email.length<3){toast('⚠️ Faça login primeiro');abrirModal('modalLogin');return}
 const subj=prompt('Assunto (ex: não recebi, dúvida antes de comprar):')||'Ajuda com pedido';const msg=prompt('Descreva:')||subj;
 DB=Store.load();const t={id:String(Date.now()).slice(-5),email,orderId:orderId||'',subject:subj,status:'aberto',date:new Date().toLocaleString('pt-BR'),msgs:[{by:email,text:msg,date:new Date().toLocaleString('pt-BR')}]};DB.tickets.unshift(t);Store.save(DB);toast('🎫 Ticket #'+t.id+' aberto!');if(me()){renderConta();abrirModal('modalConta')}}
function respTicket(id){const txt=$('rp-'+id).value.trim();if(!txt)return;DB=Store.load();const t=DB.tickets.find(x=>x.id===id);t.msgs.push({by:me().email,text:txt,date:new Date().toLocaleString('pt-BR')});t.status='aberto';Store.save(DB);renderConta();toast('✉️ Enviado')}
// ---------- afiliado / reviews ----------
function gerarLinkAfiliado(){let u=me();if(!u){abrirModal('modalLogin');toast('⚠️ Entre para gerar seu link');return}const link=location.href.split('?')[0]+'?ref='+u.affCode;const b=$('affLinkBox');b.classList.remove('hidden');b.innerHTML=`🎉 Seu link (ganhe ${commOf('steam-offline')}%/${commOf('assinaturas')}%/${commOf('outros')}%):<br><b>${link}</b><br><button class="btn-secondary" style="margin-top:8px" onclick="navigator.clipboard&&navigator.clipboard.writeText('${link}');toast('🔗 Copiado!')">Copiar link</button> <button class="btn-secondary" style="margin-top:8px" onclick="abrirConta()">💰 Minha carteira</button>`}
function simular(){const v=+$('simVendas').value,t=+$('simTicket').value;$('simVendasLbl').textContent=v;$('simTicketLbl').textContent=t;const media=(DB.commissions.steam+DB.commissions.assinaturas+DB.commissions.outros)/3/100;$('simResult').textContent=BRL(v*t*media)+'/mês'}
function renderReviews(){const g=$('reviewsGrid');if(g)g.innerHTML=(DB.reviews||[]).slice(0,12).map(r=>`<div class="rev"><div class="rev-head"><div class="avatar">${(r.n||'?')[0]}</div><div><b>${r.n}</b><br><small>${r.d} · Verificada</small></div></div><div class="stars">★★★★★</div><p>“${r.t}”</p><small class="muted">${r.p||''}</small></div>`).join('')}
function enviarAvaliacao(){const n=$('avNome').value||'Anônimo',t=$('avTexto').value||'Muito bom';DB=Store.load();DB.reviews.unshift({n,d:'agora mesmo',t,p:'Compra verificada'});Store.save(DB);fecharModais();renderAll();toast('⭐ Publicado!')}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){fecharModais();toggleCart(false)}});
window.addEventListener('storage',e=>{if(e.key===DB_KEY)renderAll()});
renderAll();
try{simular()}catch(e){}
