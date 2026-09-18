import {state,lessons,tokens,screen,word,hanzi,textCard,wrapNumberLabel,dictionary,transact,go,refreshNumbers,speech,gameClock,esc,$,setDebugAction} from '../shared.js';
import * as E from '../engine.mjs';
import {bindPairDrag} from '../pair-drag.js';
import {mountBattle} from '../battle-arena.js';
import {scatterCards} from '../arena-layout.mjs';
import {englishCardLabel} from '../card-labels.mjs';
const setTimeout=(...args)=>gameClock.setTimeout(...args),clearTimeout=(...args)=>gameClock.clearTimeout(...args);
let busy=false,selected=null,placed=[],dragIndex=null,feedbackTimer,arenaTimer,arenaActivity,battle,pairActivity,bonusQ=null;
export function drawMatch(){
 busy=false;selected=null;
 pairActivity?.abort();pairActivity=new AbortController();
 const ids=E.matchBoard(state);
 setDebugAction(()=>{const id=ids.find(id=>!state.matchFound.includes(id));if(!id)return;selected=null;screen.querySelector('[data-side="cn"][data-id="'+id+'"]').click();screen.querySelector('[data-side="en"][data-id="'+id+'"]').click()});
 // Stable order survives rewards and reloads, without modifying the save.
 const order=E.shuffle({rng:state.prestige*10007+state.setIndex*101+state.pageIndex+17},ids);
 screen.innerHTML='<div class="instruction">Tap two cards or drag one onto its pair.</div><div class="match-head"><span>Chinese</span><span>English</span></div><div class="match-board">'+ids.map((id,i)=>'<button class="match-tile '+(state.matchFound.includes(id)?'matched':'')+'" data-side="cn" data-id="'+id+'" '+(state.matchFound.includes(id)?'disabled':'')+'>'+textCard(word(id))+'</button><button class="match-tile '+(state.matchFound.includes(order[i])?'matched':'')+'" data-side="en" data-id="'+order[i]+'" '+(state.matchFound.includes(order[i])?'disabled':'')+'>'+wrapNumberLabel(englishCardLabel(word(order[i])))+'</button>').join('')+'</div><div class="status" role="status" aria-live="polite"></div>';
 $('.match-board').onclick=async e=>{
  const b=e.target.closest('button');if(!b||b.disabled||busy)return;
  if(!selected||selected.dataset.side===b.dataset.side){selected?.classList.remove('selected');selected=b;b.classList.add('selected');return}
  const a=selected;selected=null;submitPair(a,b);
 };
 async function submitPair(a,b){
  if(busy||a.disabled||b.disabled)return;busy=true;selected?.classList.remove('selected');selected=null;
  const {result}=await transact(s=>E.matchPair(s,lessons,a.dataset.id,b.dataset.id));
  if(!result){go();return}
  if(!result.correct){[a,b].forEach(n=>{n.classList.remove('selected');n.classList.add('wrong')});$('.status').textContent='Try another pair.';feedbackTimer=setTimeout(()=>{busy=false;drawMatch()},650)}
  else {[a,b].forEach(n=>{n.classList.remove('selected');n.classList.add('matched');n.disabled=true});$('.status').textContent='+'+result.points;feedbackTimer=setTimeout(go,550)}
 };
 screen.querySelectorAll('.match-tile').forEach(card=>bindPairDrag(card,{
  signal:pairActivity.signal,enabled:()=>!busy,
  getTargets:()=>[...screen.querySelectorAll('.match-tile')].filter(el=>el.dataset.side!==card.dataset.side),
  onDrop:other=>submitPair(card,other)
 }));
}

export function dispose(){pairActivity?.abort();battle?.dispose();arenaActivity?.abort();clearTimeout(feedbackTimer);clearTimeout(arenaTimer)}
