import {state,lessons,tokens,screen,word,hanzi,textCard,wrapNumberLabel,dictionary,transact,go,refreshNumbers,speech,gameClock,esc,$,setDebugAction} from '../shared.js';
import * as E from '../engine.mjs';
import {bindPairDrag} from '../pair-drag.js';
import {mountBattle} from '../battle-arena.js';
import {scatterCards} from '../arena-layout.mjs';
import {englishCardLabel} from '../card-labels.mjs';
const setTimeout=(...args)=>gameClock.setTimeout(...args),clearTimeout=(...args)=>gameClock.clearTimeout(...args);
let busy=false,selected=null,placed=[],dragIndex=null,feedbackTimer,arenaTimer,arenaActivity,battle,pairActivity,bonusQ=null;
export function drawBonus(){
 pairActivity?.abort();pairActivity=new AbortController();
 const unlocked=lessons.slice(0,state.setIndex+1).filter(x=>x.type==='pairs').flatMap(x=>x.pairs).filter(w=>state.seen.includes(w.id)||Object.values(state.cards).some(ids=>ids.includes(w.id)));
 if(!unlocked.length){screen.innerHTML='<section class="panel"><p>Discover some pairs in Play first.</p></section><a class="primary" href="home.html">Play</a>';return}
 if(!bonusQ){const rng={rng:Date.now()>>>0},w=E.shuffle(rng,unlocked)[0];bonusQ={id:w.id,options:E.shuffle(rng,[w,...E.shuffle(rng,unlocked.filter(p=>p.id!==w.id&&(w.number===undefined||p.number!==w.number))).slice(0,3)])}}
 screen.innerHTML='<p class="practice-note">You can stop at any time. Coins you earn are yours to keep.</p><div class="prompt bonus-target">'+textCard(word(bonusQ.id))+'</div><div class="english-choices">'+bonusQ.options.map(w=>'<button class="primary" data-bonus="'+w.id+'">'+wrapNumberLabel(englishCardLabel(w))+'</button>').join('')+'</div><div class="status" role="status"></div>';
 screen.querySelectorAll('[data-bonus]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;const right=b.dataset.bonus===bonusQ.id;if(right)await transact(s=>E.award(s,'W',.1));$('.status').textContent=right?'+'+E.permanent(state):word(bonusQ.id).english;feedbackTimer=setTimeout(()=>{busy=false;bonusQ=null;drawBonus()},700)});
 setDebugAction(()=>screen.querySelector('[data-bonus="'+bonusQ.id+'"]').click());
 const target=screen.querySelector('.bonus-target');
 const answers=[...screen.querySelectorAll('[data-bonus]')];
 answers.forEach(card=>bindPairDrag(card,{signal:pairActivity.signal,enabled:()=>!busy,getTargets:()=>[target],onDrop:()=>card.click()}));
 if(target)bindPairDrag(target,{signal:pairActivity.signal,enabled:()=>!busy,getTargets:()=>answers,onDrop:card=>card.click()});
}

export function dispose(){pairActivity?.abort();battle?.dispose();arenaActivity?.abort();clearTimeout(feedbackTimer);clearTimeout(arenaTimer)}
