import {SAVE_KEY,freshState,validateLessons} from './engine.mjs';

const button=document.querySelector('#reset-progress');
const status=document.querySelector('#reset-status');
button.addEventListener('click',async()=>{
 button.disabled=true;
 status.textContent='Resetting…';
 try {
  const read=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Could not load game data.');return r.json()};
  const manifest=await read('./lessons/index.json');
  const lessons=await Promise.all(manifest.sets.map(file=>read('./lessons/'+file)));
  validateLessons(lessons);
  const reset=()=>{
   const state=freshState(lessons,Date.now(),crypto.getRandomValues(new Uint32Array(1))[0]);
   state.resetToken=crypto.randomUUID();
   localStorage.setItem(SAVE_KEY,JSON.stringify(state));
  };
  if(navigator.locks)await navigator.locks.request(SAVE_KEY,reset);else reset();
  location.href='index.html';
 } catch(error) {
  status.textContent='Could not reset progress. '+error.message;
  button.disabled=false;
 }
});
