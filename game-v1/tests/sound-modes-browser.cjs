const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.spoken = [];
      window.Audio = class {
        play() {
          window.spoken.push({
            src: this.src,
            detail: document.querySelector('#screen')?.classList.contains('sets-detail'),
          });
          return Promise.resolve();
        }
        pause() {}
      };
    });
    await page.goto('http://127.0.0.1:8765/game-v1/index.html#sets');
    await page.locator('#screen [data-set="0"]').waitFor();
    await page.evaluate(async () => {
      const app = await import('../game-v1/shared.js');
      await app.transact((s) => {
        s.cards[app.lessons[0].id] = [app.lessons[0].pairs[0].id];
      });
      window.spoken = [];
    });
    await page.locator('#screen [data-set="0"]').click();
    await page.waitForTimeout(250);
    assert.equal(
      await page.evaluate(() => window.spoken.length),
      0,
      'Opening a set must not start speech before navigation',
    );
    await page.locator('#screen.sets-detail').waitFor();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.spoken.length), 1);
    assert.equal(await page.evaluate(() => window.spoken[0].detail), true);
    await page.locator('.sound-button').click();
    await page.waitForFunction(
      () => document.querySelector('.sound-button').dataset.soundMode === 'lessons',
    );
    await page.evaluate(() => {
      window.spoken = [];
    });
    await page.locator('#screen .collection-heading [data-speech]').first().click();
    assert.equal(
      await page.evaluate(() => window.spoken.length),
      0,
      'Menu speech is disabled in lesson mode',
    );
    await page.reload();
    await page.waitForFunction(
      () => document.querySelector('.sound-button').dataset.soundMode === 'lessons',
    );
    await page.locator('[data-nav="home"]').click();
    await page.locator('#screen [data-answer]').waitFor();
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => window.spoken.length > 0), 'Game cards still speak');
    await page.locator('.sound-button').click();
    await page.waitForFunction(
      () => document.querySelector('.sound-button').dataset.soundMode === 'none',
    );
    await page.evaluate(async () => {
      window.spoken = [];
      const app = await import('../game-v1/shared.js');
      app.speech.speak('一', { interrupt: true });
    });
    assert.equal(await page.evaluate(() => window.spoken.length), 0);
    await page.locator('.sound-button').click();
    await page.waitForFunction(
      () => document.querySelector('.sound-button').dataset.soundMode === 'all',
    );
    assert.equal(await page.locator('.pause-button').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      'Deferred set speech, three sound modes, lesson playback and persisted preference passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
