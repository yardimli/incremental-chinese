const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const base = 'http://127.0.0.1:8765/game-v2/index.html';
    await page.goto(base + '?set=L25#sets');
    await page.locator('[data-set-game="self-test"]').waitFor();
    assert.equal(await page.locator('[data-set-game]').count(), 6);
    // Launch every mode from an uncompleted late set.
    for (const mode of ['battle', 'match', 'order', 'memory', 'bonus', 'self-test']) {
      await page.goto(base + '?set=L25#sets');
      await page.locator(`[data-set-game="${mode}"]`).click();
      const selector = {
        battle: '[data-answer]',
        match: '.match-tile',
        order: '[data-choice]',
        memory: '[data-flip]',
        bonus: '[data-bonus]',
        'self-test': '[data-reveal]',
      }[mode];
      await page
        .locator('#screen ' + selector)
        .first()
        .waitFor();
    }
    assert.ok(await page.locator('.self-answer').isHidden());
    await page.locator('[data-reveal]').click();
    await page.locator('[data-grade="false"]').waitFor();
    await page.locator('[data-grade="false"]').click();
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).selfTest.index === 1,
    );
    await page.locator('[data-reveal]').click();
    await page.locator('[data-grade="true"]').click();
    await page.locator('#screen #continue').waitFor();
    await page.locator('#screen #continue').click();
    await page.locator('[data-reveal]').waitFor();
    assert.ok(await page.locator('.self-answer').isHidden());
    await page.reload();
    await page.locator('[data-reveal]').waitFor();
    assert.equal(
      await page.evaluate(() => JSON.parse(localStorage.getItem('chinese-game-v2')).selfTest.index),
      2,
    );
    // Finish through the real reward button and inspect the set's per-mode checkmark.
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.stage = 'setReward';
        s.accuracy[s.setIndex] = { correct: 8, total: 10, attempt: 1 };
      });
      app.go();
    });
    await page.locator('#screen #claim').click();
    await page.locator('[data-set-game="self-test"] .game-check').waitFor();
    assert.equal(await page.locator('[data-set-game="self-test"] .game-check').innerText(), '✓');
    assert.equal(await page.locator('[data-set-game="match"] .game-check').innerText(), '');
    await page.goto(base + '#settings');
    for (const scale of ['1', '1.25', '1.5', '1.75']) {
      await page.locator(`[data-setting="textSize"][data-value="${scale}"]`).click();
      await page.waitForFunction(
        (scale) => document.querySelector('#game-frame').dataset.textSize === scale,
        scale,
      );
      const size = await page
        .locator('.header h1')
        .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      assert.ok(Math.abs(size - 22 * Number(scale)) < 0.1);
    }
    await page.reload();
    await page
      .locator('[data-setting="textSize"][data-value="1.75"][aria-pressed="true"]')
      .waitFor();
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="self-test"]').click();
    await page.locator('[data-reveal]').click();
    await page.locator('.self-answer:not([hidden])').waitFor();
    await page.waitForTimeout(150);
    await page.screenshot({ path: 'game-v2/tests/artifacts/self-test-175.png' });
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
    assert.deepEqual(errors, []);
    console.log(
      'Every set mode, self-test reveal/grading/reload/rewards, checkmarks and four text sizes passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
