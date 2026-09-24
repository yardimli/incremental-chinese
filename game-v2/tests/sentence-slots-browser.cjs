const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 664 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/game-v2/index.html?set=L10#sets');
    await page.locator('[data-set-game="order"]').click();
    await page.locator('#screen [data-slot]').first().waitFor();
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.sentenceDeck = [app.lessons[s.setIndex].sentences.find((q) => q.tokens.length >= 3).id];
        s.sentenceIndex = 0;
      });
      app.go();
    });
    await page.waitForFunction(() => document.querySelectorAll('#screen [data-slot]').length >= 3);
    async function drag(from, to) {
      const a = await page.locator(from).boundingBox(),
        b = await page.locator(to).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
      await page.mouse.up();
    }
    await drag('#screen [data-choice="0"]', '#screen [data-slot="2"]');
    assert.ok(
      await page.locator('#screen [data-slot="2"]').evaluate((n) => n.classList.contains('filled')),
    );
    assert.ok(
      await page
        .locator('#screen [data-slot="0"]')
        .evaluate((n) => !n.classList.contains('filled')),
    );
    assert.ok(await page.locator('#screen #check').isDisabled());
    await drag('#screen [data-slot="2"]', '#screen [data-slot="1"]');
    assert.ok(
      await page.locator('#screen [data-slot="1"]').evaluate((n) => n.classList.contains('filled')),
    );
    assert.ok(
      await page
        .locator('#screen [data-slot="2"]')
        .evaluate((n) => !n.classList.contains('filled')),
    );
    await page.locator('#screen [data-choice="1"]').click();
    assert.ok(
      await page.locator('#screen [data-slot="0"]').evaluate((n) => n.classList.contains('filled')),
    );
    await page.locator('#screen [data-slot="0"]').click();
    assert.ok(
      await page.locator('#screen [data-slot="1"]').evaluate((n) => n.classList.contains('filled')),
    );
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 31000;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForURL('**?set=L10#sets');
    await page.locator('[data-set-game="order"]').waitFor();
    assert.deepEqual(errors, []);
    console.log('Sentence drop into third slot, moving, tapping, and holes passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
