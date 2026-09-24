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
      // confere a senha do staff contra o hash guardado no servidor
      const passHash=String((req.body||{}).passHash||'');
      if(!passHash) return bad(res,401,'Sem credencial');
      const current=await redis.get();
      if(!current||typeof current!=='object') return ok(res,{ok:true,first:true,remote:false});
      if(!current.passHash) return ok(res,{ok:true,first:true,remote:true});
      return ok(res,{ok:current.passHash===passHash,first:false,remote:true});
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
