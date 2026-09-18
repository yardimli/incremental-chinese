import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameClock} from '../game-clock.mjs';

test('pause preserves countdowns, including jobs created or cancelled while paused',()=>{
 let time=0,id=0;const pending=new Map(),fired=[];
 const clock=createGameClock({now:()=>time,schedule:(fn,delay)=>{pending.set(++id,{fn,at:time+delay});return id},cancel:id=>pending.delete(id)});
 const advance=ms=>{time+=ms;for(const [id,job] of [...pending])if(job.at<=time){pending.delete(id);job.fn()}};
 clock.setTimeout(()=>fired.push('target'),4000);advance(1500);clock.pause();
 advance(30000);assert.deepEqual(fired,[]);
 clock.setTimeout(()=>fired.push('reward'),500);
 const cancelled=clock.setTimeout(()=>fired.push('cancelled'),1);clock.clearTimeout(cancelled);
 clock.pause();clock.resume();advance(500);assert.deepEqual(fired,['reward']);
 advance(1999);assert.deepEqual(fired,['reward']);advance(1);assert.deepEqual(fired,['reward','target']);
 clock.setTimeout(()=>fired.push('disposed'),10);clock.dispose();advance(10);assert.equal(fired.length,2);
});
