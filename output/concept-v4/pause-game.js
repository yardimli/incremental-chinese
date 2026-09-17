export function mountPause({clock,onPause,onResume}){
 const abort=new AbortController(),animations=new Set();let idleTimer,previousFocus;
 const overlay=document.createElement('div');overlay.className='pause-overlay';overlay.hidden=true;
 overlay.innerHTML='<section class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">Paused</h2><p data-reason></p><button class="primary" type="button">Resume</button></section>';
 document.body.append(overlay);
 let host=window;try{if(window.top.location.origin===location.origin)host=window.top}catch{}
 function freezeAnimations(){if(!clock.paused)return;for(const animation of document.getAnimations())if(animation.playState==='running'){animations.add(animation);animation.pause()}}
 function activity(){if(clock.paused)return;clearTimeout(idleTimer);idleTimer=setTimeout(()=>pause('No activity for 30 seconds'),30000)}
 function pause(reason){
  if(clock.paused)return;
  clearTimeout(idleTimer);clock.pause();onPause();previousFocus=document.activeElement;
  document.querySelectorAll('#screen,.header,.footer').forEach(el=>el.inert=true);
  overlay.querySelector('[data-reason]').textContent=reason;overlay.hidden=false;
  freezeAnimations();overlay.querySelector('button').focus({preventScroll:true});
 }
 function resume(){
  if(document.hidden||!host.document.hasFocus())return;
  overlay.hidden=true;document.querySelectorAll('#screen,.header,.footer').forEach(el=>el.inert=false);
  for(const animation of animations)if(animation.playState==='paused')animation.play();animations.clear();
  clock.resume();previousFocus?.focus?.({preventScroll:true});onResume();activity();
 }
 overlay.querySelector('button').onclick=resume;
 const listen=(target,type,fn)=>target.addEventListener(type,fn,{signal:abort.signal,capture:true,passive:true});
 for(const target of new Set([document,host.document]))for(const type of ['pointerdown','pointermove','keydown','wheel','click'])listen(target,type,activity);
 listen(host,'blur',()=>pause('Game is out of focus'));
 listen(document,'visibilitychange',()=>{if(document.hidden)pause('Game is out of focus')});
 const observer=new MutationObserver(freezeAnimations);observer.observe(document.body,{childList:true,subtree:true});
 activity();if(document.hidden||!host.document.hasFocus())pause('Game is out of focus');
 return {dispose(){abort.abort();observer.disconnect();clearTimeout(idleTimer);overlay.remove()}};
}
