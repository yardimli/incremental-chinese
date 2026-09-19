const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = 'http://127.0.0.1:8765/game-v1/screens/';
    await page.goto(base + 'home.html');
    await page.locator('.pause-button').waitFor();
    await page.locator('.pause-button').click();
    await page.locator('.pause-overlay:not([hidden])').waitFor();
    assert.ok(await page.locator('#screen').evaluate((e) => e.inert));
    await page.locator('.pause-overlay button').click();
    assert.ok(await page.locator('.pause-overlay').isHidden());
    await page.locator('[data-answer]').click();
    await page.locator('.accuracy-track[aria-valuenow="100"]').waitFor();
    await page.reload();
    await page.locator('.accuracy-track[aria-valuenow="100"]').waitFor();
    await page.evaluate(() => {
      const key = 'chinese-village-v1',
        s = JSON.parse(localStorage.getItem(key));
      s.accuracy = { 0: { correct: 1, total: 3, attempt: 1 } };
      s.stage = 'setReward';
      s.coins = 123;
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.goto(base + 'set-reward.html');
    await page.getByRole('button', { name: 'Play again' }).waitFor();
    assert.match(await page.locator('#screen').innerText(), /33%/);
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.waitForURL('**/index.html#home');
    await page.locator('.accuracy-track').waitFor();
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('chinese-village-v1')));
    assert.equal(state.setIndex, 0);
    assert.equal(state.coins, 123);
    assert.equal(state.accuracy[0].attempt, 2);
    assert.equal(await page.locator('.accuracy-strip').innerText(), '');
    assert.equal(await page.locator('.accuracy-track').getAttribute('aria-valuenow'), '0');
    const bounds = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      bar: document.querySelector('.accuracy-strip').getBoundingClientRect().bottom,
      footer: document.querySelector('.footer').getBoundingClientRect().top,
    }));
    assert.ok(bounds.height <= 852 && bounds.width <= 393);
    assert.ok(Math.abs(bounds.bar - bounds.footer) < 4);
    assert.deepEqual(errors, []);
    console.log('Manual pause/resume, live accuracy, reload persistence and retry flow passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
