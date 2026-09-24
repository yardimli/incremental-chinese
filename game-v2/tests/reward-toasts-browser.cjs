const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const p = await b.newPage({
      viewport: { width: 390, height: 664 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    const base = 'http://127.0.0.1:8765/game-v2/index.html';
    await p.goto(base + '?set=L01#sets');
    await p.locator('[data-set-game="self-test"]').click();
    await p.locator('#screen [data-reveal]').tap();
    await p.locator('#screen [data-grade="true"]').tap();
    await p.locator('#card-reward-toast:not([hidden])').waitFor();
    assert.ok(p.url().endsWith('#self-test'));
    assert.ok(await p.locator('#screen [data-reveal]').isVisible());
    assert.equal(await p.locator('#screen #continue').count(), 0);
    await p.waitForTimeout(350);
    const bounds = await p.evaluate(() => {
      const toast = document.querySelector('#card-reward-toast'),
        footer = document.querySelector('.footer');
      return {
        height: toast.offsetHeight,
        gap:
          (footer.getBoundingClientRect().top - toast.getBoundingClientRect().bottom) /
          parseFloat(document.querySelector('#game-frame').style.getPropertyValue('--phone-scale')),
      };
    });
    assert.equal(bounds.height, 80);
    assert.ok(Math.abs(bounds.gap - 10) < 2);
    await p.locator('#card-reward-toast button').tap();
    await p.locator('#card-reward-toast').waitFor({ state: 'hidden' });
    // Gameplay continues while the first of three cards is being shown.
    await p.evaluate(async () => {
      const a = await import('./shared.js');
      await a.transact((s) => {
        s.stage = 'cardReward';
        s.pendingReward = {
          ids: a.lessons[0].pairs.slice(0, 3).map((w) => w.id),
          setId: 'L01',
          before: 2,
          total: 20,
          resume: 'self-test',
        };
      });
      a.go();
    });
    await p.locator('#card-reward-toast:not([hidden])').waitFor();
    await p.waitForTimeout(350);
    await p.screenshot({ path: 'game-v2/tests/artifacts/card-toast-phone.png' });
    const first = await p.evaluate(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).cardToasts[0].key,
    );
    await p.locator('#screen [data-reveal]').tap();
    await p.locator('#screen [data-grade="false"]').waitFor();
    await p.locator('#screen [data-grade="false"]').tap();
    assert.equal(
      await p.evaluate(() => JSON.parse(localStorage.getItem('chinese-game-v2')).cardToasts.length),
      3,
    );
    await p.reload();
    await p.locator('#card-reward-toast:not([hidden])').waitFor();
    assert.equal(
      await p.evaluate(() => JSON.parse(localStorage.getItem('chinese-game-v2')).cardToasts[0].key),
      first,
    );
    await p.locator('#card-reward-toast button').tap();
    await p.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).cardToasts.length === 2,
    );
    assert.equal(await p.locator('.toast-set b').innerText(), '4 / 20');
    await p.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).cardToasts.length === 1,
      {},
      { timeout: 5000 },
    );
    assert.equal(await p.locator('.toast-set b').innerText(), '5 / 20');
    await p.locator('#card-reward-toast button').tap();
    await p.locator('#card-reward-toast').waitFor({ state: 'hidden' });
    assert.deepEqual(errors, []);
    console.log(
      'Toast size, positioning, queue, reload, auto/manual dismissal and uninterrupted play passed.',
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
