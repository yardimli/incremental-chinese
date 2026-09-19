const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [],
      documents = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents.push(request.url());
    });
    await page.goto('http://127.0.0.1:8765/game-v1/index.html');
    await page.locator('#screen [data-answer]').waitFor();
    const header = await page.locator('.header').elementHandle();
    const home = await page.locator('#screen').elementHandle();
    const game = () => page.locator('#screen');
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('chinese-village-v1')));
    async function nav(name) {
      await page.evaluate((name) => {
        const a = document.createElement('a');
        a.href = name + '.html';
        document.body.append(a);
        a.click();
        a.remove();
      }, name);
      await page.waitForFunction(
        (name) => document.querySelector('#screen')?.dataset.screen === name,
        name,
      );
      await page.waitForTimeout(120);
    }
    async function seed(mode) {
      await page.evaluate(async (mode) => {
        const app = await import('../game-v1/shared.js'),
          E = await import('../game-v1/engine.mjs');
        await app.transact((s) => {
          const fresh = E.freshState(app.lessons, Date.now(), 42);
          fresh.settings.muted = true;
          for (const key of Object.keys(s)) delete s[key];
          Object.assign(s, fresh);
          if (mode === 'match') {
            s.stage = 'match';
            s.matchOrder = app.lessons[0].pairs.map((w) => w.id);
          }
          if (mode === 'order') {
            s.setIndex = app.lessons.findIndex((l) => l.type === 'sentences');
            s.stage = 'order';
            s.level = 3;
            s.sentenceDeck = app.lessons[s.setIndex].sentences.slice(0, 10).map((q) => q.id);
          }
          if (mode === 'battle') {
            s.difficulty = 4;
            s.cards.L01 = app.lessons[0].pairs.map((w) => w.id);
            E.newPrompt(s, app.lessons);
          }
        });
      }, mode);
    }
    await game().locator('[data-answer]').click();
    await page.waitForTimeout(1000);
    await game().locator('[data-answer]').click();
    await page.waitForTimeout(1000);
    assert.equal((await saved()).coins, 20, 'No duplicate answer handlers');
    for (const name of [
      'sets',
      'village',
      'tech',
      'settings',
      'restart',
      'bonus',
      'memory',
      'home',
    ]) {
      await nav(name);
      assert.equal(await page.locator('[data-screen]:not([hidden])').count(), 1);
      assert.doesNotMatch(await game().innerText(), /\[object Object\]|\{\{\d+\}\}/);
    }
    assert.ok(await home.evaluate((node) => node === document.querySelector('#screen')));
    assert.ok(await header.evaluate((node) => node === document.querySelector('.header')));
    await nav('memory');
    await game().locator('[data-memory-set]').first().click();
    await game().locator('[data-flip]').first().waitFor();
    assert.equal(await game().locator('[data-flip]').count(), 12);
    const deck = (await saved()).memory.deck,
      mate = deck.findIndex((c, i) => i && c.id === deck[0].id);
    await game().locator('[data-flip="0"]').click();
    await game().locator(`[data-flip="${mate}"]`).click();
    const solved = await game().locator('.remembered').first().elementHandle();
    await nav('sets');
    await nav('memory');
    assert.ok(
      await solved.evaluate((node) => node.isConnected && node.classList.contains('remembered')),
    );
    await seed('match');
    await nav('match');
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    await page.locator('[data-screen="card-reward"]:not([hidden]) #continue').waitFor();
    assert.ok(await page.locator('.header').isHidden());
    await game().locator('#continue').click();
    await page.waitForFunction(() => document.querySelector('#screen')?.dataset.screen === 'match');
    await seed('order');
    await nav('order');
    await page.keyboard.press('Space');
    await page.waitForTimeout(750);
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-village-v1')).sentenceIndex === 2,
    );
    await seed('battle');
    await nav('home');
    await game().locator('.battle-target').first().waitFor();
    await page.waitForTimeout(800);
    await page.keyboard.press('Space');
    await page.waitForFunction(
      () => JSON.parse(localStorage.getItem('chinese-village-v1')).coins > 0,
    );
    await nav('village');
    await nav('home');
    assert.ok(
      (await game().locator('.battle-target').count()) <= 2,
      'No orphan targets on returning',
    );
    await nav('guide');
    assert.ok(await game().locator('#reset-progress').isVisible());
    assert.equal(documents.length, 1, 'Screen switches must never load another HTML document');
    assert.deepEqual(errors, []);
    console.log(
      'SPA navigation, persistent DOM, all game modes, rewards, speech setup and guide passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
