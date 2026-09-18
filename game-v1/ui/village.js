import {state,screen,textCard,transact,esc} from '../shared.js';
import * as V from '../systems/village.mjs';
export const sprite=id=>'<i aria-hidden="true" class="sprite sprite-'+id+'"></i>';
export function price(cost){return Object.entries(cost).filter(([,n])=>n>0).map(([id,n])=>'<span>'+sprite(id)+Math.ceil(n).toLocaleString()+'</span>').join('')}
export function resourceBar(){return '<div class="resource-bar">'+V.catalogue().resources.map(r=>'<div title="'+esc(r.pinyin)+'">'+sprite(r.id)+'<span class="resource-name">'+textCard(r)+'</span><b data-resource="'+r.id+'">0</b><small data-production="'+r.id+'"></small></div>').join('')+'</div>'}
let view='build',filter='All',pending=false;
export function refreshEconomyUI(){
 if(!state)return;const v=V.ensureVillage(state),rates=V.rates(state);
 document.querySelectorAll('[data-resource]').forEach(n=>n.textContent=Math.floor(v.resources[n.dataset.resource]).toLocaleString()+' / '+V.capacity(state,n.dataset.resource));
 document.querySelectorAll('[data-production]').forEach(n=>n.textContent='+'+(rates[n.dataset.production]||0).toFixed(2)+'/min');
 document.querySelectorAll('[data-building]').forEach(n=>{const b=V.catalogue().buildings.find(b=>b.id===n.dataset.building),reason=V.buildingLock(state,b);n.disabled=!!reason;n.textContent=reason||'Build';n.title=reason});
 document.querySelectorAll('[data-exchange]').forEach(n=>{const r=V.catalogue().resources.find(r=>r.id===n.dataset.exchange),q=Number(n.dataset.quantity);n.disabled=V.frontier(state)<r.level||state.coins<q*r.exchange*V.base(V.frontier(state))||v.resources[r.id]+q>V.capacity(state,r.id)});
}
export function drawVillage(){
 const v=V.ensureVillage(state),catalogue=V.catalogue(),active=new Set(V.activeBuildings(state).map(b=>b.id));
 screen.innerHTML='<section class="village-scene">'+sprite('village')+'<div><strong>村落 <small>cūn luò</small></strong><p>'+V.usedLand(state)+' / '+V.land(state)+' land · ×'+V.multiplier(state,'W').toFixed(2)+' hits</p></div></section>'+resourceBar()+'<div class="compact-tabs"><button data-view="build" aria-pressed="'+(view==='build')+'">Build</button><button data-view="exchange" aria-pressed="'+(view==='exchange')+'">Exchange</button></div><div class="village-scroll" id="village-list"></div>';
 const list=screen.querySelector('#village-list');
 if(view==='exchange')list.innerHTML='<p class="small">Coins → materials. Research comes from buildings.</p>'+catalogue.resources.filter(r=>r.exchange).map(r=>'<section class="shop-row">'+sprite(r.id)+'<div>'+textCard(r)+'<small>'+r.exchange*V.base(V.frontier(state))+' coins / 1</small></div><div class="exchange-buttons">'+[1,10].map(q=>'<button class="buy" data-exchange="'+r.id+'" data-quantity="'+q+'">+'+q+'</button>').join('')+'</div></section>').join('');
 else {
  list.innerHTML='<div class="path-filter">'+['All','Infrastructure','Trade','Community','Study'].map(p=>'<button data-filter="'+p+'" aria-pressed="'+(p===filter)+'">'+(p==='Infrastructure'?'Supply':p)+'</button>').join('')+'</div>'+catalogue.buildings.filter(b=>filter==='All'||b.path===filter).map(b=>{
   const count=v.buildings[b.id]||0,rate=Object.entries(b.output).filter(([,n])=>n>0).map(([id,n])=>sprite(id)+'+'+n+'/min').join(' ');
   return '<section class="shop-row '+(count&&!active.has(b.id)?'dormant':'')+'">'+sprite(b.path==='Infrastructure'?(b.storage?'storage':Object.keys(b.output)[0]):'village')+'<div class="shop-copy"><div class="shop-name">'+textCard(b)+'<b>×'+count+'</b></div><small>L'+b.level+' · '+b.path+(b.scope?' · +'+b.contribution+'× '+({W:'hits',M:'pairs',S:'sentences'}[b.scope]):'')+'</small><div class="production">'+rate+(b.id==='I05'?' · −4 木材 −4 石料/min':'')+'</div><div class="price">'+price(V.buildingCost(state,b))+'</div>'+(count&&!active.has(b.id)?'<small>Restore an earlier '+b.path+' building</small>':'')+'</div><div class="shop-actions"><button class="buy" data-building="'+b.id+'">Build</button>'+(count?'<button class="demolish" data-remove="'+b.id+'" aria-label="Demolish one '+b.id+'">−1</button>':'')+'</div></section>';
  }).join('')+'<section class="storage-fund"><h3>Storage expansion</h3><p class="small">Pay in parts when the next storehouse costs more than you can hold. Payments are nonrefundable.</p>'+(v.installment?'<div class="price">Remaining '+price(v.installment.remaining)+'</div>':'')+'<button class="buy" id="fund-storage" '+(V.frontier(state)<2?'disabled':'')+'>Fund next storehouse</button>'+(v.installment?'<button class="demolish" id="cancel-storage">Cancel · lose payments</button>':'')+'</section>';
 }
 screen.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;drawVillage()});
 screen.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;drawVillage()});
 async function action(fn){if(pending)return;pending=true;try{await transact(fn);const top=list.scrollTop;drawVillage();screen.querySelector('#village-list').scrollTop=top}finally{pending=false}}
 screen.querySelectorAll('[data-building]').forEach(b=>b.onclick=()=>action(s=>V.buyBuilding(s,b.dataset.building)));
 screen.querySelectorAll('[data-exchange]').forEach(b=>b.onclick=()=>action(s=>V.exchange(s,b.dataset.exchange,Number(b.dataset.quantity))));
 screen.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{b.textContent='Confirm?';b.onclick=()=>action(s=>V.demolish(s,b.dataset.remove))});
 screen.querySelector('#fund-storage')?.addEventListener('click',()=>action(V.fundStorage));
 screen.querySelector('#cancel-storage')?.addEventListener('click',()=>action(s=>delete s.village.installment));
 refreshEconomyUI();
}
