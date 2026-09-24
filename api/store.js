// API do staff (Vercel Function) - Upstash Redis via REST
// Variaveis de ambiente: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
const TABLES = ['settings','commissions','categories','products','coupons','orders','users','tickets','withdrawals','clicks','reviews'];

function cors(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,PUT,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
}
const ok=(res,d)=>{cors(res);res.status(200).json(d)};
const bad=(res,c,m)=>{cors(res);res.status(c).json({error:m})};

export default async function handler(req,res){
  cors(res);
  if(req.method==='OPTIONS') return res.status(204).end();

  const URL_=process.env.UPSTASH_REDIS_REST_URL;
  const TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN;
  if(!URL_||!TOKEN) return bad(res,500,'Banco nao configurado. Adicione UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN nas variaveis da Vercel.');

  const site=String(req.query.site||'').replace(/[^a-z0-9_-]/gi,'').slice(0,40);
  if(!site) return bad(res,400,'Informe ?site=identificador');

  const key=`loja:${site}`;
  // O Upstash pode devolver o valor ja como objeto ou como texto JSON.
  // O decode aceita os dois formatos, ate com camadas extras de escape.
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
  const redis={
    async get(){const r=await fetch(`${URL_}/get/${encodeURIComponent(key)}`,{headers:{Authorization:`Bearer ${TOKEN}`}});if(!r.ok)throw new Error('banco indisponivel');return decode((await r.json()).result)},
    // envia o JSON como texto puro: o Upstash guarda esse texto e o GET
    // devolve o mesmo texto, sem uma camada extra de escape
    async set(v){const r=await fetch(`${URL_}/set/${encodeURIComponent(key)}`,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(v)});if(!r.ok)throw new Error('banco indisponivel');return true}
  };

  try{
    if(req.method==='GET'){
      const db=await redis.get();
      if(db&&typeof db==='object') delete db.passHash; // nunca expor o hash
      return ok(res,{ok:true,data:db});
    }

    if(req.method==='POST'){
      // tudo que vem por aqui e do painel do staff
      const b=req.body||{};
      const passHash=String(b.passHash||'');
      if(!passHash) return bad(res,401,'Sem credencial');
      const raw=await redis.get();
      const guard=(raw&&typeof raw==='object')?raw:null;
      if(guard&&guard.passHash&&guard.passHash!==passHash) return bad(res,403,'Senha incorreta');

      if(b.action==='proofs'){
       const list=(guard&&guard.orders||[]).filter(o=>o.proof);
       return ok(res,{ok:true,orders:list.map(o=>({
        id:o.id,nick:o.nick,email:o.email,total:o.total,status:o.status,date:o.date,
        items:o.items,keys:o.keys||[],ref:o.ref||'',
        proof:{status:o.proof.status,sentAt:o.proof.sentAt,reviewedAt:o.proof.reviewedAt,note:o.proof.note,e2eId:o.proof.e2eId,amount:o.proof.amount,payer:o.proof.payer,dataUrl:o.proof.dataUrl},
        tentativas:(o.proofHistory||[]).length
       }))});
      }

      if(b.action==='reviewProof'){
       if(!guard) return bad(res,404,'Loja ainda nao publicada no banco');
       const o=(guard.orders||[]).find(x=>x.id===String(b.orderId||'').slice(0,20));
       if(!o||!o.proof) return bad(res,404,'Comprovante nao encontrado');
       if(o.proof.status==='aprovado') return bad(res,409,'Ja aprovado antes');
       const aprovar=!!b.approve;
       o.proof.status=aprovar?'aprovado':'recusado';
       o.proof.reviewedAt=new Date().toLocaleString('pt-BR');
       o.proof.note=String(b.note||'').slice(0,300);
       if(aprovar){
        o.status='pago';
        if(b.deliver!==false){
         const proprias=String(b.keys||'').split('|').map(s=>s.trim()).filter(Boolean).slice(0,20);
         o.keys=proprias.length?proprias:o.items.map(()=> 'LEG-'+Math.random().toString(36).slice(2,10).toUpperCase());
         o.status='entregue';
        }
       }else if(o.status!=='entregue'){
        o.status='aguardando';
       }
       await redis.set(guard);
       return ok(res,{ok:true,status:o.status,keys:o.keys||[]});
      }

      if(b.action==='changePass'){
       // rotacao de senha: exige a senha antiga e grava a nova
       if(!guard) return bad(res,404,'Loja ainda nao publicada no banco');
       const novo=String(b.newHash||'');
       if(!novo) return bad(res,400,'Senha nova invalida');
       if(guard.passHash&&guard.passHash!==String(b.oldHash||'')) return bad(res,403,'Senha atual incorreta');
       guard.passHash=novo;
       guard.passChangedAt=Date.now();
       await redis.set(guard);
       return ok(res,{ok:true});
      }

      // sem action: e apenas a checagem de senha do login
      if(!guard) return ok(res,{ok:true,first:true,remote:false});
      if(!guard.passHash) return ok(res,{ok:true,first:true,remote:true});
      return ok(res,{ok:true,first:false,remote:true});
    }

    if(req.method==='PUT'){
      const {passHash,data}=req.body||{};
      if(!passHash) return bad(res,401,'Sem credencial');
      if(!data||typeof data!=='object') return bad(res,400,'Dados invalidos');
      const atual=await redis.get();
      const current=(atual&&typeof atual==='object')?atual:{};
      if(current.passHash&&current.passHash!==passHash) return bad(res,403,'Senha incorreta');
      for(const t of TABLES) if(data[t]!==undefined) current[t]=data[t];
      if(data._v!==undefined) current._v=data._v;
      if(data._rev!==undefined) current._rev=Number(data._rev)||0;
      current._syncedRev=current._rev;
      current.passHash=passHash;
      current.updatedAt=Date.now();
      await redis.set(current);
      return ok(res,{ok:true,updatedAt:current.updatedAt});
    }

    return bad(res,405,'Metodo nao permitido');
  }catch(e){
    return bad(res,500,String(e&&e.message?e.message:e));
  }
}
