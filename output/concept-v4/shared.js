import {createGameClock} from './game-clock.mjs';
import {mountPause} from './pause-game.js';
const gameClock=createGameClock();
const {setTimeout,clearTimeout}=gameClock;
import {createSpeech} from './speech.js';
import {bindPairDrag} from './pair-drag.js';
import * as E from './engine.mjs';
import {mountBattle} from './battle-arena.js';
import {createScoreCounter} from './score-counter.mjs';
import {englishCardLabel} from './card-labels.mjs';
import {scatterCards} from './arena-layout.mjs';
const $ = s => document.querySelector(s);
const esc = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function wrapNumberLabel(label){
 if(!/^\d{1,3}(,\d{3})+$/.test(label))return esc(label);
 const groups=label.split(',');
 return '<span class="number-label">'+groups.map((group,i)=>'<span class="number-group">'+group+(i<groups.length-1?',':'')+'</span>').join('<wbr>')+'</span>';
}
const page=document.body.dataset.page;
let lessons, state, busy=false, selected=null, placed=[], dragIndex=null, feedbackTimer, arenaTimer, arenaActivity, debugAction, battle, pairActivity;
const manifest=await fetch('../lessons/index.json').then(r=>{if(!r.ok)throw Error('Cannot load lessons');return r.json()});
lessons=await Promise.all(manifest.sets.map(file=>fetch('../lessons/'+file).then(r=>{if(!r.ok)throw Error(file);return r.json()})));
E.validateLessons(lessons);
const tokens=Object.fromEntries(lessons.slice(0,6).flatMap(x=>x.pairs).map(x=>[x.id,x]));
const read=()=>{try{const s=JSON.parse(localStorage.getItem(E.SAVE_KEY));if(s?.version===1){s.settings={voice:'female',muted:false,...s.settings};E.reconcileLessons(s,lessons);if(s.stage==='tap'&&s.difficulty>=2&&!s.current?.targets)E.newPrompt(s,lessons);return s}}catch{}return E.freshState(lessons,Date.now(),Math.floor(Math.random()*4294967295))};
let chain=Promise.resolve();
let scoreCounter;
const balanceBeforeAccrual=read().coins;
function transact(fn=()=>null) {
  const work=async()=>{
    const run=()=>{state=read();const earned=E.accrue(state);const result=fn(state);state.revision++;localStorage.setItem(E.SAVE_KEY,JSON.stringify(state));refreshNumbers();return {result,earned}};
    return navigator.locks ? navigator.locks.request(E.SAVE_KEY,run) : run();
  };
  chain=chain.then(work,work);return chain;
}
const initial=await transact();
let startingScore=balanceBeforeAccrual;
try{
 const saved=JSON.parse(sessionStorage.getItem('score-display'));
 if(saved&&saved.prestige===state.prestige&&saved.resetToken===(state.resetToken||null))startingScore=Math.min(saved.value,state.coins);
}catch{}
scoreCounter=createScoreCounter(startingScore,value=>{
 document.querySelectorAll('[data-coins]').forEach(n=>{const text=value.toLocaleString();if(n.textContent!==text)n.textContent=text});
});
const word=id=>tokens[id];
const hanzi=w=>esc(state.settings.script==='simplified'?(w.simplified||w.traditional):w.traditional);
function textCard(w){return (state.settings.display!=='pinyin'?'<span data-speech="'+esc(w.traditional)+'" class="hanzi" style="--hanzi-count:'+Math.max(1,Array.from(state.settings.script==='simplified'?(w.simplified||w.traditional):w.traditional).length)+'">'+hanzi(w)+'</span>':'')+(state.settings.display!=='characters'?'<span data-speech="'+esc(w.traditional)+'" class="pinyin">'+esc(w.pinyin)+'</span>':'')}
const route=s=>s.stage==='match'?'match':s.stage==='cardReward'?'card-reward':s.stage==='setReward'?(s.setIndex===6?'sentence-reward':'set-reward'):s.stage==='order'?'order':'home';
const icons={Play:'M8 4l12 8-12 8z',Sets:'M4 4h12v16H4z M19 7h2v13',Boosts:'M4 20V12h3v8 M11 20V7h3v13 M18 20V3h3v17',Restart:'M4 11a8 8 0 1 1 2 7 M4 4v7h7'};
const labels={home:'Play',match:'Match',order:'Card order',sets:'Sets',boosts:'Boosts',restart:'Restart',settings:'Settings',bonus:'Bonus'};
const gamePages=['home','match','order','card-reward','set-reward','sentence-reward'];
function mountShell(){
 if(document.body.classList.contains('reward'))return;
 document.body.insertAdjacentHTML('afterbegin','<header class="header"><h1>'+labels[page]+'</h1><div class="head-right"><span class="score"><span class="coin" aria-hidden="true"></span><span data-coins>0</span></span><a class="gear" href="settings.html" aria-label="Settings">⚙</a></div></header>');
 document.body.insertAdjacentHTML('beforeend','<nav class="footer" aria-label="Main navigation">'+[['Play','home'],['Sets','sets'],['Boosts','boosts'],['Restart','restart']].map(([label,id])=>'<a href="'+id+'.html" '+((page===id||id==='home'&&['match','order','bonus'].includes(page))?'class="active" aria-current="page"':'')+'><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="'+icons[label]+'"/></svg>'+label+'</a>').join('')+'</nav>');
}
function refreshNumbers(){
 if(!state)return;
 if(document.querySelector('[data-coins]'))scoreCounter?.update(state.coins);
 document.querySelectorAll('[data-rate]').forEach(n=>{const text=E.idleRate(state).toFixed(2);if(n.textContent!==text)n.textContent=text});
 document.querySelectorAll('[data-buy]').forEach(n=>{const disabled=state.coins<E.upgradeCost(state,n.dataset.buy);if(n.disabled!==disabled)n.disabled=disabled});
}
const screen=$('#screen');
const speech=createSpeech({catalog:await fetch('../audio/catalog.json').then(r=>r.json()),settings:()=>({...state.settings,muted:state.settings.muted||gameClock.paused}),root:screen,autoplay:!['sets','boosts'].includes(page)});
function go(){pairActivity?.abort();battle?.dispose();battle=null;clearTimeout(arenaTimer);busy=false;selected=null;placed=[];const dest=route(state);if(gamePages.includes(page)&&page!==dest){busy=true;document.body.classList.add('screen-leaving');setTimeout(()=>location.replace(dest+'.html'),180);return}draw()}
function draw(){
 debugAction=null;
 if(gamePages.includes(page)&&page!==route(state)){go();return}
 if(page==='home')drawTap();
 if(page==='match')drawMatch();
 if(page==='card-reward')drawCardReward();
 if(page==='set-reward'||page==='sentence-reward')drawSetReward();
 if(page==='order')drawOrder();
 if(page==='sets')drawSets();
 if(page==='boosts')drawBoosts();
 if(page==='restart')drawRestart();
 if(page==='settings')drawSettings();
 if(page==='bonus')drawBonus();
 refreshNumbers();
}
function dictionary(flash){
 const pairs=state.seen.map(id=>word(id)).filter(Boolean);
 return '<div class="dictionary" aria-label="Discovered pairs">'+(pairs.length?'<div class="dictionary-columns">'+pairs.map(w=>'<div class="dictionary-entry '+[(flash?.id===w.id?'lit':''),((state.correct[w.id]||0)>=2?'mastered':'')].join(' ')+'" data-row="'+w.id+'">'+(state.settings.display!=='pinyin'?'<strong class="hanzi">'+hanzi(w)+'</strong> ':'')+(state.settings.display!=='characters'?'<span class="pinyin">['+esc(w.pinyin)+']</span> ':'')+'<span class="translation">: '+wrapNumberLabel(w.number>=10?w.number.toLocaleString('en-US'):w.english)+'</span></div>').join('')+'</div>':'')+'</div>';
}
function drawTap(){
 battle?.dispose();battle=null;
 if(state.stage==='tap'&&state.difficulty>=2){
  arenaActivity?.abort();clearTimeout(arenaTimer);
  battle=mountBattle({clock:gameClock,speak:speech.speak,screen,getState:()=>state,word,textCard,label:w=>wrapNumberLabel(englishCardLabel(w)),dictionary,
   answer:async(choice,id)=>(await transact(s=>E.answerTap(s,lessons,choice,id))).result,
   skip:async id=>(await transact(s=>E.skipTap(s,lessons,id))).result,onRoute:go,refresh:refreshNumbers});
  debugAction=()=>battle?.debug();return;
 }
 clearTimeout(arenaTimer);
 arenaActivity?.abort();
 if(state.stage==='finished'){screen.innerHTML='<section class="panel rate"><div class="hanzi">完成</div><p>All seven sets collected</p><div class="big">+'+E.idleRate(state).toFixed(2)+' /s</div></section><a class="primary" href="restart.html">Restart stronger</a><a class="secondary" href="bonus.html">Bonus puzzles</a>';return}
 const q=state.current;
 if(!q)return;
 screen.innerHTML='<div class="playfield arena-field">'+dictionary()+'<div class="card-arena" aria-label="Card arena"><div class="arena-piece target-piece" tabindex="0" aria-label="Move target"><div class="arena-face target-face">'+textCard(word(q.id))+'<span class="target-ring" aria-hidden="true"></span></div></div>'+q.options.map((id,i)=>'<button class="arena-piece weapon-piece" data-answer="'+id+'" style="--delay:'+(180+i*65)+'ms"><span class="arena-face weapon-face">'+wrapNumberLabel(englishCardLabel(word(id)))+'</span></button>').join('')+'<div class="arena-effect" aria-hidden="true"></div><div class="arena-status" role="status" aria-live="polite"></div></div></div>';
 const arena=$('.card-arena');let topLayer=2;
 const pieces=[...arena.querySelectorAll('.arena-piece')];
 const dictionaryPage=$('.dictionary-columns');
 const bounds=arena.getBoundingClientRect();
 const dictionaryBottom=dictionaryPage?(dictionaryPage.getBoundingClientRect().bottom-bounds.top)*arena.clientHeight/bounds.height:0;
 const positions=scatterCards(arena.clientWidth,arena.clientHeight,pieces.length,pieces[0].offsetWidth,pieces[0].offsetHeight,dictionaryBottom);
 pieces.forEach((card,i)=>{card.style.left=positions[i].x+'px';card.style.top=positions[i].y+'px'});
 debugAction=()=>resolve(q.id);
 const arm=()=>{if(gameClock.paused)return;clearTimeout(arenaTimer);if(!busy&&document.visibilityState==='visible')arenaTimer=setTimeout(()=>resolve(null),4000)};
 // Any activity within the game keeps the current target alive, including
 // movement over the dictionary or clicks outside the cards.
 arenaActivity=new AbortController();
 for(const event of ['pointermove','pointerdown','click'])document.addEventListener(event,arm,{capture:true,passive:true,signal:arenaActivity.signal});

 async function resolve(choice){
  if(busy)return;busy=true;clearTimeout(arenaTimer);
  const {result}=await transact(s=>choice===null?E.skipTap(s,lessons,q.id):E.answerTap(s,lessons,choice,q.id));
  if(!result){go();return}
  arena.classList.add(result.unanswered?'escaped':result.correct?'hit':'miss');
  $('.arena-status').textContent=result.unanswered?'':result.correct?'+'+result.points:'Miss';
  if(!result.unanswered){
   $('.dictionary').outerHTML=dictionary(result);
   const target=arena.querySelector('.target-piece');
   const weapon=arena.querySelector('[data-answer="'+choice+'"]');
   const x=weapon.offsetLeft+weapon.offsetWidth/2,y=weapon.offsetTop+weapon.offsetHeight/2;
   const dx=target.offsetLeft+target.offsetWidth/2-x,dy=target.offsetTop+target.offsetHeight/2-y;
   const shot=document.createElement('span');shot.className='arena-shot';shot.style.cssText='left:'+x+'px;top:'+y+'px;--dx:'+dx+'px;--dy:'+dy+'px';arena.append(shot);
  }
  feedbackTimer=setTimeout(go,result.unanswered?450:800);
 }
 arena.querySelectorAll('.arena-piece').forEach(card=>{
  let drag=null,suppressClick=false;
  card.addEventListener('pointerdown',e=>{
   if(busy||e.button!==0)return;
   clearTimeout(arenaTimer);suppressClick=false;card.style.zIndex=++topLayer;
   const rect=arena.getBoundingClientRect();
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:card.offsetLeft,top:card.offsetTop,sx:arena.clientWidth/rect.width,sy:arena.clientHeight/rect.height,moved:false};
   card.setPointerCapture(e.pointerId);
  });
  card.addEventListener('pointermove',e=>{
   if(!drag||drag.id!==e.pointerId)return;
   const dx=(e.clientX-drag.x)*drag.sx,dy=(e.clientY-drag.y)*drag.sy;
   if(Math.hypot(dx,dy)>5)drag.moved=true;
   if(!drag.moved)return;
   card.classList.add('dragging');
   card.style.left=Math.max(0,Math.min(arena.clientWidth-card.offsetWidth,drag.left+dx))+'px';
   card.style.top=Math.max(0,Math.min(arena.clientHeight-card.offsetHeight,drag.top+dy))+'px';
  });
  const release=e=>{
   if(!drag||drag.id!==e.pointerId)return;
   const moved=drag.moved;suppressClick=moved||e.type==='pointercancel';drag=null;card.classList.remove('dragging');arm();
   if(moved&&e.type==='pointerup'){
    const candidates=card.dataset.answer?[arena.querySelector('.target-piece')]:[...arena.querySelectorAll('[data-answer]')];
    const other=candidates.find(el=>{const r=el.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom});
    if(other)resolve(card.dataset.answer||other.dataset.answer);
   }
  };
  card.addEventListener('pointerup',release);card.addEventListener('pointercancel',release);
  card.addEventListener('click',()=>{if(suppressClick){suppressClick=false;return}if(card.dataset.answer)resolve(card.dataset.answer);else arm()});
  card.addEventListener('keydown',e=>{
   const steps={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
   if(!steps[e.key]||busy)return;e.preventDefault();card.style.zIndex=++topLayer;
   card.style.left=Math.max(0,Math.min(arena.clientWidth-card.offsetWidth,card.offsetLeft+steps[e.key][0]))+'px';
   card.style.top=Math.max(0,Math.min(arena.clientHeight-card.offsetHeight,card.offsetTop+steps[e.key][1]))+'px';arm();
  });
 });
 arm();
}
function drawMatch(){
 pairActivity?.abort();pairActivity=new AbortController();
 const ids=E.matchBoard(state);
 debugAction=()=>{const id=ids.find(id=>!state.matchFound.includes(id));if(!id)return;selected=null;screen.querySelector('[data-side="cn"][data-id="'+id+'"]').click();screen.querySelector('[data-side="en"][data-id="'+id+'"]').click()};
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
function drawCardReward(){
 const r=state.pendingReward, set=lessons[state.setIndex], w=word(r.ids[r.ids.length-1]);
 screen.innerHTML='<h1>Card reward</h1><div class="gain">+'+r.ids.length+' '+(r.ids.length===1?'card':'cards')+'</div><div class="card hero-card">'+textCard(w)+'</div>'+(r.ids.length>1?'<div class="small">Also collected: '+r.ids.slice(0,-1).map(id=>hanzi(word(id))).join(' · ')+'</div>':'')+'<section class="panel">'+textCard(set)+'<h2>'+r.before+' → '+r.after+' / '+r.total+'</h2><progress value="'+r.after+'" max="'+r.total+'"></progress></section><p class="muted">'+(r.allDone?'All cards collected':'Your set is growing')+'</p><button class="primary" id="continue">Continue</button>';
 $('#continue').onclick=async()=>{if(busy)return;busy=true;await transact(E.continueCardReward);go()};
}
function drawSetReward(){
 const set=lessons[state.setIndex], sentences=set.type==='sentences';
 const amount=Math.round(100*(state.setIndex+1)*E.permanent(state)*E.factor(state,'award'));
 screen.innerHTML='<h1>'+(sentences?'Sentence set complete':'Set complete')+'</h1><section class="reward-emblem">'+textCard(set)+'</section><div class="gain">+'+amount+' <span class="coin" aria-hidden="true"></span></div><section class="panel"><div class="big">'+(sentences?'10 / 10':set.pairs.length+' / '+set.pairs.length)+'</div><p>Collected</p><progress value="1" max="1"></progress></section><section class="panel"><p>Coins per second</p><h2>'+E.idleRate(state).toFixed(2)+' → '+((state.completed.length+1)*0.1*E.permanent(state)*E.factor(state,'idle')).toFixed(2)+'</h2></section><button id="claim" class="primary">Claim set award</button>';
 $('#claim').onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.claimSet(s,lessons));go()};
}
function drawOrder(){
 pairActivity?.abort();pairActivity=new AbortController();
 const q=E.sentencePrompt(state,lessons);
 const pool=Object.keys(tokens).filter(id=>!q.tokens.includes(id));
 const rng={rng:state.prestige*8123+Number(q.id.split('-')[1])*71};
 const bank=E.shuffle(rng,[...q.tokens,...E.shuffle(rng,pool).slice(0,10-q.tokens.length)]);
 screen.innerHTML='<div class="prompt">'+esc(q.english)+'</div><div class="target" style="--slots:'+q.tokens.length+'">'+q.tokens.map((_,i)=>'<button class="card '+(placed[i]!==undefined?'filled':'')+'" data-slot="'+i+'" draggable="'+(placed[i]!==undefined)+'" aria-label="Answer position '+(i+1)+'">'+(placed[i]!==undefined?textCard(word(bank[placed[i]])):'<span class="slot-number">'+(i+1)+'</span>')+'</button>').join('')+'</div><div class="small">Tap or drag to place · Tap an answer to remove</div><div class="choices">'+bank.map((id,i)=>'<button class="card" data-choice="'+i+'" '+(placed.includes(i)?'disabled':'')+'>'+textCard(word(id))+'</button>').join('')+'</div><div class="status" role="status" aria-live="polite"></div><button class="primary" id="check" '+(placed.length===q.tokens.length?'':'disabled')+'>Check</button>';
 $('.choices').onclick=e=>{const b=e.target.closest('[data-choice]');if(b&&!busy&&placed.length<q.tokens.length){placed.push(Number(b.dataset.choice));drawOrder()}};
 $('.target').onclick=e=>{const b=e.target.closest('[data-slot]');if(b&&!busy){placed.splice(Number(b.dataset.slot),1);drawOrder()}};
 const target=$('.target');
 target.ondragstart=e=>{dragIndex=Number(e.target.closest('[data-slot]').dataset.slot)};
 target.ondragover=e=>e.preventDefault();
 target.ondrop=e=>{e.preventDefault();const b=e.target.closest('[data-slot]');if(b&&dragIndex!==null&&!busy){const [v]=placed.splice(dragIndex,1);placed.splice(Math.min(Number(b.dataset.slot),placed.length),0,v);dragIndex=null;drawOrder()}};
 screen.querySelectorAll('[data-choice]').forEach(card=>bindPairDrag(card,{
  signal:pairActivity.signal,enabled:()=>!busy&&placed.length<q.tokens.length,
  getTargets:()=>[...screen.querySelectorAll('[data-slot]')],
  onDrop:slot=>{placed.splice(Math.min(Number(slot.dataset.slot),placed.length),0,Number(card.dataset.choice));drawOrder()}
 }));
 screen.querySelectorAll('[data-slot].filled').forEach(card=>bindPairDrag(card,{
  signal:pairActivity.signal,enabled:()=>!busy,
  getTargets:()=>[...screen.querySelectorAll('[data-slot]')],
  onDrop:slot=>{const [value]=placed.splice(Number(card.dataset.slot),1);placed.splice(Math.min(Number(slot.dataset.slot),placed.length),0,value);drawOrder()}
 }));
 debugAction=()=>{const used=new Set();placed=q.tokens.map(id=>{const i=bank.findIndex((v,i)=>v===id&&!used.has(i));used.add(i);return i});drawOrder();$('#check').click()};
 $('#check').onclick=async()=>{
  if(busy)return;busy=true;
  const {result}=await transact(s=>E.answerSentence(s,lessons,placed.map(i=>bank[i]),q.id));
  if(!result){go();return}
  $('.status').textContent=result.correct?'+'+result.points:'Try a different order.';
  if(result.correct)feedbackTimer=setTimeout(go,600);else busy=false;
 };
}
let collectionIndex=state.setIndex;
function drawSets(){
 const set=lessons[collectionIndex], owned=state.cards[set.id]||[];
 const items=set.type==='sentences'?state.sentenceDeck.map(id=>set.sentences.find(q=>q.id===id)):set.pairs;
 screen.innerHTML='<div class="selection-grid set-picker" role="group" aria-label="Card set">'+lessons.map((s,i)=>'<button class="selection-button" data-set="'+i+'" aria-pressed="'+(collectionIndex===i)+'">'+textCard(s)+'</button>').join('')+'</div>'+'<div class="row collection-heading">'+textCard(set)+'<b>'+owned.length+' / '+items.length+'</b></div><progress value="'+owned.length+'" max="'+items.length+'"></progress><div class="collection">'+items.map(w=>'<div class="card '+(owned.includes(w.id)?'':'empty')+'">'+(owned.includes(w.id)?(set.type==='sentences'?'<span data-speech="'+esc(w.tokens.map(id=>word(id).traditional).join(''))+'" class="sentence-mini">'+w.tokens.map(id=>hanzi(word(id))).join('')+'</span>':textCard(w)):'—')+'</div>').join('')+'</div><section class="panel row"><span>Passive income</span><b><span data-rate></span> /s</b></section><a class="secondary" href="bonus.html">Bonus puzzles</a>';
 screen.querySelectorAll('[data-set]').forEach(b=>b.onclick=()=>{collectionIndex=Number(b.dataset.set);drawSets();refreshNumbers();screen.querySelector('[data-set="'+collectionIndex+'"]').focus({preventScroll:true})});
}
function drawBoosts(){
 screen.innerHTML='<div class="row"><span class="small">+'+E.tapValue(state)+' / tap</span><b><span data-rate></span> /s</b></div><div id="boost-list">'+E.upgradeSpecs.map(u=>{const lv=state.upgrades[u.id]||0;const names={tap:'點擊',idle:'自動',offline:'離線',award:'獎勵'};return '<div class="boost"><div>'+textCard({traditional:u.name,simplified:u.simplified||u.name,pinyin:u.pinyin})+'<span class="upgrade-kind">'+names[u.kind]+'</span></div><span class="mult">×'+Math.pow(1.2,lv).toFixed(2)+' → ×'+Math.pow(1.2,lv+1).toFixed(2)+'</span><div><div class="boost-price">'+E.upgradeCost(state,u.id).toLocaleString()+'</div><button class="buy" data-buy="'+u.id+'">Buy</button></div></div>'}).join('')+'</div>';
 screen.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.buy(s,b.dataset.buy));busy=false;drawBoosts();refreshNumbers()});
}
function drawRestart(){
 screen.innerHTML='<section class="rate"><div class="hanzi">再來</div><span class="pinyin">zài lái</span><div class="big">×'+E.permanent(state)+' → ×'+(E.permanent(state)+0.5)+'</div></section><div class="reset-grid"><section class="panel"><b>Reset</b><p>Coins<br>Cards and sets<br>Upgrades</p></section><section class="panel"><b>Keep</b><p>Permanent multiplier<br>Settings</p></section></div><p class="small">New sentence selection next run.</p><button class="primary" id="restart" '+(state.completed.length?'':'disabled')+'>Restart</button>'+(!state.completed.length?'<p class="small">Collect a set to unlock.</p>':'');
 $('#restart').onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.prestigeReset(s,lessons));location.href='home.html'};
}
function drawSettings(){
 const groups=[['script','Script',[['traditional','繁體'],['simplified','简体']]],['display','Display',[['both','Characters + pinyin'],['characters','Characters only'],['pinyin','Pinyin only']]],['voice','Voice',[['female','Female'],['male','Male']]],['muted','Sound',[['false','Sound on'],['true','Mute']]]];
 screen.innerHTML='<section class="settings"><h2>Cards & sound</h2>'+groups.map(([key,title,options])=>'<fieldset class="setting-group"><legend>'+title+'</legend><div class="selection-grid '+(key==='display'?'stack':'')+'">'+options.map(([value,label])=>'<button class="selection-button" data-setting="'+key+'" data-value="'+value+'" aria-pressed="'+(String(state.settings[key])===value)+'">'+label+'</button>').join('')+'</div></fieldset>').join('')+'</section>';
 screen.querySelectorAll('[data-setting]').forEach(b=>b.onclick=async()=>{const {setting,value}=b.dataset;await transact(s=>s.settings[setting]=setting==='muted'?value==='true':value);speech.stop();if(setting==='voice'||setting==='muted')speech.speak('一',{interrupt:true});drawSettings();screen.querySelector('[data-setting="'+setting+'"][data-value="'+value+'"]').focus({preventScroll:true})});
}
let bonusQ=null;
function drawBonus(){
 pairActivity?.abort();pairActivity=new AbortController();
 const unlocked=lessons.slice(0,Math.min(6,state.setIndex+1)).flatMap(x=>x.pairs).filter(w=>state.seen.includes(w.id)||Object.values(state.cards).some(ids=>ids.includes(w.id)));
 if(!unlocked.length){screen.innerHTML='<section class="panel"><p>Discover some pairs in Play first.</p></section><a class="primary" href="home.html">Play</a>';return}
 if(!bonusQ){const rng={rng:Date.now()>>>0},w=E.shuffle(rng,unlocked)[0];bonusQ={id:w.id,options:E.shuffle(rng,[w,...E.shuffle(rng,Object.values(tokens).filter(p=>p.id!==w.id&&(w.number===undefined||p.number!==w.number))).slice(0,3)])}}
 screen.innerHTML='<div class="prompt bonus-target">'+textCard(word(bonusQ.id))+'</div><div class="english-choices">'+bonusQ.options.map(w=>'<button class="primary" data-bonus="'+w.id+'">'+wrapNumberLabel(englishCardLabel(w))+'</button>').join('')+'</div><div class="status" role="status"></div>';
 screen.querySelectorAll('[data-bonus]').forEach(b=>b.onclick=async()=>{if(busy)return;busy=true;const right=b.dataset.bonus===bonusQ.id;if(right)await transact(s=>s.coins+=1*E.permanent(s));$('.status').textContent=right?'+'+E.permanent(state):word(bonusQ.id).english;feedbackTimer=setTimeout(()=>{busy=false;bonusQ=null;drawBonus()},700)});
 const target=screen.querySelector('.bonus-target');
 const answers=[...screen.querySelectorAll('[data-bonus]')];
 answers.forEach(card=>bindPairDrag(card,{signal:pairActivity.signal,enabled:()=>!busy,getTargets:()=>[target],onDrop:()=>card.click()}));
 if(target)bindPairDrag(target,{signal:pairActivity.signal,enabled:()=>!busy,getTargets:()=>answers,onDrop:card=>card.click()});
}
async function debugStep(){
 if(busy||gameClock.paused)return;
 if(debugAction){debugAction();return}
 if($('#continue')){$('#continue').click();return}
 if($('#claim')){$('#claim').click();return}
 if(page==='bonus'&&bonusQ){screen.querySelector('[data-bonus="'+bonusQ.id+'"]').click();return}
 // From utility pages, advance the underlying game by one correct interaction.
 busy=true;
 await transact(s=>{
  if(s.stage==='tap')return E.answerTap(s,lessons,s.current.id,s.current.id);
  if(s.stage==='match'){const id=E.matchBoard(s).find(id=>!s.matchFound.includes(id));return E.matchPair(s,lessons,id,id)}
  if(s.stage==='order'){const q=E.sentencePrompt(s,lessons);return E.answerSentence(s,lessons,q.tokens,q.id)}
  if(s.stage==='cardReward')return E.continueCardReward(s);
  if(s.stage==='setReward')return E.claimSet(s,lessons);
 });
 busy=false;draw();
}
document.addEventListener('keydown',e=>{if(gameClock.paused)return;if(e.code==='Space'&&!e.target.matches('input,textarea,[contenteditable="true"]')){e.preventDefault();if(!e.repeat)debugStep()}});
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data==='debug-space')debugStep()});
mountShell();go();
const pauseControl=mountPause({clock:gameClock,onPause:()=>{speech.stop();scoreCounter.stop()},onResume:()=>transact()});
if(initial.earned>=1){const n=document.createElement('div');n.className='offline-toast';n.setAttribute('role','status');n.textContent='While away: +'+Math.floor(initial.earned).toLocaleString();document.body.append(n);setTimeout(()=>n.remove(),5000)}
window.addEventListener('storage',e=>{
 if(e.key!==E.SAVE_KEY)return;
 const previous=state;state=read();refreshNumbers();
 if(previous.resetToken!==state.resetToken){clearTimeout(feedbackTimer);clearTimeout(arenaTimer);arenaActivity?.abort();collectionIndex=state.setIndex;bonusQ=null;go();return}
 const stageChanged=previous.stage!==state.stage||previous.setIndex!==state.setIndex;
 const preferencesChanged=JSON.stringify(previous.settings)!==JSON.stringify(state.settings);
 const upgradesChanged=page==='boosts'&&JSON.stringify(previous.upgrades)!==JSON.stringify(state.upgrades);
 const cardsChanged=page==='sets'&&JSON.stringify(previous.cards)!==JSON.stringify(state.cards);
 if(preferencesChanged)speech.stop();
 if(!busy&&(stageChanged||preferencesChanged||upgradesChanged||cardsChanged))go();
});
const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!gameClock.paused)transact()},1000);
window.addEventListener('pagehide',()=>{
 pauseControl.dispose();gameClock.dispose();speech.dispose();pairActivity?.abort();battle?.dispose();clearInterval(timer);clearTimeout(feedbackTimer);clearTimeout(arenaTimer);arenaActivity?.abort();scoreCounter.stop();
 try{sessionStorage.setItem('score-display',JSON.stringify({value:scoreCounter.value(),prestige:state.prestige,resetToken:state.resetToken||null}))}catch{}
});

