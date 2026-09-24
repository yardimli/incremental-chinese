const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.spoken = [];
      HTMLMediaElement.prototype.play = function () {
        window.spoken.push(this.src);
        return Promise.resolve();
      };
    });
    const base = 'http://127.0.0.1:8765/game-v2/index.html';
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="self-test"]').click();
    await page.locator('[data-reveal]').waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Self-test arrives silently');
    await page.locator('.self-test-screen').click({ position: { x: 5, y: 200 } });
    await page.locator('.self-answer:not([hidden])').waitFor();
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Background reveal stays silent');
    await page.locator('[data-reveal]').click();
    await page.waitForFunction(() => spoken.length === 1);
    await page.locator('[data-grade="false"]').click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).selfTest.index === 1,
    );
    await page.locator('.self-answer[hidden]').waitFor({ state: 'attached' });
    assert.equal(await page.evaluate(() => spoken.length), 1, 'Next self-test card stays silent');
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="order"]').click();
    await page.locator('[data-choice]').first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Sentence choices arrive silently');
    await page.locator('[data-choice]').first().click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => spoken.length), 1, 'Sentence choices speak on tap');
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="match"]').click();
    await page.locator('#screen .match-tile').first().waitFor();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Matching arrives silently');
    assert.equal(await page.locator('#screen > .instruction').count(), 0);
    assert.match(await page.locator('#screen .status.match-help').innerText(), /Tap two cards/);
    const id = await page.locator('#screen [data-side="cn"]').first().getAttribute('data-id');
    await page.locator('#screen [data-side="cn"]').first().click();
    assert.equal(await page.locator('#screen .match-help').count(), 0);
    await page.waitForFunction(() => spoken.length === 1);
    await page.locator(`#screen [data-side="en"]:not([data-id="${id}"])`).first().click();
    await page.waitForTimeout(800);
    assert.match(await page.locator('#screen .status').innerText(), /Try another pair/);
    assert.equal(
      await page.locator('#screen .match-help').count(),
      0,
      'Help stays dismissed after redraw',
    );
    assert.equal(
      await page.evaluate(() => spoken.length),
      1,
      'Matching redraw does not start narration',
    );
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.stage = 'cardReward';
        s.pendingReward = {
          ids: [app.lessons[0].pairs[0].id],
          before: 0,
          after: 1,
          total: 16,
          allDone: false,
          resume: 'match',
        };
      });
      window.spoken = [];
      app.go();
    });
    await page.locator('#card-reward-toast:not([hidden])').waitFor();
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Card reward arrives silently');
    await page.locator('#card-reward-toast button').click();
    await page.locator('#card-reward-toast').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => spoken.length), 0, 'Tap dismisses the reward silently');
    assert.deepEqual(errors, []);
    console.log(
      'Quiz/self-test/matching/reward speech rules and matching help-to-feedback transition passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
