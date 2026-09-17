// Pointer events support both touch and mouse without taking cards out of layout.
export function bindPairDrag(source,{getTargets,onDrop,enabled=()=>true,signal}){
 let drag=null,ghost=null,hover=null,suppress=false;
 const clear=()=>{ghost?.remove();ghost=null;hover?.classList.remove('drop-ready');hover=null;source.classList.remove('pair-dragging');drag=null};
 const hit=(x,y)=>getTargets().find(el=>{
  if(el===source||el.disabled||!el.isConnected)return false;
  const r=el.getBoundingClientRect();return x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;
 });
 source.addEventListener('dragstart',e=>e.preventDefault(),{signal});
 source.addEventListener('pointerdown',e=>{
  if(e.button!==0||source.disabled||!enabled())return;
  suppress=false;drag={id:e.pointerId,x:e.clientX,y:e.clientY,rect:source.getBoundingClientRect(),moved:false};
  source.setPointerCapture(e.pointerId);
 },{signal});
 source.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.moved&&Math.hypot(dx,dy)<6)return;
  if(!drag.moved){
   drag.moved=true;ghost=source.cloneNode(true);ghost.removeAttribute('id');ghost.removeAttribute('disabled');ghost.setAttribute('aria-hidden','true');
   ghost.classList.add('pair-drag-ghost');
   ghost.style.cssText='position:fixed!important;left:'+drag.rect.left+'px!important;top:'+drag.rect.top+'px!important;width:'+drag.rect.width+'px!important;height:'+drag.rect.height+'px!important;margin:0!important;';
   document.body.append(ghost);source.classList.add('pair-dragging');
  }
  ghost.style.transform='translate3d('+dx+'px,'+dy+'px,0)';
  const candidate=hit(e.clientX,e.clientY);
  if(hover!==candidate){hover?.classList.remove('drop-ready');hover=candidate;hover?.classList.add('drop-ready')}
 },{signal});
 source.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  suppress=drag.moved;
  const destination=drag.moved&&enabled()?hit(e.clientX,e.clientY):null;
  clear();if(destination)onDrop(destination);
 },{signal});
 source.addEventListener('pointercancel',()=>{suppress=true;clear()},{signal});
 source.addEventListener('lostpointercapture',clear,{signal});
 source.addEventListener('click',e=>{if(suppress&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();suppress=false}},{capture:true,signal});
 window.addEventListener('blur',clear,{signal});
 signal?.addEventListener('abort',clear,{once:true});
}
