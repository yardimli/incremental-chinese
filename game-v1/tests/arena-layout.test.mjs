import test from 'node:test';
import assert from 'node:assert/strict';
import {scatterCards} from '../arena-layout.mjs';
test('scattered cards stay apart, in bounds and below the dictionary',()=>{
 let seed=98;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const bottom of [0,180,270,330])for(let count=2;count<=5;count++)for(let run=0;run<30;run++){
  const points=scatterCards(357,672,count,107,96,bottom,random);
  assert.equal(points.length,count);
  points.forEach((p,i)=>{
   assert.ok(p.x>=0&&p.x+107<=357&&p.y>=bottom&&p.y+96<=672);
   for(const q of points.slice(i+1))assert.ok(Math.abs(p.x-q.x)>=121||Math.abs(p.y-q.y)>=110);
  });
 }
});
test('new cosmetic random samples change the layout',()=>{
 assert.notDeepEqual(scatterCards(357,672,5,107,96,180),scatterCards(357,672,5,107,96,180));
});
