import test from 'node:test';
import assert from 'node:assert/strict';
import {englishCardLabel} from '../card-labels.mjs';
test('single digits use 60 percent digits and 40 percent words independently',()=>{
 const word={number:7,english:'seven'};
 const labels=Array.from({length:100},(_,i)=>englishCardLabel(word,()=>i/100));
 assert.equal(labels.filter(s=>s==='7').length,60);
 assert.equal(labels.filter(s=>s==='seven').length,40);
});
test('ten and larger values always use comma-separated digits',()=>{
 for(const number of [10,100,1000,10000,100000,1000000,100000000,1000000000000]){
  assert.equal(englishCardLabel({number,english:'unused'},()=>0.99),number.toLocaleString('en-US'));
 }
 assert.equal(englishCardLabel({english:'hot coffee'}),'hot coffee');
});
