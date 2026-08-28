const BIRD='https://public-api.birdeye.so';
const DEX='https://api.dexscreener.com';
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(n)));
const money=n=>{n=num(n);return n>=1e9?`$${(n/1e9).toFixed(2)}B`:n>=1e6?`$${(n/1e6).toFixed(2)}M`:n>=1e3?`$${(n/1e3).toFixed(1)}K`:`$${n.toFixed(0)}`};
const hdr=k=>({'X-API-KEY':k,'x-chain':'solana','accept':'application/json'});
async function get(u,h={}){const r=await fetch(u,{headers:h,cache:'no-store'});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={}}if(!r.ok){const e=new Error(`HTTP ${r.status}`);e.status=r.status;throw e}return j}
function age(ts){if(!ts)return'—';const n=num(ts);const ms=n>1e12?Date.now()-n:Date.now()-n*1000;if(!Number.isFinite(ms)||ms<0)return'—';const m=Math.floor(ms/60000);return m<60?`${m}m`:m<1440?`${Math.floor(m/60)}h`:`${Math.floor(m/1440)}d`}
function score(p,sm=null){
 const mc=num(p.marketCap||p.market_cap||p.fdv),liq=num(p.liquidity||p.liquidity_usd),v5=num(p.volume_5m_usd||p.volume5m||p.volume?.m5),v1=num(p.volume_1h_usd||p.volume1h||p.volume?.h1),pc5=num(p.price_change_5m_percent||p.priceChange5mPercent||p.priceChange?.m5),pc1=num(p.price_change_1h_percent||p.priceChange1hPercent||p.priceChange?.h1),buys=num(p.buy_1h||p.buy1h||p.txns?.h1?.buys),sells=num(p.sell_1h||p.sell1h||p.txns?.h1?.sells),trades5=num(p.trade_5m_count||p.trade5m_count||p.txns?.m5?.buys)+num(p.txns?.m5?.sells),pressure=buys+sells?buys/(buys+sells):.5;
 const demand=clamp(44+(pressure-.5)*45+Math.min(18,pc5*.45)+Math.min(18,pc1*.3)+Math.min(12,Math.log10(v5+1)*2.8)+Math.min(8,trades5/10));
 const late=pc5>30&&pc1>80;
 const structure=clamp(62+Math.min(18,pc1*.35)+Math.min(12,pc5*.25)-(late?22:0));
 let smart=0;if(sm){const n=num(sm.smart_traders_no||sm.smartTradersNo),f=num(sm.net_flow||sm.netFlow);smart=48+Math.min(30,n*6)+(f>0?12:0)}smart=clamp(smart);
 const safety=clamp(62+Math.min(22,liq/9000)),thesis=65,total=clamp(thesis*.28+demand*.25+smart*.22+safety*.18+structure*.07),ver=Boolean(sm),verdict=ver&&smart>=60&&total>=82&&safety>=70&&demand>=65&&!late?'gem':total>=58?'watch':'pass';
 const decision=verdict==='gem'?(late?'Strong setup but extended — wait for reset/reclaim.':'Investigate — independent demand, smart-money and structure signals align.') : verdict==='watch'?(late?'Interesting but late — wait for a reset/reclaim.':'Watch — key confirmation is still missing.'):'Pass — current evidence does not clear the bar.';
 return{mc,liq,v5,v1,pc5,pc1,buys,sells,demand,structure,smart,safety,thesis,total,verdict,late,decision}
}
function coin(p,x,sm){const a=p.address||p.token_address||p.baseToken?.address||p.mint||'';const created=p.recent_listing_time||p.creation_time||p.creationTime||p.created_at||p.pairCreatedAt||0;return{id:a,s:'$'+(p.symbol||p.baseToken?.symbol||'?'),name:p.name||p.baseToken?.name||'Unknown',address:a,mc:x.mc,liq:x.liq,age:age(created),stage:x.mc<250000?'early':x.mc<1000000?'developing':'expansion',narrative:p.description||p.narrative||'Solana meme candidate',thesis:x.thesis,demand:x.demand,smart:x.smart,safety:x.safety,setup:x.structure,score:x.total,verdict:x.verdict,why:x.decision,catalyst:`${money(x.v5)} 5m volume • ${money(x.v1)} 1h volume • ${x.pc5.toFixed(1)}% 5m • ${x.pc1.toFixed(1)}% 1h`,decision:x.decision,invalid:'Thesis failure, demand flip, liquidity deterioration, or suspicious wallet/dev behavior.',watch:false,url:p.url||`https://dexscreener.com/solana/${a}`,intel:{verified:Boolean(sm),summary:sm?'Smart-money cohort match returned by Birdeye.':'No verified smart-money cohort match on the fast scan.'}}}
async function dexFallback(){try{const pr=await get(`${DEX}/token-profiles/latest/v1`);const prof=(Array.isArray(pr)?pr:[]).filter(x=>x.chainId==='solana'&&x.tokenAddress).slice(0,25);const got=await Promise.all(prof.map(async t=>{try{const j=await get(`${DEX}/token-pairs/v1/solana/${t.tokenAddress}`);return(Array.isArray(j)?j:[]).sort((a,b)=>num(b.liquidity?.usd)-num(a.liquidity?.usd))[0]||null}catch{return null}}));return got.filter(Boolean)}catch{return[]}}
function cookie(req,name){const raw=req.headers?.cookie||'';const m=raw.match(new RegExp('(?:^|; )'+name+'=([^;]*)'));return m?decodeURIComponent(m[1]):''}
export default async function handler(req,res){
 res.setHeader('Cache-Control','s-maxage=15, stale-while-revalidate=30');
 try{
  const key=process.env.BIRDEYE_API_KEY||'';
  const sources={dex:false,birdeyeConfigured:Boolean(key),birdeyeAuthStatus:key?'checking':'no-key',tokenListStatus:0,smart:false,smartStatus:key?'not-attempted':'no-key',smartCooldown:false,holder:false,holderStatus:'deep-scan-only',security:false,securityStatus:'deep-scan-only',fresh:false};
  let raw=[];
  if(key){try{await get(`${BIRD}/defi/price?address=So11111111111111111111111111111111111111112`,hdr(key));sources.birdeyeAuthStatus=200}catch(e){sources.birdeyeAuthStatus=e.status||0}}
  if(sources.birdeyeAuthStatus===200){try{const q=new URLSearchParams({source:'all',min_market_cap:'50000',max_market_cap:'5000000',min_liquidity:'5000',min_volume_5m_usd:'500',min_trade_5m_count:'8',limit:'100',offset:'0'});const j=await get(`${BIRD}/defi/v3/token/meme/list?${q}`,hdr(key));raw=j?.data?.items||j?.data||[];sources.tokenListStatus=200}catch(e){sources.tokenListStatus=e.status||0}}
  if(!raw.length){const pairs=await dexFallback();sources.dex=pairs.length>0;raw=pairs.map(p=>({address:p.baseToken?.address,symbol:p.baseToken?.symbol,name:p.baseToken?.name,marketCap:p.marketCap,fdv:p.fdv,liquidity:p.liquidity?.usd,volume_5m_usd:num(p.volume?.m5),volume_1h_usd:num(p.volume?.h1),price_change_5m_percent:num(p.priceChange?.m5),price_change_1h_percent:num(p.priceChange?.h1),trade_5m_count:num(p.txns?.m5?.buys)+num(p.txns?.m5?.sells),buy_1h:num(p.txns?.h1?.buys),sell_1h:num(p.txns?.h1?.sells),url:p.url,pairCreatedAt:p.pairCreatedAt,baseToken:p.baseToken}));}else sources.dex=true;
  raw=raw.filter(p=>{const mc=num(p.marketCap||p.market_cap||p.fdv),liq=num(p.liquidity||p.liquidity_usd),v5=num(p.volume_5m_usd||p.volume?.m5);return mc>=50000&&mc<=5000000&&liq>=5000&&v5>=500}).sort((a,b)=>num(b.volume_5m_usd||b.volume?.m5)-num(a.volume_5m_usd||a.volume?.m5)).slice(0,25);
  let smMap=new Map();
  const until=num(cookie(req,'jarvis_birdeye_cooldown'));
  if(key&&Date.now()<until){sources.smartStatus=429;sources.smartCooldown=true;sources.smartCooldownUntil=new Date(until).toISOString()}
  else if(sources.birdeyeAuthStatus===200){try{const j=await get(`${BIRD}/smart-money/v1/token/list?interval=1d&trader_style=all&sort_by=net_flow&sort_type=desc&offset=0&limit=20`,hdr(key));for(const r of (j?.data?.items||j?.data||[])){const a=r.address||r.token_address||r.tokenAddress||r.mint;if(a)smMap.set(String(a).toLowerCase(),r)}sources.smart=true;sources.smartStatus=200}catch(e){sources.smartStatus=e.status||0;if(e.status===429){const next=Date.now()+10*60*1000;res.setHeader('Set-Cookie',`jarvis_birdeye_cooldown=${next}; Max-Age=600; Path=/; SameSite=Lax`);sources.smartCooldown=true;sources.smartCooldownUntil=new Date(next).toISOString()}}}
  const out=raw.map(p=>{const a=String(p.address||p.token_address||p.baseToken?.address||p.mint||'').toLowerCase();const sm=smMap.get(a)||null;return coin(p,score(p,sm),sm)});
  sources.fresh=true;
  return res.status(200).json({ok:true,generatedAt:new Date().toISOString(),sources,coins:out.sort((a,b)=>{const v={gem:3,watch:2,pass:1};return(v[b.verdict]-v[a.verdict])||(b.score-a.score)||(b.mc-a.mc)}).slice(0,15)});
 }catch(e){return res.status(200).json({ok:false,generatedAt:new Date().toISOString(),sources:{dex:false,birdeyeConfigured:Boolean(process.env.BIRDEYE_API_KEY),fresh:false},error:e?.message||'server error',coins:[]})}
}
