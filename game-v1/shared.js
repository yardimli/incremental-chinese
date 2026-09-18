import {ensureFullBoard,memorySets} from './modes/memory-state.mjs';
import {showEnglish} from './systems/translations.mjs';
import * as V from './systems/village.mjs';
import {drawVillage,refreshEconomyUI} from './ui/village.js';
import {drawTechnology,refreshTechUI} from './ui/technology.js';
import {drawMemory} from './modes/memory.js';
import {drawBonus,dispose as disposedrawBonus} from './modes/bonus.js';
import {drawOrder,dispose as disposedrawOrder} from './modes/order.js';
import {drawMatch,dispose as disposedrawMatch} from './modes/matching.js';
import {drawTap,dispose as disposedrawTap} from './modes/battle.js';
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
const config=await Promise.all(['progression','resources','buildings','research'].map(name=>fetch('../data/'+name+'.json').then(r=>{if(!r.ok)throw Error(name);return r.json()})));
V.configureVillage(Object.fromEntries(['progression','resources','buildings','research'].map((k,i)=>[k,config[i]])));
const manifest=await fetch('../lessons/index.json').then(r=>{if(!r.ok)throw Error('Cannot load lessons');return r.json()});
lessons=await Promise.all(manifest.sets.map(file=>fetch('../lessons/'+file).then(r=>{if(!r.ok)throw Error(file);return r.json()})));
E.validateLessons(lessons);
const tokens=Object.fromEntries(lessons.filter(x=>x.type==='pairs').flatMap(x=>x.pairs).map(x=>[x.id,x]));
const read=()=>{try{const s=JSON.parse(localStorage.getItem(E.SAVE_KEY));if(s?.version===2){s.settings={voice:'female',muted:false,englishTranslations:'until10',...s.settings};E.reconcileLessons(s,lessons);ensureFullBoard(s,memorySets(s,lessons).flatMap(set=>set.pairs));if(s.stage==='tap'&&s.difficulty>=2&&!s.current?.targets)E.newPrompt(s,lessons);return s}}catch{}return E.freshState(lessons,Date.now(),Math.floor(Math.random()*4294967295))};
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
 const saved=JSON.parse(sessionStorage.getItem('village-score-display'));
 if(saved&&saved.prestige===state.prestige&&saved.resetToken===(state.resetToken||null))startingScore=Math.min(saved.value,state.coins);
}catch{}
scoreCounter=createScoreCounter(startingScore,value=>{
 document.querySelectorAll('[data-coins]').forEach(n=>{const text=value.toLocaleString();if(n.textContent!==text)n.textContent=text});
});
const word=id=>tokens[id];
const hanzi=w=>esc(state.settings.script==='simplified'?(w.simplified||w.traditional):w.traditional);
function textCard(w){return (state.settings.display!=='pinyin'?'<span data-speech="'+esc(w.traditional)+'" class="hanzi" style="--hanzi-count:'+Math.max(1,Array.from(state.settings.script==='simplified'?(w.simplified||w.traditional):w.traditional).length)+'">'+hanzi(w)+'</span>':'')+(state.settings.display!=='characters'?'<span data-speech="'+esc(w.traditional)+'" class="pinyin">'+esc(w.pinyin)+'</span>':'')+englishTranslation(w)}
function englishTranslation(w){return ['sets','village','boosts','tech','card-reward','set-reward','sentence-reward'].includes(page)&&showEnglish(state)&&w.english?'<span class="english-translation">'+esc(w.english)+'</span>':''}
const route=s=>s.stage==='match'?'match':s.stage==='cardReward'?'card-reward':s.stage==='setReward'?(lessons[s.setIndex].type==='sentences'?'sentence-reward':'set-reward'):s.stage==='order'?'order':'home';
const icons={Play:'M8 4l12 8-12 8z',Sets:'M4 4h12v16H4z M19 7h2v13',Village:'M4 20V12h3v8 M11 20V7h3v13 M18 20V3h3v17',Tech:'M4 11a8 8 0 1 1 2 7 M4 4v7h7'};
const labels={home:'Play',match:'Match',order:'Card order',sets:'Sets',village:'Village',tech:'Tech',memory:'Memory',boosts:'Village',restart:'Prestige',settings:'Settings',bonus:'Bonus'};
const gamePages=['home','match','order','card-reward','set-reward','sentence-reward'];
function mountShell(){
 if(document.body.classList.contains('reward'))return;
 document.body.insertAdjacentHTML('afterbegin','<header class="header"><h1>'+labels[page]+'</h1><div class="head-right"><span class="score"><span class="coin" aria-hidden="true"></span><span data-coins>0</span></span><button class="gear pause-button" type="button" aria-label="Pause game"><svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path fill="currentColor" d="M2 2h4v14H2zM10 2h4v14h-4z"/></svg></button><a class="gear" href="settings.html" aria-label="Settings">⚙</a></div></header>');
 document.body.insertAdjacentHTML('beforeend','<nav class="footer" aria-label="Main navigation">'+(['home','match','order'].includes(page)?'<div class="accuracy-strip"><div class="accuracy-track" role="meter" aria-label="Level accuracy" aria-valuemin="0" aria-valuemax="100"><i></i></div></div>':'')+[['Play','home'],['Sets','sets'],['Village','village'],['Tech','tech']].map(([label,id])=>'<a href="'+id+'.html" '+((page===id||id==='home'&&['match','order','bonus','memory','restart'].includes(page))?'class="active" aria-current="page"':'')+'><i aria-hidden="true" class="sprite sprite-'+({home:'play',sets:'sets',village:'village',tech:'tech'}[id])+'"></i>'+label+'</a>').join('')+'</nav>');
}
function refreshNumbers(){
 if(!state)return;
 refreshEconomyUI();refreshTechUI();
 const accuracy=E.levelAccuracy(state),meter=document.querySelector('.accuracy-track');
 if(meter){
  const percent=Math.floor(accuracy.percent);
  meter.setAttribute('aria-valuenow',percent);meter.setAttribute('aria-valuetext',accuracy.total?percent+'% correct':'No answers yet');
  meter.querySelector('i').style.width=accuracy.percent+'%';meter.classList.toggle('below-target',accuracy.total>0&&!accuracy.passed);
 }

 if(document.querySelector('[data-coins]'))scoreCounter?.update(state.coins);
 document.querySelectorAll('[data-rate]').forEach(n=>{const text=E.idleRate(state).toFixed(2);if(n.textContent!==text)n.textContent=text});
}
const screen=$('#screen');
const speech=createSpeech({catalog:await fetch('../audio/catalog.json').then(r=>r.json()),settings:()=>({...state.settings,muted:state.settings.muted||gameClock.paused}),root:screen,autoplay:!['sets','boosts','village','tech','memory'].includes(page)});
function go(){pairActivity?.abort();battle?.dispose();battle=null;clearTimeout(arenaTimer);busy=false;selected=null;placed=[];const dest=route(state);if(gamePages.includes(page)&&page!==dest){busy=true;document.body.classList.add('screen-leaving');setTimeout(()=>location.replace(dest+'.html'),180);return}draw()}
function draw(){
 screen.classList.remove('village-gate');
 debugAction=null;
 if(gamePages.includes(page)&&page!==route(state)){go();return}
 if(page==='home'){if(state.stage==='gate')drawGate();else drawTap();}
 if(page==='match')drawMatch();
 if(page==='card-reward')drawCardReward();
 if(page==='set-reward'||page==='sentence-reward')drawSetReward();
 if(page==='order')drawOrder();
 if(page==='sets')drawSets();
 if(page==='boosts'||page==='village')drawVillage();
 if(page==='tech')drawTechnology();
 if(page==='memory')drawMemory();
 if(page==='restart')drawRestart();
 if(page==='settings')drawSettings();
 if(page==='bonus')drawBonus();
 refreshNumbers();
}
function dictionary(flash){
 const pairs=state.seen.map(id=>word(id)).filter(Boolean);
 return '<div class="dictionary" aria-label="Discovered pairs">'+(pairs.length?'<div class="dictionary-columns">'+pairs.map(w=>'<div class="dictionary-entry '+[(flash?.id===w.id?'lit':''),((state.correct[w.id]||0)>=2?'mastered':'')].join(' ')+'" data-row="'+w.id+'">'+(state.settings.display!=='pinyin'?'<strong class="hanzi">'+hanzi(w)+'</strong> ':'')+(state.settings.display!=='characters'?'<span class="pinyin">['+esc(w.pinyin)+']</span> ':'')+'<span class="translation">: '+wrapNumberLabel(w.number>=10?w.number.toLocaleString('en-US'):w.english)+'</span></div>').join('')+'</div>':'')+'</div>';
}
function drawCardReward(){
 const r=state.pendingReward, set=lessons[state.setIndex], w=word(r.ids[r.ids.length-1]);
 screen.innerHTML='<h1>Card reward</h1><div class="gain">+'+r.ids.length+' '+(r.ids.length===1?'card':'cards')+'</div><div class="card hero-card">'+textCard(w)+'</div>'+(r.ids.length>1?'<div class="small">Also collected: '+r.ids.slice(0,-1).map(id=>hanzi(word(id))+' '+englishTranslation(word(id))).join(' · ')+'</div>':'')+'<section class="panel">'+textCard(set)+'<h2>'+r.before+' → '+r.after+' / '+r.total+'</h2><progress value="'+r.after+'" max="'+r.total+'"></progress></section><p class="muted">'+(r.allDone?'All cards collected':'Your set is growing')+'</p><button class="primary" id="continue">Continue</button>';
 $('#continue').onclick=async()=>{if(busy)return;busy=true;await transact(E.continueCardReward);go()};
}
function drawSetReward(){
 const set=lessons[state.setIndex], sentences=set.type==='sentences';
 const accuracy=E.levelAccuracy(state);
 if(!accuracy.passed){
  screen.innerHTML='<h1>Try this set again</h1><section class="reward-emblem">'+textCard(set)+'</section><section class="panel"><div class="big">'+Math.floor(accuracy.percent)+'%</div><p>Correct answers · '+accuracy.correct+' / '+accuracy.total+'</p><p>Reach 50% accuracy to complete this set.</p></section><p class="muted">Keep your coins and collected cards. Start a fresh attempt.</p><button id="claim" class="primary">Play again</button>';
  $('#claim').onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.claimSet(s,lessons));go()};
  return;
 }
 const amount=E.payout(state,'set',10)+(set.id==='L01'?V.catalogue().progression.settlementGrant:0);
 screen.innerHTML='<h1>'+(sentences?'Sentence set complete':'Set complete')+'</h1><section class="reward-emblem">'+textCard(set)+'</section><div class="gain">+'+amount+' <span class="coin" aria-hidden="true"></span></div><section class="panel"><div class="big">'+(sentences?'10 / 10':set.pairs.length+' / '+set.pairs.length)+'</div><p>Collected</p><progress value="1" max="1"></progress></section><section class="panel"><p>New village plans available</p><h2>村落 · cūn luò</h2></section><button id="claim" class="primary">Claim set award</button>';
 $('#claim').onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.claimSet(s,lessons));go()};
}
let collectionIndex=state.setIndex;
function drawSets(preservePicker=false){
 const previousPicker=preservePicker?screen.querySelector('.set-picker'):null;
 const set=lessons[collectionIndex], owned=state.cards[set.id]||[];
 const deck=state.previousSentences?.[set.id]||(collectionIndex===state.setIndex?state.sentenceDeck:[]);
 const items=set.type==='sentences'?(deck.length?deck.map(id=>set.sentences.find(q=>q.id===id)):set.sentences.slice(0,set.countPerRun)):set.pairs;
 const historical=!!state.history?.[set.id];
 screen.innerHTML='<div class="selection-grid set-picker" role="group" aria-label="Card set">'+lessons.map((s,i)=>'<button class="selection-button" data-set="'+i+'" aria-pressed="'+(collectionIndex===i)+'">'+textCard(s)+'<small>'+s.id+(state.history?.[s.id]?' ✓':'')+'</small></button>').join('')+'</div><div class="row collection-heading">'+textCard(set)+'<b>'+owned.length+' / '+items.length+'</b></div>'+(historical?'<div class="small">Collected before · rebuild this journey</div>':'')+'<progress value="'+owned.length+'" max="'+items.length+'"></progress><div class="collection">'+items.map(w=>'<div class="card '+(owned.includes(w.id)?'':historical?'previously-collected':'empty')+'">'+(owned.includes(w.id)||historical?(set.type==='sentences'?'<span data-speech="'+esc(w.tokens.map(id=>word(id).traditional).join(''))+'" class="sentence-mini">'+w.tokens.map(id=>hanzi(word(id))).join('')+'</span>'+englishTranslation(w):textCard(w)):'—')+'</div>').join('')+'</div><a class="secondary" href="memory.html">Memory cards</a><a class="secondary" href="bonus.html">Bonus puzzles</a>';
 if(previousPicker)screen.querySelector('.set-picker').replaceWith(previousPicker);
 screen.querySelectorAll('[data-set]').forEach(b=>{
  b.setAttribute('aria-pressed',String(collectionIndex===Number(b.dataset.set)));
  b.onclick=()=>{const index=Number(b.dataset.set);if(index===collectionIndex)return;collectionIndex=index;drawSets(true);refreshNumbers();screen.querySelector('[data-set="'+collectionIndex+'"]').focus({preventScroll:true})};
  if(E.isLocalDebugHost(location.hostname)){
   b.title='Debug: double-click to complete this set and claim its set reward';
   b.ondblclick=async()=>{
    if(busy)return;busy=true;
    try{
     const {result}=await transact(s=>E.debugCompleteSet(s,lessons,Number(b.dataset.set),location.hostname));
     drawSets();refreshNumbers();
     const message=document.createElement('div');message.className='offline-toast';message.setAttribute('role','status');
     message.textContent=result?.completed?'Set complete · +'+result.points.toLocaleString()+' coins':'Set already completed';
     document.body.append(message);setTimeout(()=>message.remove(),2400);
    }finally{busy=false}
   };
  }
 });
}
function drawRestart(){
 screen.innerHTML='<section class="rate"><div class="hanzi">再來</div><span class="pinyin">zài lái</span><div class="big">×'+E.permanent(state)+' → ×'+(E.permanent(state)+V.catalogue().progression.prestigeGain)+'</div></section><div class="reset-grid"><section class="panel"><b>Reset</b><p>Coins & resources<br>Cards and sets<br>Village & research</p></section><section class="panel"><b>Keep</b><p>Permanent multiplier<br>Settings</p></section></div><p class="small">New sentence selection next run.</p><button class="primary" id="restart" '+(state.completed.length?'':'disabled')+'>Restart</button>'+(!state.completed.length?'<p class="small">Collect a set to unlock.</p>':'');
 $('#restart').onclick=async()=>{if(busy)return;busy=true;await transact(s=>E.prestigeReset(s,lessons));location.href='home.html'};
}
function drawSettings(){
 const groups=[['englishTranslations','English translations · Sets, Village, Tech & rewards',[['always','Always show'],['until10','Until level 10'],['never','Never show']]],['script','Script',[['traditional','繁體'],['simplified','简体']]],['display','Display',[['both','Characters + pinyin'],['characters','Characters only'],['pinyin','Pinyin only']]],['voice','Voice',[['female','Female'],['male','Male']]],['muted','Sound',[['false','Sound on'],['true','Mute']]]];
 screen.innerHTML='<section class="settings"><h2>Cards & sound</h2><p class="small">English automatically hides when you first reach level 10, including after prestige.</p>'+groups.map(([key,title,options])=>'<fieldset class="setting-group"><legend>'+title+'</legend><div class="selection-grid '+(key==='display'||key==='englishTranslations'?'stack':'')+'">'+options.map(([value,label])=>'<button class="selection-button" data-setting="'+key+'" data-value="'+value+'" aria-pressed="'+(String(state.settings[key])===value)+'">'+label+'</button>').join('')+'</div></fieldset>').join('')+'</section>';
 screen.querySelectorAll('[data-setting]').forEach(b=>b.onclick=async()=>{const {setting,value}=b.dataset;await transact(s=>s.settings[setting]=setting==='muted'?value==='true':value);speech.stop();if(setting==='voice'||setting==='muted')speech.speak('一',{interrupt:true});drawSettings();screen.querySelector('[data-setting="'+setting+'"][data-value="'+value+'"]').focus({preventScroll:true})});
}
let bonusQ=null;
async function debugStep(){
 if(busy||gameClock.paused)return;
 if(debugAction){debugAction();return}
 if($('#continue')){$('#continue').click();return}
 if($('#claim')){$('#claim').click();return}
 
 // From utility pages, advance the underlying game by one correct interaction.
 busy=true;
 await transact(s=>{
  if(s.stage==='tap')return E.answerTap(s,lessons,s.current.id,s.current.id);
  if(s.stage==='match'){const id=E.matchBoard(s).find(id=>!s.matchFound.includes(id));return E.matchPair(s,lessons,id,id)}
  if(s.stage==='order'){const q=E.sentencePrompt(s,lessons);return E.answerSentence(s,lessons,q.tokens,q.id)}
  if(s.stage==='cardReward')return E.continueCardReward(s);
  if(s.stage==='setReward')return E.claimSet(s,lessons);
  if(s.stage==='gate')return E.advance(s,lessons);
 });
 busy=false;draw();
}
document.addEventListener('keydown',e=>{if(gameClock.paused)return;if(e.code==='Space'&&!e.target.matches('input,textarea,[contenteditable="true"]')){e.preventDefault();if(!e.repeat)debugStep()}});
window.addEventListener('message',e=>{if(e.source===parent&&e.origin===location.origin&&e.data==='debug-space')debugStep()});
mountShell();go();
const pauseControl=mountPause({clock:gameClock,onPause:()=>{speech.stop();scoreCounter.stop()},onResume:()=>transact()});
document.querySelector('.pause-button')?.addEventListener('click',()=>pauseControl.pause());
if(initial.earned>=1){const n=document.createElement('div');n.className='offline-toast';n.setAttribute('role','status');n.textContent='While away: +'+Math.floor(initial.earned).toLocaleString();document.body.append(n);setTimeout(()=>n.remove(),5000)}
window.addEventListener('storage',e=>{
 if(e.key!==E.SAVE_KEY)return;
 const previous=state;state=read();refreshNumbers();
 if(previous.resetToken!==state.resetToken){clearTimeout(feedbackTimer);clearTimeout(arenaTimer);arenaActivity?.abort();collectionIndex=state.setIndex;bonusQ=null;go();return}
 const stageChanged=previous.stage!==state.stage||previous.setIndex!==state.setIndex;
 const preferencesChanged=JSON.stringify(previous.settings)!==JSON.stringify(state.settings);
 const villageChanged=['village','tech','boosts'].includes(page)&&JSON.stringify(previous.village)!==JSON.stringify(state.village);
 const cardsChanged=page==='sets'&&JSON.stringify(previous.cards)!==JSON.stringify(state.cards);
 if(preferencesChanged)speech.stop();
 if(!busy&&(stageChanged||preferencesChanged||villageChanged||cardsChanged))go();
});
const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!gameClock.paused)transact()},1000);
window.addEventListener('pagehide',()=>{
 disposedrawTap();disposedrawMatch();disposedrawOrder();disposedrawBonus();pauseControl.dispose();gameClock.dispose();speech.dispose();pairActivity?.abort();battle?.dispose();clearInterval(timer);clearTimeout(feedbackTimer);clearTimeout(arenaTimer);arenaActivity?.abort();scoreCounter.stop();
 try{sessionStorage.setItem('village-score-display',JSON.stringify({value:scoreCounter.value(),prestige:state.prestige,resetToken:state.resetToken||null}))}catch{}
});


export {state,lessons,tokens,screen,word,hanzi,textCard,wrapNumberLabel,dictionary,transact,go,refreshNumbers,speech,gameClock,esc,$,setDebugAction};
function setDebugAction(fn){debugAction=fn}

function drawGate(){
 const checks=V.gateStatus(state,state.level||1),ready=checks.every(g=>g.have>=g.need);
 screen.classList.add('village-gate');
 screen.innerHTML='<section class="gate-banner"><i class="sprite sprite-village"></i><h2>A village to grow</h2><p>Your next journey needs a stronger village.</p></section><div class="gate-checks">'+checks.map((g,i)=>'<div class="row"><span class="goal-label">'+g.label+'<button class="goal-help" type="button" data-goal-help="'+i+'" aria-label="About '+g.label+'" aria-haspopup="dialog">?</button></span><b>'+(g.have>=g.need?'✓':g.have+' / '+g.need)+'</b></div>').join('')+'</div><a class="primary" href="village.html">Build your village</a><a class="secondary" href="memory.html">Play memory · earn coins</a><button class="primary" id="advance" '+(ready?'':'disabled')+'>Next journey</button><nav class="journey-extras" aria-label="More ways to play"><a class="secondary" href="memory.html">Memory</a><a class="secondary" href="bonus.html">Bonus</a><a class="secondary" href="restart.html">Prestige ×'+E.permanent(state)+'</a></nav>';
 screen.insertAdjacentHTML('beforeend','<dialog class="goal-dialog" aria-labelledby="goal-help-title"><h2 id="goal-help-title"></h2><p class="goal-help-status"></p><p class="goal-help-copy"></p><button class="primary" type="button">Got it</button></dialog>');
 const dialog=screen.querySelector('.goal-dialog');
 screen.querySelectorAll('[data-goal-help]').forEach(button=>button.onclick=()=>{
  const goal=checks[Number(button.dataset.goalHelp)];
  dialog.querySelector('h2').textContent=goal.label;
  dialog.querySelector('.goal-help-status').textContent=(goal.have>=goal.need?'Complete · ':'Still needed · ')+goal.have+' / '+goal.need;
  dialog.querySelector('.goal-help-copy').textContent=goal.help;
  dialog.showModal();
 });
 dialog.querySelector('button').onclick=()=>dialog.close();
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()}});
 $('#advance').onclick=async()=>{await transact(s=>E.advance(s,lessons));go()};
}
