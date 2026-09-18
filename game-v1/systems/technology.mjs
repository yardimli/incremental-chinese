import {catalogue,ensureVillage,frontier,canPay,pay} from './village.mjs';
export function researchLock(s,r){
 const v=ensureVillage(s);
 if(v.research.includes(r.id))return 'Complete';
 if(frontier(s)<r.level)return 'Clear L'+r.level;
 if(r.previous&&!v.research.includes(r.previous))return r.previous;
 if(!canPay(s,r.cost))return 'Need resources';
 return '';
}
export function research(s,id){
 const r=catalogue().research.find(r=>r.id===id);
 if(!r||researchLock(s,r))return false;
 pay(s,r.cost);s.village.research.push(id);return true;
}
