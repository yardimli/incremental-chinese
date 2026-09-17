// Pure state transitions. Every award is committed before its reveal is shown.
export const SAVE_KEY = 'chinese-game-v1';
export const upgradeSpecs = [
  {id:'tap', name:'加倍', pinyin:'jiā bèi', cost:100, kind:'tap'},
  {id:'tap2', name:'力量', pinyin:'lì liàng', cost:400, kind:'tap'},
  {id:'idle', name:'成長', pinyin:'chéng zhǎng', cost:250, kind:'idle'},
  {id:'idle2', name:'積累', simplified:'积累', pinyin:'jī lěi', cost:800, kind:'idle'},
  {id:'offline', name:'休息', pinyin:'xiū xi', cost:500, kind:'offline'},
  {id:'offline2', name:'時間', simplified:'时间', pinyin:'shí jiān', cost:1500, kind:'offline'},
  {id:'award', name:'收穫', simplified:'收获', pinyin:'shōu huò', cost:1000, kind:'award'},
  {id:'award2', name:'豐收', simplified:'丰收', pinyin:'fēng shōu', cost:3000, kind:'award'}
];
export function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
export function shuffle(s, items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function validateLessons(lessons) {
  if (lessons.length !== 7) throw new Error('Expected six pair sets and one sentence set.');
  const ids = new Set();
  lessons.slice(0, 6).forEach((set, i) => {
    if (!(i === 0 ? [18,20,25] : i < 3 ? [10] : [15,20,25]).includes(set.pairs.length)) throw new Error('Wrong pair count: ' + set.id);
    for (const pair of set.pairs) {
      if (ids.has(pair.id)) throw new Error('Duplicate token ' + pair.id);
      ids.add(pair.id);
      for (const key of ['traditional','simplified','pinyin','english']) if (!pair[key]) throw new Error('Missing ' + key);
    }
  });
  const last = lessons[6];
  if (last.sentences.length < last.countPerRun * 3) throw new Error('Sentence pool is too small.');
  for (const sentence of last.sentences) {
    if (sentence.tokens.length < 2 || sentence.tokens.length > 4) throw new Error('Sentence must have 2–4 tokens.');
    if (sentence.tokens.some(id => !ids.has(id))) throw new Error('Unknown sentence token.');
  }
}
export function freshState(lessons, now = Date.now(), seed = 42) {
  const s = {version:1, coins:0, prestige:0, rng:seed >>> 0, lastAccrual:now,
    upgrades:{}, completed:[], cards:{}, settings:{script:'traditional', display:'both',voice:'female',muted:false},
    setIndex:0, stage:'tap', difficulty:1, correct:{}, seen:[], current:null,
    matchOrder:[], matchFound:[], pageIndex:0, pendingReward:null,
    sentenceIndex:0, sentenceSolved:[], sentenceDeck:[], sentencePool:[], revision:0};
  s.sentencePool = shuffle(s, lessons[6].sentences.map(x => x.id));
  s.sentenceDeck = s.sentencePool.slice(0, 10);
  newPrompt(s, lessons);
  return s;
}
export function reconcileLessons(s,lessons){
 // Resume an older, unfinished first set after its number list grows.
 if(s.setIndex!==0||s.completed.includes(lessons[0].id)||!s.matchOrder.length)return;
 const added=lessons[0].pairs.map(w=>w.id).filter(id=>!s.matchOrder.includes(id));
 if(!added.length)return;
 const oldLength=s.matchOrder.length;
 s.matchOrder.push(...added);
 if(s.stage==='setReward'){s.stage='match';s.pageIndex=Math.floor(oldLength/5);s.pendingReward=null}
 if(s.stage==='cardReward'&&s.pendingReward){
  if(s.pendingReward.allDone)s.pageIndex=Math.floor(oldLength/5);
  s.pendingReward.total=lessons[0].pairs.length;
  s.pendingReward.allDone=false;
 }
}
export function factor(s, kind) {
  return upgradeSpecs.filter(x => x.kind === kind).reduce((n,x) => n * Math.pow(1.2, s.upgrades[x.id] || 0), 1);
}
export const permanent = s => 1 + s.prestige * 0.5;
export const tapValue = s => Math.round(10 * permanent(s) * factor(s,'tap'));
export const idleRate = s => s.completed.length * 0.1 * permanent(s) * factor(s,'idle');
export function accrue(s, now = Date.now()) {
  const seconds = Math.max(0, now - s.lastAccrual) / 1000;
  const value = seconds * idleRate(s) * (seconds >= 60 ? factor(s,'offline') : 1);
  s.coins += value;
  s.lastAccrual = Math.max(s.lastAccrual, now);
  return value;
}
export function newPrompt(s, lessons, resolvedId) {
  if (s.stage !== 'tap') return;
  const pairs = lessons[s.setIndex].pairs;
  let eligible = pairs.filter(x => (s.correct[x.id] || 0) < 2);
  if (!eligible.length) {
    if (s.difficulty < 4) {
      s.difficulty++;
      s.correct = {};
      s.weapons=[];s.current=null;
      eligible = pairs;
    } else {
      s.stage = 'match';
      s.matchOrder = shuffle(s, pairs.map(x => x.id));
      s.matchFound = [];
      s.pageIndex = 0;
      s.current = null;
      return;
    }
  }
  if(s.difficulty>=2){
    const previous=s.current;
    const weapons=(s.weapons||[]).filter(id=>pairs.some(w=>w.id===id));
    const candidates=shuffle(s,eligible.filter(w=>!weapons.includes(w.id))).map(w=>w.id);
    for(let i=0;i<weapons.length;i++)if((s.correct[weapons[i]]||0)>=2&&candidates.length)weapons[i]=candidates.pop();
    while(weapons.length<s.difficulty&&candidates.length)weapons.push(candidates.pop());
    // Late in a pass, completed weapons remain as inactive equipment.
    for(const w of shuffle(s,pairs))if(weapons.length<s.difficulty&&!weapons.includes(w.id))weapons.push(w.id);
    s.weapons=weapons;
    const remaining=(previous?.targets||[]).filter(id=>id!==resolvedId&&weapons.includes(id)&&(s.correct[id]||0)<2);
    const available=weapons.filter(id=>(s.correct[id]||0)<2&&!remaining.includes(id));
    const fresh=available.filter(id=>id!==previous?.id);
    if(!remaining.length){const pool=fresh.length?fresh:available;if(pool.length)remaining.push(pool[Math.floor(random(s)*pool.length)])}
    s.arrivals=(s.arrivals||0)+1;
    if(s.difficulty===4&&s.arrivals%3===0&&remaining.length<2){
      const extra=weapons.filter(id=>(s.correct[id]||0)<2&&!remaining.includes(id));
      if(extra.length)remaining.push(extra[Math.floor(random(s)*extra.length)]);
    }
    s.current={id:remaining[0],targets:remaining,options:[...weapons]};
    return;
  }
  const previous = s.current?.id;
  const alternatives = eligible.filter(x => x.id !== previous);
  const pool = alternatives.length ? alternatives : eligible;
  const target = pool[Math.floor(random(s) * pool.length)];
  const wrong = shuffle(s, pairs.filter(x => x.id !== target.id)).slice(0,s.difficulty - 1);
  s.current = {id:target.id, options:shuffle(s,[target.id,...wrong.map(x => x.id)])};
}
export function answerTap(s, lessons, choice, expectedId) {
  if (s.stage !== 'tap' || !s.current || !(s.current.targets||[s.current.id]).includes(expectedId) || !s.current.options.includes(choice)) return null;
  const id = expectedId;
  const correct = choice === id;
  if (!s.seen.includes(id)) s.seen.push(id);
  if (correct) { s.correct[id] = (s.correct[id] || 0) + 1; s.coins += tapValue(s); }
  const feedback = {id, correct, points:correct ? tapValue(s) : 0};
  const set=lessons[s.setIndex];
  const progress=(s.difficulty-1)*set.pairs.length*2+Object.values(s.correct).reduce((a,b)=>a+b,0);
  if(correct||s.difficulty===1)newPrompt(s, lessons,id);
  const quota=Math.round(set.pairs.length*0.4),owned=s.cards[set.id]||[];
  const earned=Math.floor(progress/(set.pairs.length*8)*quota);
  if(correct&&owned.length<earned){
    const next=set.pairs.find(w=>s.seen.includes(w.id)&&!owned.includes(w.id));
    if(next){
      const resume=s.stage;
      s.cards[set.id]=[...owned,next.id];
      s.pendingReward={type:'cards',setId:set.id,ids:[next.id],before:owned.length,after:owned.length+1,total:set.pairs.length,allDone:false,resume};
      s.stage='cardReward';
    }
  }
  return feedback;
}
export function skipTap(s, lessons, expectedId) {
  if (s.stage !== 'tap' || !(s.current?.targets||[s.current?.id]).includes(expectedId)) return null;
  const id=expectedId;
  s.unanswered=(s.unanswered||0)+1;
  newPrompt(s,lessons,id);
  return {id,unanswered:true,correct:false,points:0};
}
export function matchBoard(s) { return s.matchOrder.slice(s.pageIndex * 5, s.pageIndex * 5 + 5); }
export function matchPair(s, lessons, left, right) {
  if (s.stage !== 'match' || !matchBoard(s).includes(left) || !matchBoard(s).includes(right) || s.matchFound.includes(left)) return null;
  if (left !== right) return {correct:false,points:0};
  s.matchFound.push(left);
  s.coins += tapValue(s);
  const set = lessons[s.setIndex];
  const boardDone = matchBoard(s).every(id => s.matchFound.includes(id));
  const allDone = s.matchFound.length === set.pairs.length;
  const owned = s.cards[set.id] || [];
  const waiting = s.matchFound.filter(id => !owned.includes(id)).slice(0,allDone?Infinity:Math.max(0,set.pairs.length-owned.length-1));
  if (waiting.length && (waiting.length >= 2 || boardDone)) {
    s.cards[set.id] = [...owned,...waiting];
    s.pendingReward = {type:'cards', setId:set.id, ids:waiting, before:owned.length,
      after:owned.length + waiting.length, total:set.pairs.length, allDone};
    s.stage = 'cardReward';
  }
  if(allDone&&!waiting.length)s.stage='setReward';
  if (boardDone && !allDone) s.pageIndex++;
  return {correct:true, points:tapValue(s)};
}
export function continueCardReward(s) {
  if (s.stage !== 'cardReward') return false;
  s.stage = s.pendingReward.resume || (s.pendingReward.allDone ? 'setReward' : 'match');
  s.pendingReward = null;
  return true;
}
export function claimSet(s, lessons) {
  if (s.stage !== 'setReward') return false;
  const set = lessons[s.setIndex];
  if (s.completed.includes(set.id)) return false;
  s.completed.push(set.id);
  s.coins += Math.round(100 * (s.setIndex + 1) * permanent(s) * factor(s,'award'));
  if (s.setIndex === 6) {s.stage='finished'; return true;}
  s.setIndex++;
  s.seen=[]; s.correct={}; s.difficulty=1; s.current=null;
  s.weapons=[];s.arrivals=0;
  s.matchOrder=[]; s.matchFound=[]; s.pageIndex=0;
  s.stage=s.setIndex===6?'order':'tap';
  if (s.stage==='tap') newPrompt(s, lessons);
  return true;
}
export function sentencePrompt(s, lessons) {
  return lessons[6].sentences.find(x=>x.id===s.sentenceDeck[s.sentenceIndex]);
}
export function answerSentence(s, lessons, tokens, expectedId) {
  if (s.stage !== 'order') return null;
  const q=sentencePrompt(s,lessons);
  if (q.id !== expectedId) return null;
  const correct=tokens.length===q.tokens.length && tokens.every((x,i)=>x===q.tokens[i]);
  if (!correct) return {correct:false,points:0};
  s.coins+=tapValue(s)*3;
  s.sentenceSolved.push(q.id);
  s.cards.sentences=[...s.sentenceSolved];
  s.sentenceIndex++;
  if (s.sentenceIndex===lessons[6].countPerRun) s.stage='setReward';
  return {correct:true,points:tapValue(s)*3};
}
export const upgradeCost=(s,id)=>Math.ceil(upgradeSpecs.find(x=>x.id===id).cost*Math.pow(1.7,s.upgrades[id]||0));
export function buy(s,id) {
  if (!upgradeSpecs.some(x=>x.id===id)) return false;
  const cost=upgradeCost(s,id);
  if(s.coins<cost)return false;
  s.coins-=cost;s.upgrades[id]=(s.upgrades[id]||0)+1;return true;
}
export function prestigeReset(s,lessons,now=Date.now()) {
  if (!s.completed.length) return false;
  const pool=s.sentencePool;
  const previousDeck=s.sentenceDeck;
  const settings={...s.settings};
  const next=s.prestige+1;
  const replacement=freshState(lessons,now,s.rng);
  replacement.prestige=next;
  replacement.settings=settings;
  replacement.sentencePool=pool;
  replacement.sentenceDeck=shuffle(replacement,pool.filter(id=>!previousDeck.includes(id))).slice(0,10);
  Object.assign(s,replacement);
  return true;
}
