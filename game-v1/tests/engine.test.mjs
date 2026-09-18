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
