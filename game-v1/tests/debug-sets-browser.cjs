const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/game-v1/screens/sets.html');await page.locator('[data-set="0"]').waitFor();
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('chinese-village-v1')));
  await page.locator('[data-set="0"]').dblclick();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chinese-village-v1')).completed.includes('L01'));
  assert.equal((await saved()).coins,350);
  await page.locator('[data-set="0"]').dblclick();await page.waitForTimeout(100);assert.equal((await saved()).coins,350);
  // The first click changes selection; the second must still reach dblclick.
  await page.locator('[data-set="2"]').dblclick();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chinese-village-v1')).completed.includes('L02'));
  assert.equal((await saved()).coins,510);assert.equal((await saved()).setIndex,1);
  await page.reload();await page.locator('[data-set="2"]').waitFor();
  await page.locator('[data-set="2"]').dblclick();await page.waitForTimeout(100);assert.equal((await saved()).coins,510);
  assert.deepEqual(errors,[]);console.log('Double-click completion, selection changes, correct rewards and reload idempotency passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
