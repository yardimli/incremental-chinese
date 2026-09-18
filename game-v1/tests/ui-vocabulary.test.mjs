import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const lessons=read('lessons/index.json').sets.map(path=>read('lessons/'+path));
const words=lessons.flatMap(set=>set.pairs||[]);

test('game labels and set titles are covered by lesson words',()=>{
 const vocabulary=new Set(words.flatMap(w=>[w.simplified,w.traditional]));
 const covered=text=>{
  const reachable=new Set([0]);
  for(let i=0;i<text.length;i++)if(reachable.has(i))
   for(const word of vocabulary)if(text.startsWith(word,i))reachable.add(i+word.length);
  return reachable.has(text.length);
 };
 for(const name of ['resources','buildings','research'])
  for(const item of read('data/'+name+'.json'))
   assert.ok(vocabulary.has(item.simplified),name+': '+item.simplified);
 for(const title of Object.values(read('data/set-titles.json')))
  assert.ok(covered(title.simplified),'Untaught title vocabulary: '+title.simplified);
 // All hardcoded Chinese headings and script choices in the active game UI.
 for(const file of ['shared.js','ui/village.js','ui/technology.js','modes/battle.js']){
  const source=readFileSync(new URL(file,root),'utf8');
  for(const text of source.match(/[\p{Script=Han}]+/gu)||[])
   assert.ok(covered(text),file+': '+text);
 }
 assert.ok(lessons.find(s=>s.id==='V01').pairs.some(w=>w.simplified==='村落'));
 for(const set of lessons)assert.ok((set.pairs||[]).length<=20,set.id);
 assert.equal(new Set(words.map(w=>w.id)).size,words.length);
});
