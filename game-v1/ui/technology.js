import {state,screen,textCard,transact} from '../shared.js';
import {catalogue,ensureVillage} from '../systems/village.mjs';
import {research,researchLock} from '../systems/technology.mjs';
import {resourceBar,price,sprite,refreshEconomyUI} from './village.js';
let filter='All',pending=false;
export function refreshTechUI(){document.querySelectorAll('[data-tech]').forEach(b=>{const node=catalogue().research.find(r=>r.id===b.dataset.tech),lock=researchLock(state,node);b.disabled=!!lock;b.textContent=lock||'Research'})}
export function drawTechnology(){
 const v=ensureVillage(state);
 screen.innerHTML='<section class="village-scene">'+sprite('tech')+'<div><strong>研究 <small>yán jiū</small></strong><p>'+v.research.length+' / '+catalogue().research.length+' plans · choose your path</p></div></section>'+resourceBar()+'<div class="path-filter">'+['All','Trade','Community','Study'].map(p=>'<button data-path="'+p+'" aria-pressed="'+(p===filter)+'">'+p+'</button>').join('')+'</div><div class="village-scroll" id="tech-list">'+catalogue().research.filter(r=>filter==='All'||r.path===filter).map(r=>'<section class="shop-row '+(v.research.includes(r.id)?'researched':'')+'">'+sprite('tech')+'<div class="shop-copy">'+textCard(r)+'<small>L'+r.level+' · '+r.path+' · '+r.id+'</small><div class="price">'+price(r.cost)+'</div><small>'+(r.previous?r.previous+' → ':'')+r.id+' → '+r.building+'</small></div><button class="buy" data-tech="'+r.id+'">Research</button></section>').join('')+'</div>';
 screen.querySelectorAll('[data-path]').forEach(b=>b.onclick=()=>{filter=b.dataset.path;drawTechnology()});
 screen.querySelectorAll('[data-tech]').forEach(b=>b.onclick=async()=>{if(pending)return;pending=true;try{const top=screen.querySelector('#tech-list').scrollTop;await transact(s=>research(s,b.dataset.tech));drawTechnology();screen.querySelector('#tech-list').scrollTop=top}finally{pending=false}});
 refreshEconomyUI();refreshTechUI();
}
