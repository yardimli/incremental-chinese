const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const p = await browser.newPage({
      viewport: { width: 390, height: 664 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.addInitScript(() => {
      window.spoken = [];
      HTMLMediaElement.prototype.play = function () {
        spoken.push(this.src);
        return Promise.resolve();
      };
    });
    const base = 'http://127.0.0.1:8765/game-v2/index.html';
    await p.goto(base + '?set=L05#sets');
    await p.locator('[data-set-game="self-test"]').click();
    await p.locator('#screen [data-reveal]').waitFor();
    for (const size of ['1', '1.25', '1.5', '1.75']) {
      await p.evaluate(async (size) => {
        const a = await import('./shared.js');
        await a.transact((s) => (s.settings.textSize = size));
      }, size);
      await p.reload();
      const card = p.locator('#screen [data-reveal]');
      await card.waitFor();
      assert.ok((await card.innerText()).trim());
      assert.ok(await card.isVisible());
      await card.tap();
      await p.locator('#screen [data-grade="false"]').tap();
    }
    // Repair an incomplete older phone save instead of rendering a blank screen.
    await p.evaluate(() => {
      const key = 'chinese-game-v2',
        s = JSON.parse(localStorage.getItem(key));
      delete s.selfTest;
      localStorage.setItem(key, JSON.stringify(s));
    });
    await p.reload();
    await p.locator('#screen [data-reveal]').waitFor();
    await p.goto(base + '?set=L05#sets');
    await p.locator('[data-set-game="bonus"]').click();
    await p.locator('#screen [data-bonus]').first().waitFor();
    const rects = await p
      .locator('#screen [data-bonus]')
      .evaluateAll((ns) =>
        ns.map((n) => ({ x: n.getBoundingClientRect().x, y: n.getBoundingClientRect().y })),
      );
    assert.equal(new Set(rects.map((r) => r.x)).size, 1);
    assert.equal(new Set(rects.map((r) => r.y)).size, 4);
    await p.keyboard.press('Space');
    await p.waitForFunction(
      () => document.querySelectorAll('#screen [data-bonus]:not([hidden])').length === 1,
    );
    const correct = await p.locator('#screen [data-bonus]:visible').getAttribute('data-bonus');
    await p.waitForTimeout(1100);
    assert.equal(await p.locator('#screen [data-bonus]:visible').count(), 1);
    assert.equal(
      await p.locator('#screen [data-bonus]:visible').getAttribute('data-bonus'),
      correct,
    );
    await p.waitForFunction(
      () => document.querySelectorAll('#screen [data-bonus]:not([hidden])').length === 4,
    );
    await p.goto(base + '?set=L05#sets');
    await p.locator('[data-set-game="order"]').click();
    await p.locator('#screen [data-choice]').first().waitFor();
    await p.evaluate(() => (spoken.length = 0));
    await p.locator('#screen [data-choice]').first().tap();
    await p.waitForFunction(() => spoken.length === 1);
    await p.goto(base + '?set=L05#sets');
    await p.locator('[data-set-game="memory"]').click();
    await p.locator('#screen .memory-grid').waitFor();
    assert.equal(await p.locator('#screen .memory-top,#screen #memory-back').count(), 0);
    await p.goto(base + '?set=L05#sets');
    await p.locator('[data-set-game="meanings"]').click();
    await p.locator('#screen [data-meaning]').first().waitFor();
    let n = 0;
    while (!(await p.locator('#screen #claim').count()) && n++ < 100) {
      await p.keyboard.press('Space');
      await p.waitForTimeout(180);
    }
    assert.ok(n < 100);
    await p.locator('#screen #claim').click();
    await p.locator('[data-set-game="meanings"] .game-check').waitFor();
    assert.equal(await p.locator('[data-set-game="meanings"] .game-check').innerText(), '✓');
    assert.deepEqual(errors, []);
    console.log(
      'Phone self-test (all sizes + repair), bonus hold, sentence speech, memory cleanup, and meanings completion passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
