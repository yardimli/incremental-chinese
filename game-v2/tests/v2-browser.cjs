const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    mkdirSync('game-v2/tests/artifacts', { recursive: true });
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(r.status() + ' ' + r.url());
    });
    await page.goto('http://127.0.0.1:8765/game-v2/index.html');
    await page.locator('#screen [data-answer]').waitFor();
    assert.deepEqual(
      await page.locator('.footer a').evaluateAll((els) => els.map((e) => e.dataset.nav)),
      ['home', 'sets'],
    );
    await page.evaluate(() => localStorage.setItem('chinese-village-v1', 'v1 untouched'));
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
      await page.waitForTimeout(220);
    }
    await page.locator('#screen [data-answer]').click();
    await page.waitForTimeout(900);
    assert.ok(Number(await page.locator('.accuracy-track').getAttribute('aria-valuenow')) === 100);
    await page.reload();
    await page.locator('#screen [data-answer]').waitFor();
    assert.equal(await page.locator('.accuracy-track').getAttribute('aria-valuenow'), '100');
    // Reward screen retries below the threshold and advances at exactly 80%.
    for (const correct of [79, 80]) {
      await page.evaluate(async (correct) => {
        const app = await import('./shared.js');
        await app.transact((s) => {
          s.settings.muted = true;
          s.settings.englishTranslations = 'always';
          s.stage = 'setReward';
          s.accuracy = { 0: { correct, total: 100, attempt: 1 } };
          s.coins = 123;
        });
        app.go();
      }, correct);
      await page.locator('#screen #claim').waitFor();
      assert.doesNotMatch(
        await page.locator('#screen').innerText(),
        /村落|研究|stockpile|village/i,
      );
      if (correct === 79) assert.match(await page.locator('#screen').innerText(), /80%/);
      await page.screenshot({ path: `game-v2/tests/artifacts/accuracy-${correct}.png` });
      await page.locator('#screen #claim').click();
      await page.locator('#screen [data-answer]').waitFor();
      const s = await page.evaluate(() => JSON.parse(localStorage.getItem('chinese-game-v2')));
      assert.equal(s.setIndex, correct === 79 ? 0 : 1);
      assert.equal(s.coins, correct === 79 ? 123 : 223);
      if (correct === 79) assert.equal(s.accuracy[0].attempt, 2);
      assert.equal(s.village, undefined);
    }
    for (const screen of ['sets', 'settings', 'restart', 'memory', 'bonus', 'guide']) {
      await nav(screen);
      assert.doesNotMatch(
        await page.locator('#screen').innerText(),
        /\[object Object\]|\{\{\d+\}\}|village|research|stockpile/i,
      );
      await page.screenshot({ path: `game-v2/tests/artifacts/${screen}.png` });
    }
    await nav('home');
    for (const viewport of [
      { width: 393, height: 852 },
      { width: 320, height: 568 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(200);
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      assert.ok(bounds.width <= viewport.width && bounds.height <= viewport.height);
    }
    await page.setViewportSize({ width: 393, height: 852 });
    await page.screenshot({ path: 'game-v2/tests/artifacts/home.png' });
    assert.equal(
      await page.evaluate(() => localStorage.getItem('chinese-village-v1')),
      'v1 untouched',
    );
    assert.deepEqual(errors, []);
    console.log(
      'V2 navigation, 79/80% reward flows, coins, isolated save and phone/desktop layouts passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
