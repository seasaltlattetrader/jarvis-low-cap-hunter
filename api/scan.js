const BIRD='https://public-api.birdeye.so';
const DEX='https://api.dexscreener.com';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(n)));
const money=n=>{n=num(n);return n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(0)}`};
const hdr=k=>({'X-API-KEY':k,'x-chain':'solana','accept':'application/json'});
async function get(u,h={}){const r=await fetch(u,{headers:h,cache:'no-store'});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={}}if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}return j}
function age(ts){if(!ts)return'—';const n=num(ts);const ms=Date.now()-(n>1e12?n:n*1000);if(!Number.isFinite(ms)||ms<0)return'—';const m=Math.floor(ms/60000);return m<60?`${m}m`:m<1440?`${Math.floor(m/60)}h`:`${Math.floor(m/1440)}d`}
function score(p){
 const mc=num(p.marketCap||p.market_cap||p.fdv),liq=num(p.liquidity||p.liquidity_usd),v5=num(p.volume_5m_usd||p.volume5m||p.volume?.m5),v1=num(p.volume_1h_usd||p.volume1h||p.volume?.h1),pc5=num(p.price_change_5m_percent||p.priceChange5mPercent||p.priceChange?.m5),pc1=num(p.price_change_1h_percent||p.priceChange1hPercent||p.priceChange?.h1),buys=num(p.buy_1h||p.buy1h||p.txns?.h1?.buys),sells=num(p.sell_1h||p.sell1h||p.txns?.h1?.sells),t5=num(p.trade_5m_count||p.trade5m_count||p.txns?.m5?.buys)+num(p.txns?.m5?.sells),pressure=buys+sells?buys/(buys+sells):.5;
 const momentum=clamp(44+(pressure-.5)*45+Math.min(18,pc5*.45)+Math.min(18,pc1*.3)+Math.min(12,Math.log10(v5+1)*2.8)+Math.min(8,t5/10));
 const late=pc5>30&&pc1>80;
 const structure=clamp(62+Math.min(18,pc1*.35)+Math.min(12,pc5*.25)-(late?22:0));
 const liquidity=clamp(58+Math.min(30,liq/9000));
 const thesis=clamp(Boolean(p.description||p.narrative||p.symbol||p.name)?65:45);
 const total=clamp(thesis*.32+momentum*.30+liquidity*.23+structure*.15);
 const verdict=total>=78&&!late?'investigate':total>=58?'watch':'pass';
 const decision=verdict==='investigate'?(late?'BUY SETUP invalid — extended. Wait for reset/reclaim.':'BUY SETUP — thesis, demand, liquidity and structure align. Verify wallets before entry.') : verdict==='watch'?(late?'Watch — interesting but late. Wait for reset/reclaim.':'WATCH — promising, but not enough confluence for a buy setup.'):'PASS — current evidence does not clear the bar.';
 return{mc,liq,v5,v1,pc5,pc1,buys,sells,momentum,liquidity,structure,thesis,total,verdict,late,decision}
}
function coin(p,x){const a=p.address||p.token_address||p.baseToken?.address||p.mint||'';return{id:a,s:'$'+(p.symbol||p.baseToken?.symbol||'?'),name:p.name||p.baseToken?.name||'Unknown',address:a,mc:x.mc,liq:x.liq,age:age(p.recent_listing_time||p.creation_time||p.creationTime||p.created_at||p.pairCreatedAt||0),stage:x.mc<250000?'early':x.mc<1000000?'developing':'expansion',narrative:p.description||p.narrative||'Solana meme candidate',thesis:x.thesis,demand:x.momentum,safety:x.liquidity,setup:x.structure,score:x.total,verdict:x.verdict,why:x.decision,catalyst:`${money(x.v5)} 5m volume • ${money(x.v1)} 1h volume • ${x.pc5.toFixed(1)}% 5m • ${x.pc1.toFixed(1)}% 1h`,decision:x.decision,invalid:'Thesis failure, demand flip, liquidity deterioration, or suspicious wallet/dev behavior.',watch:false,url:p.url||`https://dexscreener.com/solana/${a}`,intel:{verified:false,summary:'Smart-money is intentionally manual in this JARVIS build. Verify profitable-wallet accumulation before entry.'}}}
async function dexFallback(){try{const pr=await get(`${DEX}/token-profiles/latest/v1`);const prof=(Array.isArray(pr)?pr:[]).filter(x=>x.chainId==='solana'&&x.tokenAddress).slice(0,30);const got=await Promise.all(prof.map(async t=>{try{const j=await get(`${DEX}/token-pairs/v1/solana/${t.tokenAddress}`);return(Array.isArray(j)?j:[]).sort((a,b)=>num(b.liquidity?.usd)-num(a.liquidity?.usd))[0]||null}catch{return null}}));return got.filter(Boolean)}catch{return[]}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=20, stale-while-revalidate=60');
 try{
  const key=process.env.BIRDEYE_API_KEY||'';
  const sources={dex:false,birdeyeConfigured:Boolean(key),birdeyeAuthStatus:key?'checking':'no-key',tokenListStatus:0,smartMoney:'manual',holderSecurity:'manual',fresh:false};
  let raw=[];
  if(key){try{await get(`${BIRD}/defi/price?address=So11111111111111111111111111111111111111112`,hdr(key));sources.birdeyeAuthStatus=200}catch(e){sources.birdeyeAuthStatus=e.status||0}}
  if(sources.birdeyeAuthStatus===200){try{const q=new URLSearchParams({source:'all',min_market_cap:'50000',max_market_cap:'5000000',min_liquidity:'5000',min_volume_5m_usd:'500',min_trade_5m_count:'8',limit:'100',offset:'0'});const j=await get(`${BIRD}/defi/v3/token/meme/list?${q}`,hdr(key));raw=j?.data?.items||j?.data||[];sources.tokenListStatus=200}catch(e){sources.tokenListStatus=e.status||0}}
  if(!raw.length){const pairs=await dexFallback();sources.dex=pairs.length>0;raw=pairs.map(p=>({address:p.baseToken?.address,symbol:p.baseToken?.symbol,name:p.baseToken?.name,marketCap:p.marketCap,fdv:p.fdv,liquidity:p.liquidity?.usd,volume_5m_usd:num(p.volume?.m5),volume_1h_usd:num(p.volume?.h1),price_change_5m_percent:num(p.priceChange?.m5),price_change_1h_percent:num(p.priceChange?.h1),trade_5m_count:num(p.txns?.m5?.buys)+num(p.txns?.m5?.sells),buy_1h:num(p.txns?.h1?.buys),sell_1h:num(p.txns?.h1?.sells),pairCreatedAt:p.pairCreatedAt,url:p.url,baseToken:p.baseToken}))}else sources.dex=true;
  raw=raw.filter(p=>{const mc=num(p.marketCap||p.market_cap||p.fdv),liq=num(p.liquidity||p.liquidity_usd),v5=num(p.volume_5m_usd||p.volume?.m5);return mc>=50000&&mc<=5000000&&liq>=5000&&v5>=500}).sort((a,b)=>num(b.volume_5m_usd||b.volume?.m5)-num(a.volume_5m_usd||a.volume?.m5)).slice(0,25);
  const out=raw.map(p=>coin(p,score(p))).sort((a,b)=>{const v={investigate:3,watch:2,pass:1};return(v[b.verdict]-v[a.verdict])||(b.score-a.score)}).slice(0,15);
  sources.fresh=true;
  return res.status(200).json({ok:true,generatedAt:new Date().toISOString(),sources,coins:out});
 }catch(e){return res.status(200).json({ok:false,generatedAt:new Date().toISOString(),sources:{dex:false,birdeyeConfigured:Boolean(process.env.BIRDEYE_API_KEY),smartMoney:'manual',holderSecurity:'manual',fresh:false},error:e?.message||'server error',coins:[]})}
}
