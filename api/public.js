// API publica (Vercel Function) - acoes dos clientes, sem login de staff
// Variaveis de ambiente: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
const LIMITE = 20000; // tamanho maximo de qualquer texto enviado

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
}
const ok=(res,d)=>{cors(res);res.status(200).json(d)};
const bad=(res,c,m)=>{cors(res);res.status(c).json({error:m})};
const txt=(v,lim=LIMITE)=>String(v==null?'':v).slice(0,lim);

export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS') return res.status(204).end();
  if(req.method!=='POST') return bad(res,405,'Metodo nao permitido');

  const URL_=process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!URL_||!TOKEN) return bad(res,500,'Banco nao configurado.');

  const site=String(req.query.site||'').replace(/[^a-z0-9_-]/gi,'').slice(0,40);
  if(!site) return bad(res,400,'Informe ?site=identificador');

  const key=`loja:${site}`;
  // mesmo decode tolerante do store.js (aceita objeto, texto JSON ou texto
  // com escape extra) para os dois arquivos nunca divergirem de formato
  function decode(raw){
   if(raw==null) return null;
   let v=raw;
   for(let i=0;i<4 && typeof v==='string';i++){
    const s=v.trim();
    if(!s) break;
    if(s[0]!=='{'&&s[0]!=='['&&s[0]!=='"') break;
    try{ v=JSON.parse(s); }catch(e){ break; }
   }
   return v;
  }
  const rget=async()=>{const r=await fetch(`${URL_}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${TOKEN}`}});if(!r.ok)throw new Error('banco indisponivel');return decode((await r.json()).result)||{};};
  const rset=async(v)=>{const r=await fetch(`${URL_}/set/${encodeURIComponent(key)}`,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(v)});if(!r.ok)throw new Error('banco indisponivel');return true;};

  try{
    const b=req.body||{};
    const action=txt(b.action,30);
    const db=await rget();
    db.orders=db.orders||[];db.tickets=db.tickets||[];db.reviews=db.reviews||[];
    db.users=db.users||[];db.clicks=db.clicks||[];db.withdrawals=db.withdrawals||[];

    if(action==='createOrder'){
      if(db.settings&&db.settings.lojaFechada) return bad(res,403,'Loja fechado no momento.');
      const items=Array.isArray(b.items)?b.items.slice(0,20).map(i=>({id:txt(i.id,40),name:txt(i.name,120),price:Number(i.price)||0,q:Math.max(1,Math.min(20,Number(i.q)||1)),cat:txt(i.cat,40)})):[];
      if(!items.length) return bad(res,400,'Carrinho vazio');
      const total=Number(b.total)||0;
      if(!(total>0)) return bad(res,400,'Valor invalido');
      // confere preco e estoque no servidor (nunca confia no cliente)
      const produtos=db.products||[];
      let totalReal=0;
      for(const it of items){
        const p=produtos.find(x=>x.id===it.id);
        if(!p) return bad(res,400,'Produto indisponivel: '+it.name);
        if((p.stock||0)<it.q) return bad(res,409,'Estoque insuficiente: '+p.name);
        totalReal+=Number(p.price)*it.q;
      }
      if(Math.abs(totalReal-total)>0.01) return bad(res,400,'Valor divergente');
      for(const it of items){const p=produtos.find(x=>x.id===it.id);p.stock=Math.max(0,(p.stock||0)-it.q);}
      db.products=produtos;
      const token=crypto.randomUUID().replace(/-/g,'').slice(0,12);
      const order={
        id:txt(b.id,20)||('NX'+Date.now().toString().slice(-6)),
        token,
        email:txt(b.email,120).toLowerCase(),
        nick:txt(b.nick,40),
        items,
        total,
        pay:txt(b.pay,10)==='cartao'?'cartao':'pix',
        date:new Date().toLocaleString('pt-BR'),
        status:'aguardando',
        pix:txt(b.pix,400),
        ref:txt(b.ref,40),
        keys:[]
      };
      db.orders.unshift(order);
      db.orders=db.orders.slice(0,500);
      await rset(db);
      return ok(res,{ok:true,id:order.id,token:order.token});
    }

    if(action==='getOrder'){
      const id=txt(b.id,20),token=txt(b.token,20);
      const o=db.orders.find(x=>x.id===id&&x.token===token);
      if(!o) return bad(res,404,'Pedido nao encontrado');
      return ok(res,{ok:true,order:{id:o.id,status:o.status,total:o.total,date:o.date,items:o.items,keys:o.keys||[],pix:o.pix}});
    }

    if(action==='setOrderStatus'){
      // o proprio cliente so pode avisar que pagou
      const id=txt(b.id,20),token=txt(b.token,20),novo=txt(b.status,30);
      const o=db.orders.find(x=>x.id===id&&x.token===token);
      if(!o) return bad(res,404,'Pedido nao encontrado');
      if(o.status==='entregue'||o.status==='cancelado') return ok(res,{ok:true,status:o.status});
      if(novo==='pago — conferindo'){o.status=novo;o.paidAt=new Date().toISOString();}
      await rset(db);
      return ok(res,{ok:true,status:o.status});
    }

    if(action==='upsertUser'){
      const email=txt(b.email,120).toLowerCase();
      if(!email.includes('@')) return bad(res,400,'Email invalido');
      let u=db.users.find(x=>x.email===email);
      if(!u){u={email,pass:txt(b.pass,100),name:txt(b.name,60),created:new Date().toLocaleString('pt-BR'),wallet:0,affCode:email.split('@')[0].replace(/[^a-z0-9]/gi,'').toLowerCase(),refBy:txt(b.refBy,40)};db.users.push(u);}
      else if(b.pass&&u.pass!==b.pass) return bad(res,401,'Senha incorreta');
      db.users=db.users.slice(0,2000);
      await rset(db);
      return ok(res,{ok:true,user:{email:u.email,affCode:u.affCode,wallet:u.wallet,refBy:u.refBy}});
    }

    if(action==='getUser'){
      const email=txt(b.email,120).toLowerCase();
      const u=db.users.find(x=>x.email===email);
      if(!u) return ok(res,{ok:true,user:null});
      return ok(res,{ok:true,user:{email:u.email,affCode:u.affCode,wallet:u.wallet,refBy:u.refBy}});
    }

    if(action==='addTicket'){
      const t={id:String(Date.now()).slice(-5),email:txt(b.email,120).toLowerCase(),orderId:txt(b.orderId,20),subject:txt(b.subject,120),status:'aberto',date:new Date().toLocaleString('pt-BR'),msgs:[{by:txt(b.email,120).toLowerCase(),text:txt(b.text,2000),date:new Date().toLocaleString('pt-BR')}]};
      db.tickets.unshift(t);db.tickets=db.tickets.slice(0,500);
      await rset(db);
      return ok(res,{ok:true,id:t.id});
    }

    if(action==='getTickets'){
      const email=txt(b.email,120).toLowerCase();
      return ok(res,{ok:true,tickets:db.tickets.filter(t=>t.email===email).slice(0,50)});
    }

    if(action==='replyTicket'){
      const id=txt(b.id,10),email=txt(b.email,120).toLowerCase();
      const t=db.tickets.find(x=>x.id===id&&x.email===email);
      if(!t) return bad(res,404,'Ticket nao encontrado');
      t.msgs.push({by:email,text:txt(b.text,2000),date:new Date().toLocaleString('pt-BR')});
      t.status='aberto';
      await rset(db);
      return ok(res,{ok:true});
    }

    if(action==='addReview'){
      const rv={n:txt(b.n,60),d:'agora mesmo',t:txt(b.t,600),p:'Compra verificada'};
      db.reviews.unshift(rv);db.reviews=db.reviews.slice(0,300);
      await rset(db);
      return ok(res,{ok:true});
    }

    if(action==='click'){
      const code=txt(b.code,40);
      if(code){db.clicks.unshift({code,date:new Date().toLocaleString('pt-BR')});db.clicks=db.clicks.slice(0,2000);}
      await rset(db);
      return ok(res,{ok:true});
    }

    return bad(res,400,'Acao desconhecida');
  }catch(e){
    return bad(res,500,String(e&&e.message?e.message:e));
  }
}
