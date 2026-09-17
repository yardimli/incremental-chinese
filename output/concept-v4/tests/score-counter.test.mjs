import test from 'node:test';
import assert from 'node:assert/strict';
import {createScoreCounter} from '../score-counter.mjs';
function counter(start){let now=0,id=0;const pending=new Map(),seen=[];const c=createScoreCounter(start,v=>seen.push(v),()=>now,fn=>{pending.set(++id,fn);return id},key=>pending.delete(key));return {c,seen,step(ms){now+=ms;const jobs=[...pending.values()];pending.clear();jobs.forEach(fn=>fn())}}}
test('small gains count through every integer',()=>{const t=counter(200);t.c.update(205);for(let i=0;i<5;i++)t.step(40);assert.deepEqual(t.seen,[201,202,203,204,205])});
test('new gains continue from current display and repeated refreshes do not restart',()=>{const t=counter(200);t.c.update(205);t.step(40);t.c.update(205);t.step(40);assert.equal(t.c.value(),202);t.c.update(210);t.step(600);assert.equal(t.c.value(),210)});
test('spending and resets apply immediately; large gains finish quickly',()=>{const t=counter(200);t.c.update(1000000);t.step(600);assert.equal(t.c.value(),1000000);t.c.update(0);assert.equal(t.c.value(),0)});
