import {state,lessons,screen,textCard,transact,gameClock,word,speech,setDebugAction,esc} from '../shared.js';
import * as M from './memory-state.mjs';
import * as E from '../engine.mjs';
import {catalogue} from '../systems/village.mjs';
let busy=false,timer,boardKey;
function available(){return M.memorySets(state,lessons)}
export function drawMemory(){
 gameClock.clearTimeout(timer);busy=false;const m=state.memory;
 if(!m){
  const sets=available();
  screen.innerHTML='<section class="memory-intro"><i class="sprite sprite-memory"></i><h2>Turn. Remember. Match.</h2><p>Chinese + English · six pairs · 3 × 4 cards</p><p class="practice-note">You can stop at any time. Coins you earn are yours to keep.</p></section><div class="memory-set-list">'+sets.map(s=>'<button class="secondary" data-memory-set="'+s.id+'">'+textCard(s)+'<small>'+s.pairs.length+' cards · +'+E.payout(state,'M',2,s.level)+' / pair</small></button>').join('')+'</div>'+(!sets.length?'<p>Continue Play to unlock a word set.</p>':'')+'<a class="secondary" href="home.html">Back to Play</a>';
  screen.querySelectorAll('[data-memory-set]').forEach(b=>b.onclick=async()=>{await transact(s=>M.startMemory(s,sets.find(x=>x.id===b.dataset.memorySet),catalogue().progression.memoryPairs,sets.flatMap(set=>set.pairs)));drawMemory()});return;
 }
 if(m.complete){screen.innerHTML='<section class="memory-finish"><i class="sprite sprite-memory"></i><h2>Set remembered!</h2><div class="big">'+m.order.length+' pairs</div><p>Coins awarded as you matched.</p><button class="primary" id="memory-again">Choose another set</button><a class="secondary" href="home.html">Continue journey</a></section>';screen.querySelector('#memory-again').onclick=async()=>{await transact(s=>delete s.memory);drawMemory()};return}
 const done=m.found.length===m.deck.length/2;
 const key=JSON.stringify([m.setId,m.offset,m.deck,state.settings.script,state.settings.display]);
 // Keep each card mounted for the whole board. Updating one card must not
 // restart animations (or speech highlights) on its neighbours.
 if(boardKey!==key||!screen.querySelector('.memory-grid')){
  boardKey=key;
  screen.innerHTML='<p class="practice-note">You can stop at any time. Keep your earned coins.</p><div class="memory-top"><span>Board '+(m.boards+1)+' / '+Math.ceil(m.order.length/m.size)+'</span><b data-memory-count></b><button id="memory-back" class="mini-button">Sets</button></div><progress max="'+m.order.length+'"></progress><div class="memory-grid">'+m.deck.map((c,i)=>{
   const w=word(c.id),face=m.found.includes(c.id)||m.open.includes(i);
   return '<button class="memory-card '+(face?'face-up':'')+'" data-flip="'+i+'"><span class="memory-inner"><span class="memory-back" aria-hidden="true"><i class="sprite sprite-cardback"></i></span><span class="memory-front">'+(c.side==='cn'?textCard(w):'<span class="memory-english">'+esc(w.number>=10?w.number.toLocaleString('en-US'):w.english)+'</span>')+'</span></span></button>';
  }).join('')+'</div><div class="memory-status" role="status"></div><div class="memory-actions"></div>';
 }
 screen.querySelector('[data-memory-count]').textContent=m.found.length+' / '+m.deck.length/2;
 screen.querySelector('progress').value=m.offset+m.found.filter(id=>m.order.slice(m.offset,m.offset+m.size).includes(id)).length;
 screen.querySelectorAll('[data-flip]').forEach(b=>{
  const i=Number(b.dataset.flip),c=m.deck[i],w=word(c.id),found=m.found.includes(c.id),face=found||m.open.includes(i);
  b.classList.toggle('face-up',face);b.classList.toggle('remembered',found);b.disabled=found;
  b.setAttribute('aria-label',face?(c.side==='cn'?w.pinyin:w.english):'Hidden card '+(i+1));
  b.querySelector('.memory-front').setAttribute('aria-hidden',String(!face));
 });
 screen.querySelector('.memory-status').textContent=done?'Board cleared!':m.open.length===2?'Remember those places.':'Find the Chinese–English pairs.';
 screen.querySelector('.memory-actions').innerHTML=done?'<button class="primary" id="memory-next">'+(m.offset+m.size>=m.order.length?'Finish set':'Next board')+'</button>':'';
 screen.querySelector('#memory-back').onclick=async()=>{await transact(s=>delete s.memory);drawMemory()};
 screen.querySelectorAll('[data-flip]').forEach(b=>b.onclick=()=>turn(Number(b.dataset.flip)));
 screen.querySelector('#memory-next')?.addEventListener('click',async()=>{await transact(M.nextBoard);drawMemory()});
 if(m.open.length===2){busy=true;timer=gameClock.setTimeout(async()=>{
  await transact(M.closeMismatch);drawMemory();busy=true;
  // Keep input locked until both cards have turned back over.
  timer=gameClock.setTimeout(()=>{busy=false},280);
 },850)}
 setDebugAction(()=>{if(done){screen.querySelector('#memory-next').click();return}const first=m.deck.findIndex(c=>!m.found.includes(c.id)),second=m.deck.findIndex((c,i)=>i!==first&&c.id===m.deck[first].id);turn(first).then(()=>turn(second))});
}
async function turn(index){
 if(busy||gameClock.paused)return;busy=true;
 const {result}=await transact(s=>{const r=M.flip(s,index);if(r?.correct){r.points=E.award(s,'M',catalogue().progression.memoryPairWeight,s.memory.level);if(r.boardBonus)r.points+=E.award(s,'M',catalogue().progression.memoryBoardWeight,s.memory.level)}return r});
 busy=false;drawMemory();
 const card=state.memory.deck[index];if(result&&card.side==='cn'){const element=()=>screen.querySelector('[data-flip="'+index+'"]');speech.speak(word(card.id).traditional,{interrupt:true,element})}
 if(result?.correct)screen.querySelector('.memory-status').textContent='+'+result.points+' coins';
}
