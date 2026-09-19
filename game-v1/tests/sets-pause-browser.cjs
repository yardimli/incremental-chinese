const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = 'http://127.0.0.1:8765/game-v1/index.html';
    await page.goto(base);
    await page.locator('#screen [data-answer]').waitFor();
    await page.locator('#screen [data-answer]').click();
    await page.waitForTimeout(1000);
    assert.ok(await page.locator('.pause-overlay').isHidden());
    await page.reload();
    await page.locator('#screen [data-answer]').waitFor();
    assert.ok(await page.locator('.pause-overlay').isHidden());
    await page.evaluate(() => dispatchEvent(new Event('blur')));
    assert.ok(await page.locator('.pause-overlay').isHidden());
    assert.equal(await page.locator('.pause-button').count(), 0);
    assert.ok(await page.locator('.sound-button').isVisible());
    await page.locator('[data-nav="sets"]').click();
    await page.locator('#screen .set-picker').waitFor();
    await page.locator('#screen [data-set="0"]').click();
    await page.locator('#screen .collection-back').waitFor();
    assert.ok(
      (await page.locator('#screen .collection .card.empty').count()) > 0,
      'The current set opens before its first card is collected',
    );
    await page.locator('#screen .collection-back').click();
    await page.locator('#screen .set-picker').waitFor();
    await page.locator('#screen [data-set="1"]').click();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#screen .collection').count(), 0, 'Empty set must not open');
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        app.lessons.forEach((set) => (s.history[set.id] = true));
        s.settings.englishTranslations = 'always';
      });
    });
    for (const index of [0, 1, 4, 14, 34]) {
      await page.locator('#screen [data-set="' + index + '"]').click();
      await page.locator('#screen .collection-back').waitFor();
      assert.equal(await page.locator('#screen .set-picker').count(), 0);
      assert.ok((await page.locator('#screen .collection .card').count()) > 0);
      const back = await page.locator('#screen .collection-back').boundingBox();
      await page.locator('#screen .collection').evaluate((e) => (e.scrollTop = 10000));
      assert.equal((await page.locator('#screen .collection-back').boundingBox()).y, back.y);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 852));
      await page.locator('#screen .collection-back').click();
      await page.locator('#screen .set-picker').waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('Startup, current and past sets, closed future sets and sticky Back passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
