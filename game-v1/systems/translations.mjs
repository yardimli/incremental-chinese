export function reachedLevel(s){
 return Math.max(1,s.highestLevel||1,s.level||1,...[...(s.completed||[]),...Object.keys(s.history||{})].filter(id=>/^L\d+$/.test(id)).map(id=>Number(id.slice(1))));
}
export function showEnglish(s){
 const mode=s.settings?.englishTranslations||'until10';
 return mode==='always'||(mode==='until10'&&reachedLevel(s)<10);
}
