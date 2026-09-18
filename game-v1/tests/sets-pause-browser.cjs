const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/game-v1/index.html');
  const game=page.frameLocator('iframe');await game.locator('[data-answer]').waitFor();
  assert.equal(await game.locator('.pause-overlay').isVisible(),false);
  await game.locator('[data-answer]').click();
  await page.waitForTimeout(950);
  assert.equal(await game.locator('.pause-overlay').isVisible(),false,'First click must not pause');
  const frame=page.frames().find(f=>f.url().includes('/screens/'));
  assert.equal(await frame.evaluate(()=>JSON.parse(localStorage.getItem('chinese-village-v1')).coins),10);
  await page.reload();await game.locator('[data-answer]').waitFor();
  assert.equal(await game.locator('.pause-overlay').isVisible(),false,'Reload must start playing');
  const reloaded=page.frames().find(f=>f.url().includes('/screens/'));
  await page.evaluate(()=>{document.hasFocus=()=>false});
  await reloaded.evaluate(()=>{document.hasFocus=()=>true});
  await page.evaluate(()=>dispatchEvent(new Event('blur')));await page.waitForTimeout(50);
  assert.equal(await game.locator('.pause-overlay').isVisible(),false,'Host-to-iframe focus transfer must not pause');
  await reloaded.evaluate(()=>{document.hasFocus=()=>false});
  await page.evaluate(()=>dispatchEvent(new Event('blur')));
  await game.locator('.pause-overlay:not([hidden])').waitFor();
  await reloaded.evaluate(()=>{document.hasFocus=()=>true});await game.locator('.pause-overlay button').click();
  assert.equal(await game.locator('.pause-overlay').isVisible(),false);
  // Populate collection only in this disposable test browser.
  await reloaded.evaluate(async()=>{
   const manifest=await fetch('../lessons/index.json').then(r=>r.json());
   const sets=await Promise.all(manifest.sets.map(f=>fetch('../lessons/'+f).then(r=>r.json())));
   const key='chinese-village-v1',s=JSON.parse(localStorage.getItem(key));
   sets.forEach(set=>s.history[set.id]=true);s.settings.englishTranslations='always';localStorage.setItem(key,JSON.stringify(s));
  });
  await page.goto('http://127.0.0.1:8765/game-v1/screens/sets.html');await page.locator('.set-picker').waitFor();
  for(const english of ['always','never']){
   await page.evaluate(english=>{const key='chinese-village-v1',s=JSON.parse(localStorage.getItem(key));s.settings.englishTranslations=english;localStorage.setItem(key,JSON.stringify(s))},english);
   await page.reload();await page.locator('.set-picker').waitFor();
   const count=await page.locator('[data-set]').count();
   for(let i=0;i<count;i++){
    await page.locator('[data-set="'+i+'"]').evaluate(e=>e.click());
    const bad=await page.evaluate(()=>[...document.querySelectorAll('.collection .card,.set-picker .selection-button')].filter(e=>{
     const r=e.getBoundingClientRect();return [...e.children].some(c=>{const t=c.getBoundingClientRect();return t.left<r.left-.5||t.right>r.right+.5||t.top<r.top-.5||t.bottom>r.bottom+.5});
    }).map(e=>e.textContent));
    assert.deepEqual(bad,[],english+' stage '+i+' text outside cards');
   }
  }
  await page.screenshot({path:'game-v1/tests/artifacts/sets-fixed.png'});
  assert.deepEqual(errors,[]);console.log('35 sets checked with/without English; startup, first tap, reload, iframe focus transfer and genuine focus-loss pause passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
