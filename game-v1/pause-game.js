export function mountPause({clock,onPause,onResume}){
 const abort=new AbortController(),animations=new Set();let idleTimer,focusTimer,previousFocus,startupPause=false;
 const overlay=document.createElement('div');overlay.className='pause-overlay';overlay.hidden=true;
 overlay.innerHTML='<section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">Paused</h2><p data-reason></p><button class="primary" type="button">Resume</button></section>';
 document.body.append(overlay);
 let host=window;try{if(window.top.location.origin===location.origin)host=window.top}catch{}
 const hasGameFocus=()=>document.hasFocus()||host.document.hasFocus();
 function freezeAnimations(){if(!clock.paused)return;for(const animation of document.getAnimations())if(animation.playState==='running'){animations.add(animation);animation.pause()}}
 function activity(){if(clock.paused)return;clearTimeout(idleTimer);idleTimer=setTimeout(()=>pause('No activity for 30 seconds'),30000)}
 function pause(reason,{startup=false}={}){
  if(clock.paused)return;
  clearTimeout(idleTimer);startupPause=startup;clock.pause();onPause();previousFocus=document.activeElement;
  document.querySelectorAll('#screen,.header,.footer').forEach(el=>el.inert=!startup);
  overlay.querySelector('[data-reason]').textContent=reason;overlay.hidden=startup;
  freezeAnimations();if(!startup)overlay.querySelector('button').focus({preventScroll:true});
 }
 function resume(){
  if(document.hidden||(!startupPause&&!hasGameFocus()))return;
  const wasStartup=startupPause;startupPause=false;
  overlay.hidden=true;document.querySelectorAll('#screen,.header,.footer').forEach(el=>el.inert=false);
  for(const animation of animations)if(animation.playState==='paused')animation.play();animations.clear();
  clock.resume();if(!wasStartup)previousFocus?.focus?.({preventScroll:true});onResume();activity();
 }
 overlay.querySelector('button').onclick=resume;
 const listen=(target,type,fn)=>target.addEventListener(type,fn,{signal:abort.signal,capture:true,passive:true});
 for(const target of new Set([document,host.document]))for(const type of ['pointerdown','pointermove','keydown','wheel','click'])listen(target,type,activity);
 listen(host,'blur',()=>{
  // Clicking into the iframe blurs its host window without leaving the game.
  // Wait for focus to settle, then check both documents before pausing.
  clearTimeout(focusTimer);
  focusTimer=setTimeout(()=>{if(document.hidden||!hasGameFocus())pause('Game is out of focus')},0);
 });
 listen(document,'visibilitychange',()=>{if(document.hidden)pause('Game is out of focus');else if(startupPause)resume()});
 const observer=new MutationObserver(freezeAnimations);observer.observe(document.body,{childList:true,subtree:true});
 // Focus can lag behind a visible page during reload or iframe navigation.
 // Start visible pages immediately; actual blur/visibility events still pause.
 activity();if(document.hidden)pause('Game is out of focus',{startup:true});
 return {pause:()=>pause('Take a break'),dispose(){abort.abort();observer.disconnect();clearTimeout(idleTimer);clearTimeout(focusTimer);overlay.remove()}};
}
