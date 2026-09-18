export function createScoreCounter(initial, render, clock=()=>performance.now(), schedule=requestAnimationFrame, cancel=cancelAnimationFrame){
 let displayed=Math.floor(initial),target=displayed,frame=null;
 function update(value){
  const next=Math.floor(value);
  if(next===target){render(displayed);return}
  target=next;
  if(frame!==null)cancel(frame);
  frame=null;
  if(target<=displayed){displayed=target;render(displayed);return}
  const start=displayed,started=clock();
  // Small gains show every integer; large gains finish promptly.
  const duration=Math.min(600,Math.max(120,(target-start)*40));
  function tick(){
   const progress=Math.min(1,(clock()-started)/duration);
   displayed=Math.min(target,start+Math.floor((target-start)*progress));
   render(displayed);
   frame=progress<1?schedule(tick):null;
  }
  frame=schedule(tick);
 }
 return {update,value:()=>displayed,stop:()=>{if(frame!==null)cancel(frame)}};
}
