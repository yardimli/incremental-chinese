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
    const base = 'http://127.0.0.1:8765/game-v2/index.html';
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="self-test"]').waitFor();
    const ids = await page.evaluate(async () =>
      (await import('./shared.js')).lessons.map((s) => s.id),
    );
    for (const id of ids) {
      await page.goto(base + '?set=' + id + '#sets');
      await page.locator('[data-set-game="self-test"]').click();
      await page.locator('#screen [data-reveal]').click();
      await page.locator('#screen [data-grade="false"]').click();
      await page.waitForFunction(
        () => JSON.parse(localStorage.getItem('chinese-game-v2')).selfTest.index === 1,
      );
      await page.locator('#screen [data-reveal]').click();
      await page.locator('#screen [data-grade="true"]').click();
      await page.locator('#screen [data-reveal]').waitFor();
      assert.equal(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('chinese-game-v2')).selfTest.index,
        ),
        2,
        id,
      );
    }
    console.log(
      'All ' + ids.length + ' self-tests reveal, grade false/correct, and resume after rewards.',
    );
    // Finish every deck through engine, checking every card resolves and progress survives saving.
    const completed = await page.evaluate(async () => {
      const app = await import('./shared.js'),
        E = await import('./engine.mjs');
      for (let i = 0; i < app.lessons.length; i++) {
        let s = E.freshState(app.lessons);
        E.startSetGame(s, app.lessons, i, 'self-test');
        let n = 0;
        while (s.stage !== 'setReward' && n++ < 250) {
          if (s.stage === 'cardReward') E.continueCardReward(s);
          else {
            const id = s.selfTest.deck[s.selfTest.index];
            if (!app.word(id)?.english) throw Error('Missing card ' + id);
            s.selfTest.revealed = true;
            E.gradeSelfTest(s, app.lessons, true, id);
          }
          s = JSON.parse(JSON.stringify(s));
        }
        if (s.stage !== 'setReward') throw Error('Stuck ' + i);
        E.claimSet(s, app.lessons);
        if (!s.gameCompleted[app.lessons[i].id]['self-test']) throw Error('No completion ' + i);
      }
      return app.lessons.length;
    });
    console.log('Full self-test completion checked for ' + completed + ' lessons.');
    await page.locator('.footer a[href="sets.html"]').click();
    await page.waitForURL('**?set=' + ids.at(-1) + '#sets');
    await page.locator('.footer a[href="sets.html"]').click();
    await page.waitForURL('**/index.html#sets');
    await page.goto(base + '?set=L01#sets');
    await page.locator('[data-set-game="memory"]').click();
    await page.locator('#screen .memory-card').first().waitFor();
    assert.equal(await page.locator('#screen .memory-card').count(), 12);
    assert.equal(await page.locator('#screen .practice-note,#screen .memory-status').count(), 0);
    const layout = await page.evaluate(() => {
      const grid = document.querySelector('#screen .memory-grid'),
        top = document.querySelector('#screen progress'),
        screen = document.querySelector('#screen');
      return {
        gridBottom: grid.getBoundingClientRect().bottom,
        top: top.getBoundingClientRect().top,
        scroll: screen.scrollHeight,
        height: screen.clientHeight,
        footer: getComputedStyle(document.querySelector('.footer')).height,
      };
    });
    assert.ok(layout.top >= layout.gridBottom);
    assert.equal(layout.footer, '54px');
    console.log('Mobile memory layout:', layout);
    assert.deepEqual(errors, []);
    console.log('Mobile navigation and reward checks passed.');
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
