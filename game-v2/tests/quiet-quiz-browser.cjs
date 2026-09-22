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
    assert.equal(
      await page.evaluate(() => spoken.length),
      0,
      'Sentence choices remain silent on tap',
    );
    assert.deepEqual(errors, []);
    console.log(
      'Silent sentence quizzes, silent self-test arrival/background reveal, and explicit card speech passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
