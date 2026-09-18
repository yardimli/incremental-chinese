// Pure village transactions. UI and timers never mutate resource balances directly.
let data={buildings:[],research:[],resources:[],progression:{baseCoins:10,growth:1.6,copyGrowth:1.18,copyDiminish:.7,baseLand:4,offlineHours:8,gates:[]}};
export function configureVillage(config){data=config}
export const catalogue=()=>data;
export function ensureVillage(s){
 s.village??={buildings:{},research:[],resources:{},lastAccrual:s.lastAccrual,active:[],passive:[]};
 for(const r of data.resources)s.village.resources[r.id]??=0;
 return s.village;
}
export const frontier=s=>Math.max(0,...s.completed.filter(id=>/^L\d+$/.test(id)).map(id=>Number(id.slice(1))));
export const base=n=>Math.round(data.progression.baseCoins*data.progression.growth**Math.max(0,n-1));
export const capacity=(s,id)=>data.resources.find(r=>r.id===id).cap*(1+(ensureVillage(s).buildings.I04||0));
export const land=s=>data.progression.baseLand+Math.min(data.progression.maxLevel||25,frontier(s));
export const usedLand=s=>Object.values(ensureVillage(s).buildings).reduce((a,b)=>a+b,0)+(s.village.installment?1:0);
export function activeBuildings(s){
 const v=ensureVillage(s),active=[];
 for(const b of [...data.buildings].sort((a,b)=>a.level-b.level)){
  if(!v.buildings[b.id])continue;
  if(b.research&&b.level>=7&&!active.some(p=>p.path===b.path&&p.level<b.level))continue;
  active.push(b);
 }
 return active;
}
export function multiplier(s,scope){
 const v=ensureVillage(s),active=activeBuildings(s);
 let contribution=0;
 for(const b of active.filter(b=>b.scope===scope))for(let i=0;i<v.buildings[b.id];i++)contribution+=b.contribution*data.progression.copyDiminish**i;
 const h=frontier(s),paths=new Set(active.filter(b=>b.research).map(b=>b.path));let synergy=0;
 if(h>=8&&paths.size>=2)synergy+=.1;
 if(h>=12&&[...paths].some(p=>{const types=active.filter(b=>b.path===p);return types.length>=4&&types.some(b=>v.buildings[b.id]>=2)}))synergy+=.15;
 if(h>=18&&paths.size===3)synergy+=.15;
 if(h>=25&&(active.filter(b=>b.research).length>=12||[...paths].some(p=>active.filter(b=>b.path===p).length>=8)))synergy+=.2;
 return (1+contribution)*(1+synergy);
}
export function recordActive(s,amount,now=Date.now()){
 const v=ensureVillage(s);v.active=v.active.filter(e=>e.time>now-86400000);
 const bucket=Math.floor(now/60000)*60000,last=v.active.at(-1);
 if(last?.time===bucket)last.amount+=amount;else v.active.push({time:bucket,amount});
 s.coins+=amount;
}
export function rates(s){
 const v=ensureVillage(s),out={};
 for(const b of activeBuildings(s))for(const [id,n] of Object.entries(b.output))out[id]=(out[id]||0)+n*v.buildings[b.id];
 return out;
}
export function accrueVillage(s,now=Date.now()){
 const v=ensureVillage(s),elapsed=Math.min(data.progression.offlineHours*3600000,Math.max(0,now-v.lastAccrual));
 const output=rates(s),before={...v.resources};let remaining=elapsed/60000;
 // Minute slices respect kiln inputs, concurrent producers and capacity, bounded to 480 steps.
 while(remaining>1e-9){
  const dt=Math.min(1,remaining);remaining-=dt;
  for(const r of data.resources.filter(r=>r.id!=='bricks'))if(frontier(s)>=r.level)v.resources[r.id]=Math.max(v.resources[r.id],Math.min(capacity(s,r.id),v.resources[r.id]+(output[r.id]||0)*dt));
  const bricks=Math.max(0,Math.min((output.bricks||0)*dt,v.resources.timber/2,v.resources.stone/2,capacity(s,'bricks')-v.resources.bricks));
  v.resources.bricks+=bricks;v.resources.timber-=bricks*2;v.resources.stone-=bricks*2;
 }
 v.active=v.active.filter(e=>e.time>now-86400000);v.passive=v.passive.filter(e=>e.time>now-86400000);
 const allowance=Math.max(0,v.active.reduce((n,e)=>n+e.amount,0)*.1-v.passive.reduce((n,e)=>n+e.amount,0));
 const coins=Math.min(allowance,(output.coins||0)*elapsed/60000);s.coins+=coins;
 if(coins){const bucket=Math.floor(now/60000)*60000,last=v.passive.at(-1);if(last?.time===bucket)last.amount+=coins;else v.passive.push({time:bucket,amount:coins})}
 v.lastAccrual=Math.max(v.lastAccrual,now);
 return {coins,resources:Object.fromEntries(data.resources.map(r=>[r.id,v.resources[r.id]-before[r.id]]))};
}
export const buildingCost=(s,b)=>Object.fromEntries(Object.entries(b.cost).map(([k,n])=>[k,n?Math.ceil(n*data.progression.copyGrowth**(ensureVillage(s).buildings[b.id]||0)):0]));
export const canPay=(s,cost)=>Object.entries(cost).every(([id,n])=>(id==='coins'?s.coins:ensureVillage(s).resources[id]||0)+1e-8>=n);
export function pay(s,cost){for(const [id,n] of Object.entries(cost))if(id==='coins')s.coins-=n;else s.village.resources[id]-=n}
export function buildingLock(s,b){
 const v=ensureVillage(s);
 if(frontier(s)<b.level)return 'Clear L'+b.level;
 if(b.sentence&&!s.completed.some(id=>id.startsWith('S')))return 'Complete a sentence set';
 if(b.research&&!v.research.includes(b.research))return b.research;
 if(b.storage&&v.installment)return 'Finish expansion';
 if(b.research&&b.level>=7&&!activeBuildings(s).some(p=>p.path===b.path&&p.level<b.level))return 'Earlier '+b.path+' building';
 if(usedLand(s)>=land(s))return 'Land full';
 if(!canPay(s,buildingCost(s,b)))return 'Need resources';
 return '';
}
export function buyBuilding(s,id){const b=data.buildings.find(b=>b.id===id);if(!b||buildingLock(s,b))return false;pay(s,buildingCost(s,b));s.village.buildings[id]=(s.village.buildings[id]||0)+1;return true}
export function demolish(s,id){const v=ensureVillage(s);if(!v.buildings[id])return false;v.buildings[id]--;return true}
export function fundStorage(s){
 const v=ensureVillage(s),b=data.buildings.find(b=>b.storage);
 if(frontier(s)<b.level||(!v.installment&&usedLand(s)>=land(s)))return false;
 v.installment??={remaining:buildingCost(s,b)};
 for(const [id,n] of Object.entries(v.installment.remaining)){const paid=Math.min(n,id==='coins'?s.coins:v.resources[id]);pay(s,{[id]:paid});v.installment.remaining[id]-=paid}
 if(Object.values(v.installment.remaining).every(n=>n<1e-8)){v.buildings[b.id]=(v.buildings[b.id]||0)+1;delete v.installment}
 return true;
}
export function exchange(s,id,quantity){
 const r=data.resources.find(r=>r.id===id);
 if(!r?.exchange||frontier(s)<r.level||!Number.isInteger(quantity)||quantity<=0)return false;
 const price=r.exchange*base(frontier(s))*quantity;
 if(s.coins<price||ensureVillage(s).resources[id]+quantity>capacity(s,id))return false;
 s.coins-=price;s.village.resources[id]+=quantity;return true;
}
export function gateStatus(s,n){
 const v=ensureVillage(s),g=data.progression.gates.find(g=>g.level===n);if(!g)return [];
 const active=activeBuildings(s).filter(b=>b.research),strength=active.reduce((sum,b)=>sum+Math.min(3,v.buildings[b.id]),0);
 return [
  {label:'Village strength',have:strength,need:g.strength,help:`Reach ${g.strength} village strength. Build researched buildings in the Village tab. Each active copy adds 1 strength, up to 3 copies of each building type. Infrastructure such as resource yards and storage does not count. Researching a blueprint alone does not add strength: you must build it. Dormant buildings do not count; restore an earlier building on their path to activate them.`},
  {label:'Research',have:v.research.length,need:g.research,help:`Complete ${g.research} research ${g.research===1?'plan':'plans'} in this prestige run. Open Tech, choose an available plan and pay its knowledge and insight cost. These resources come from buildings, not the exchange. Start with the study hut for knowledge; later insight-producing buildings supply insight. Some plans require earlier research. Any path counts, and each plan counts once. You do not need to research every plan.`},
  {label:'Sentence sets',have:s.completed.filter(id=>id.startsWith('S')).length,need:g.sentences,help:g.sentences?`Complete and claim the rewards for ${g.sentences} sentence sets in this prestige run. Sentence sets appear during the main Play journey: arrange the Chinese cards to form each sentence and finish the set. A set must meet the 50% accuracy requirement to complete. Individual sentences, Memory and bonus puzzles do not count as completed sentence sets.`:'No completed sentence sets are required at this stage, so this goal is already checked. Later stages require sentence sets from the main Play journey. Finish their card-order puzzles and claim the set reward; individual sentences, Memory and bonus puzzles do not count.'},
  {label:'Building from L'+g.recentFrom+'–'+n,have:active.some(b=>b.level>=g.recentFrom&&b.level<=n)?1:0,need:1,help:`Own at least one active researched building whose unlock level is between L${g.recentFrom} and L${n}, inclusive. Check the L number beside buildings in Village, research an eligible building's blueprint in Tech, then build it with coins and materials. Infrastructure does not count, and owning only the blueprint is not enough. A dormant building must be reactivated by restoring an earlier building on its path. The same building can also contribute to Village strength.`}
 ];
}
