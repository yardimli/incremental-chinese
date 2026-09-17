import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as E from '../engine.mjs';
const manifest=JSON.parse(await readFile(new URL('../lessons/index.json',import.meta.url)));
const lessons=await Promise.all(manifest.sets.map(async f=>JSON.parse(await readFile(new URL('../lessons/'+f,import.meta.url)))));
function finishTap(s){
  let taps=0;const counts={};
  while(s.stage==='tap'||s.stage==='cardReward'){
    if(s.stage==='cardReward'){E.continueCardReward(s);continue}
    const key=s.difficulty+':'+s.current.id;
    counts[key]=(counts[key]||0)+1;
    const r=E.answerTap(s,lessons,s.current.id,s.current.id);
    assert.equal(r.correct,true);taps++;
    assert.ok(taps<=lessons[s.setIndex].pairs.length*8);
  }
  for(const n of Object.values(counts))assert.equal(n,2);
  return taps;
}
function finishMatch(s){
  let boards=new Set(),reveals=0;
  while(s.stage==='match'||s.stage==='cardReward'){
    if(s.stage==='cardReward'){
      reveals++;
      assert.ok(s.pendingReward.ids.length>0);
      E.continueCardReward(s);
      assert.equal(E.continueCardReward(s),false);
      continue;
    }
    boards.add(s.pageIndex);
    const id=E.matchBoard(s).find(id=>!s.matchFound.includes(id));
    E.matchPair(s,lessons,id,id);
  }
  return {boards:boards.size,reveals};
}
test('six correctly sized pair sets and thirty valid sentence combinations',()=>{
  E.validateLessons(lessons);
  assert.deepEqual(lessons.slice(0,6).map(x=>x.pairs.length),[18,10,10,15,15,15]);
  assert.equal(lessons[6].sentences.length,30);
});
test('fresh start has no passive income; wrong taps do not advance mastery',()=>{
  const s=E.freshState(lessons,1000);
  assert.equal(E.accrue(s,86401000),0);assert.equal(s.coins,0);
  while(s.difficulty===1){if(s.stage==='cardReward')E.continueCardReward(s);else E.answerTap(s,lessons,s.current.id,s.current.id)}
  if(s.stage==='cardReward')E.continueCardReward(s);
  const q={...s.current},before=s.coins;
  const r=E.answerTap(s,lessons,q.options.find(x=>x!==q.id),q.id);
  assert.equal(r.correct,false);assert.equal(s.coins,before);assert.equal(s.correct[q.id]||0,0);
  assert.ok(s.seen.includes(q.id));
  assert.equal(E.answerTap(s,lessons,'nonexistent','stale'),null);
});
test('full game: 1–4 choices, two correct per pair, paged matching, gradual rewards and seven awards',()=>{
  const s=E.freshState(lessons,1000,728);
  for(let i=0;i<6;i++){
    assert.equal(s.setIndex,i);
    assert.equal(finishTap(s),lessons[i].pairs.length*8);
    assert.equal(s.stage,'match');
    assert.equal(s.cards[lessons[i].id].length,Math.round(lessons[i].pairs.length*0.4));
    const first=E.matchBoard(s);const coins=s.coins;
    assert.equal(E.matchPair(s,lessons,first[0],first[1]).correct,false);
    assert.equal(s.coins,coins);
    const out=finishMatch(s);
    assert.equal(out.boards,Math.ceil(lessons[i].pairs.length/5));
    assert.ok(out.reveals>1);
    assert.equal(s.stage,'setReward');
    assert.equal(s.cards[lessons[i].id].length,lessons[i].pairs.length);
    assert.equal(s.completed.length,i);
    assert.ok(E.claimSet(s,lessons));
    assert.equal(E.claimSet(s,lessons),false);
    assert.equal(s.completed.length,i+1);
  }
  assert.equal(s.stage,'order');
  assert.equal(new Set(s.sentenceDeck).size,10);
  for(let i=0;i<10;i++){
    const q=E.sentencePrompt(s,lessons),coins=s.coins;
    assert.equal(E.answerSentence(s,lessons,[],q.id).correct,false);
    assert.equal(s.coins,coins);
    assert.equal(E.answerSentence(s,lessons,q.tokens,q.id).correct,true);
  }
  assert.equal(s.stage,'setReward');assert.equal(s.cards.sentences.length,10);
  E.claimSet(s,lessons);assert.equal(s.stage,'finished');assert.equal(s.completed.length,7);
});
test('offline accrual is paid once, upgrades use coins, prestige removes old income and rotates sentences',()=>{
  const s=E.freshState(lessons,1000);
  const deck=[...s.sentenceDeck];
  finishTap(s);finishMatch(s);
  assert.equal(E.idleRate(s),0);
  E.claimSet(s,lessons);
  const before=s.coins;
  assert.equal(E.accrue(s,11000),1);
  assert.equal(s.coins,before+1);assert.equal(E.accrue(s,11000),0);
  assert.equal(E.accrue(s,1000),0);
  const saved=JSON.parse(JSON.stringify(s));
  assert.equal(E.accrue(saved,21000),1);
  const cost=E.upgradeCost(s,'tap');const oldTap=E.tapValue(s);
  assert.equal(E.buy(s,'tap'),true);assert.equal(s.coins,before+1-cost);assert.ok(E.tapValue(s)>oldTap);
  s.settings.display='pinyin';assert.equal(E.prestigeReset(s,lessons,22000),true);
  assert.equal(s.coins,0);assert.equal(E.idleRate(s),0);assert.equal(s.setIndex,0);assert.deepEqual(s.cards,{});
  assert.equal(s.settings.display,'pinyin');assert.equal(E.permanent(s),1.5);
  assert.ok(s.sentenceDeck.every(x=>!deck.includes(x)));
  assert.equal(E.accrue(s,86422000),0);
});

test('matching also paginates future twenty- and twenty-five-pair sets',()=>{
  for(const size of [20,25]){
    const expanded=structuredClone(lessons);
    const set=expanded[3];
    while(set.pairs.length<size)set.pairs.push({...set.pairs[0],id:'extra-'+set.pairs.length});
    E.validateLessons(expanded);
    const s=E.freshState(expanded,1000);
    s.setIndex=3;s.stage='match';s.matchOrder=set.pairs.map(p=>p.id);
    let boards=new Set();
    while(s.stage==='match'||s.stage==='cardReward'){
      if(s.stage==='cardReward'){E.continueCardReward(s);continue}
      boards.add(s.pageIndex);
      const id=E.matchBoard(s).find(id=>!s.matchFound.includes(id));
      E.matchPair(s,expanded,id,id);
    }
    assert.equal(boards.size,size/5);
    assert.equal(s.cards[set.id].length,size);
  }
});

test('unanswered targets rotate without score, discovery, or mastery and can still be completed',()=>{
 const s=E.freshState(lessons,0,1234),id=s.current.id;
 const before={coins:s.coins,correct:{...s.correct},seen:[...s.seen],difficulty:s.difficulty};
 assert.deepEqual(E.skipTap(s,lessons,id),{id,unanswered:true,correct:false,points:0});
 assert.equal(s.unanswered,1);
 assert.notEqual(s.current.id,id);
 assert.deepEqual({coins:s.coins,correct:s.correct,seen:s.seen,difficulty:s.difficulty},before);
 assert.equal(E.skipTap(s,lessons,id),null);
 assert.equal(s.unanswered,1);
 finishTap(s);
 assert.equal(s.stage,'match');
 assert.equal(E.skipTap(s,lessons,id),null);
});

test('older unfinished number sets can match the newly added values',()=>{
 const s=E.freshState(lessons,0);
 s.matchOrder=lessons[0].pairs.slice(0,10).map(w=>w.id);
 s.matchFound=[...s.matchOrder];s.stage='setReward';
 E.reconcileLessons(s,lessons);
 assert.equal(s.stage,'match');assert.equal(s.pageIndex,2);assert.equal(s.matchOrder.length,18);
 finishMatch(s);assert.equal(s.stage,'setReward');
});

test('persistent weapons survive hits until mastery and misses preserve targets',()=>{
 const s=E.freshState(lessons,0,92);s.difficulty=2;s.current=null;E.newPrompt(s,lessons);
 const before=[...s.weapons],id=s.current.id;
 const wrong=before.find(w=>w!==id),targets=[...s.current.targets];
 E.answerTap(s,lessons,wrong,id);assert.deepEqual(s.current.targets,targets);assert.deepEqual(s.weapons,before);
 E.answerTap(s,lessons,id,id);assert.deepEqual(s.weapons,before);
 if(s.stage==='cardReward')E.continueCardReward(s);
 s.correct[id]=2;E.newPrompt(s,lessons,id);assert.ok(!s.weapons.includes(id));
});
test('four weapons support two independently resolved targets and escapes do not master',()=>{
 const s=E.freshState(lessons,0,77);s.difficulty=4;s.current=null;s.arrivals=2;E.newPrompt(s,lessons);
 assert.equal(s.current.targets.length,2);const [a,b]=s.current.targets;
 E.answerTap(s,lessons,b,b);assert.equal(s.correct[b],1);assert.ok(s.current.targets.includes(a));
 const coins=s.coins;E.skipTap(s,lessons,a);assert.equal(s.correct[a]||0,0);assert.equal(s.coins,coins);
 assert.ok(s.current.targets.every(id=>s.weapons.includes(id)));
});
