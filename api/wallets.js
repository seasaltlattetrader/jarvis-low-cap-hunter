const RPC='https://api.mainnet-beta.solana.com';
const DEX='https://api.dexscreener.com';
const SOL='So11111111111111111111111111111111111111112';
const STABLE=new Set(['Es9vMFrzaCERmJfrF4H2FYD4QXqK9n8WQ2fP4x7F9Yp','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','7kbnvuGBxxj8AG9iZaKckdtXwz1K6dT7WcX2C5hY6W8u']);
const WATCH=[
 ['MEADGod','2jgmHtkCkJXm3Xq4dp9DgippkQjXLK3rhaREAz7oG7s7'],
 ['DumbCrayonEater','J23qr98GjGJJqKq9CBEnyRhHbmkaVxtTJNNxKu597wsA'],
 ['change','4y2T1ghykCTq4EddoXjptZamk4qAsqcZw6eKxS8jdvE1'],
 ['PoorGoat_','B5TrL7PsRUwCTL5bVcueieht5QchTw4TWLQDKqEaxEzi'],
 ['Salem1299534','AcoNeFQsTPYs7ZrH8RMWaxxGJTTQJJ4H5aTXmptaz5UK'],
 ['frankdegods','EsYapC57ZVREhwM74JckDuAHXBtTg9esTVNixZ3a4TwJ'],
 ['ether_monk','4UrFSCrGxgoCtCUBAEZq7ZmPK3Pczkxx7PwYnkBMi1KR'],
 ['unipcs','2M2vLX34LXMg24dMEnjWHvRXS1tshpEDRWzmXgV8ENNZ'],
 ['Natan_benish','AH39BneW9UeWxQysUcwogQrYFdPvJuRVZ5w4ccq9SKfL'],
 ['brrrgrrrz','4Be9CvxqHW6BYiRAxW9Q3xu1ycTMWaL5z8NX4HR3ha7t']
];
const jrpc=async(method,params,id)=>({jsonrpc:'2.0',id,method,params});
async function batch(reqs){const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(reqs),cache:'no-store'});if(!r.ok)throw new Error(`RPC HTTP ${r.status}`);return r.json()}
function walletIndex(tx,wallet){const keys=tx?.transaction?.message?.accountKeys||[];for(let i=0;i<keys.length;i++){const k=typeof keys[i]==='string'?keys[i]:keys[i]?.pubkey;if(k===wallet)return i}return -1}
function tokenDelta(meta,index){const pre=new Map(),post=new Map();for(const b of (meta?.preTokenBalances||[])){if(b.owner===undefined||String(b.owner)!==String(index))continue;pre.set(`${b.accountIndex}:${b.mint}`,Number(b.uiTokenAmount?.uiAmountString||b.uiTokenAmount?.amount||0))}for(const b of (meta?.postTokenBalances||[])){if(b.owner===undefined)continue;post.set(`${b.accountIndex}:${b.mint}`,Number(b.uiTokenAmount?.uiAmountString||b.uiTokenAmount?.amount||0))}const out=[];const keys=new Set([...pre.keys(),...post.keys()]);for(const k of keys){const [acct,mint]=k.split(':');const d=(post.get(k)||0)-(pre.get(k)||0);if(d)out.push({mint,delta:d})}return out}
function classify(walletName,wallet,tx,signature,blockTime){const meta=tx?.meta;if(!meta)return[];const idx=walletIndex(tx,wallet);if(idx<0)return[];const solDelta=(Number(meta.postBalances?.[idx]||0)-Number(meta.preBalances?.[idx]||0))/1e9;const hasNonSystem=Array.isArray(tx?.transaction?.message?.instructions)&&tx.transaction.message.instructions.some(i=>i?.program&&i.program!=='system');if(!hasNonSystem)return[];return tokenDelta(meta,idx).filter(x=>x.delta>0&&!STABLE.has(x.mint)&&x.mint!==SOL&&solDelta<-0.0002).map(x=>({walletName,wallet,mint:x.mint,tokenDelta:x.delta,solSpent:Math.abs(solDelta),signature,blockTime:((blockTime||0)*1000)}))}
async function tokenMeta(mints){if(!mints.length)return new Map();try{const r=await fetch(`${DEX}/tokens/v1/solana/${mints.slice(0,30).join(',')}`,{cache:'no-store'});if(!r.ok)return new Map();const a=await r.json();const m=new Map();for(const p of(Array.isArray(a)?a:[])){const mint=p?.baseToken?.address;if(mint&&!m.has(mint))m.set(mint,{symbol:p.baseToken.symbol,name:p.baseToken.name,url:p.url,mc:Number(p.marketCap||p.fdv||0),liq:Number(p.liquidity?.usd||0),price:Number(p.priceUsd||0)})}return m}catch{return new Map()}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=8, stale-while-revalidate=15');
 const lookback=Math.min(30,Math.max(5,Number(req.query?.minutes||15)));const per=Math.min(8,Math.max(2,Number(req.query?.txs||6)));
 try{
  const sigReq=WATCH.map(([name,w],i)=>jrpc('getSignaturesForAddress',[w,{limit:per}],`s${i}`));const sigRes=await batch(sigReq);const sigs=[];for(let i=0;i<WATCH.length;i++){const rows=(sigRes.find(x=>x.id===`s${i}`)?.result||[]);for(const row of rows){if(row.err)continue;sigs.push({name:WATCH[i][0],wallet:WATCH[i][1],signature:row.signature,blockTime:row.blockTime||0})}}
  const cutoff=Date.now()-lookback*60*1000;const recent=sigs.filter(x=>(x.blockTime||0)*1000>=cutoff);const unique=[...new Map(recent.map(x=>[x.signature,x])).values()];
  const txRes=unique.map((x,i)=>jrpc('getTransaction',[x.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0}],`t${i}`));const rows=txRes.length?await batch(txRes):[];const buys=[];
  for(let i=0;i<unique.length;i++){const tx=rows.find(x=>x.id===`t${i}`)?.result;buys.push(...classify(unique[i].name,unique[i].wallet,tx,unique[i].signature,unique[i].blockTime))}
  const groups=new Map();for(const b of buys){if(!groups.has(b.mint))groups.set(b.mint,{mint:b.mint,wallets:new Map(),events:[]});const g=groups.get(b.mint);g.wallets.set(b.wallet,b.walletName);g.events.push(b)}
  const meta=await tokenMeta([...groups.keys()]);const convergence=[...groups.values()].map(g=>{const events=g.events.sort((a,b)=>b.blockTime-a.blockTime);const first=Math.min(...events.map(e=>e.blockTime));const latest=Math.max(...events.map(e=>e.blockTime));const walletCount=g.wallets.size;const strength=walletCount>=4?100:walletCount===3?88:walletCount===2?72:50;const md=meta.get(g.mint)||{};return{mint:g.mint,symbol:md.symbol||g.mint.slice(0,6),name:md.name||'Unknown token',url:md.url||`https://dexscreener.com/solana/${g.mint}`,marketCap:md.mc||0,liquidity:md.liq||0,price:md.price||0,walletCount,wallets:[...g.wallets.values()],buyCount:events.length,firstBuy:first,latestBuy:latest,windowMinutes:Math.max(0,(latest-first)/60000),strength,call:walletCount>=3?'HIGH CONVERGENCE':walletCount===2?'CONVERGENCE':'SINGLE WALLET',events:events.slice(0,10).map(e=>({wallet:e.walletName,signature:e.signature,solSpent:e.solSpent,time:e.blockTime}))}}).filter(x=>x.walletCount>=2).sort((a,b)=>b.strength-a.strength||b.latestBuy-a.latestBuy);
  return res.status(200).json({ok:true,generatedAt:new Date().toISOString(),lookbackMinutes:lookback,trackedWallets:WATCH.map(([name,wallet])=>({name,wallet})),convergence});
 }catch(e){return res.status(200).json({ok:false,error:e?.message||'wallet scan failed',trackedWallets:WATCH.map(([name,wallet])=>({name,wallet})),convergence:[]})}
}
