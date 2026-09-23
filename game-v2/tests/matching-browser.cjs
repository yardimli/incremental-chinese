const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/game-v2/index.html');
    await page.locator('#screen [data-answer]').waitFor();
    const total = await page.evaluate(async () => {
      const app = await import('../game-v2/shared.js');
      await app.transact((s) => {
        s.settings.muted = true;
        s.stage = 'match';
        s.pageIndex = 0;
        s.matchFound = [];
        s.matchOrder = app.lessons[0].pairs.map((word) => word.id);
      });
      app.go();
      return app.lessons[0].pairs.length;
    });
    assert.ok(total > 5, 'Exercise multiple matching boards');
    for (let found = 0; found < total; found++) {
      await page.locator('#screen .match-board').waitFor();
      const id = await page.evaluate(async () => {
        const { state } = await import('../game-v2/shared.js');
        const { matchBoard } = await import('../game-v2/engine.mjs');
        const cards = [...document.querySelectorAll('#screen .match-tile')];
        for (const card of cards) {
          if (card.disabled !== state.matchFound.includes(card.dataset.id))
            throw new Error(
              'Stale disabled state on ' + card.dataset.side + ': ' + card.dataset.id,
            );
        }
        return matchBoard(state).find((id) => !state.matchFound.includes(id));
      });
      await page.locator(`#screen [data-side="cn"][data-id="${id}"]`).click();
      await page.locator(`#screen [data-side="en"][data-id="${id}"]`).click();
      await page.waitForFunction(
        (count) => JSON.parse(localStorage.getItem('chinese-game-v2')).matchFound.length === count,
        found + 1,
      );
      await page.waitForTimeout(800);
      while (await page.locator('#screen #continue').isVisible()) {
        const stage = await page.evaluate(
          () => JSON.parse(localStorage.getItem('chinese-game-v2')).stage,
        );
        if (stage === 'cardReward') {
          await page.locator('#screen #continue').click();
          await page.waitForTimeout(250);
        }
      }
    }
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).stage === 'setReward',
    );
    assert.deepEqual(errors, []);
    console.log('All matching boards and intervening card rewards completed without stuck cards.');
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
