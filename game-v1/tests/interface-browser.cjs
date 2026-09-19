const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:8765/game-v1/index.html');
    await page.locator('#screen [data-answer]').waitFor();
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
      await page.waitForTimeout(160);
    }
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.completed = ['L01'];
        s.history.L01 = true;
        s.level = 1;
        s.coins = 2000;
        s.settings.muted = true;
        s.settings.englishTranslations = 'always';
        s.cards.L01 = app.lessons[0].pairs.slice(0, 3).map((w) => w.id);
      });
    });
    for (const name of ['village', 'tech', 'sets', 'settings', 'restart', 'memory', 'bonus']) {
      await nav(name);
      assert.ok(await page.locator('.header .ui-chinese').isVisible());
      assert.ok(await page.locator('.header .ui-pinyin').isVisible());
      assert.doesNotMatch(
        await page.locator('#screen').innerText(),
        /\[object Object\]|\{\{\d+\}\}/,
      );
      await page.screenshot({ path: `game-v1/tests/artifacts/interface-${name}.png` });
    }
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.stage = 'gate';
      });
    });
    await nav('home');
    await page.screenshot({ path: 'game-v1/tests/artifacts/interface-gate.png' });
    for (let index = 0; index < 4; index++) {
      await page.locator(`[data-goal-help="${index}"]`).click();
      assert.equal(await page.locator('.goal-help-copy .ui-text').count(), 0);
      assert.ok((await page.locator('.goal-help-copy').innerText()).length > 40);
      assert.match(
        await page.locator('.goal-dialog[open] button').innerText(),
        /Close.*關閉.*guān bì/,
      );
      assert.doesNotMatch(
        await page.locator('.goal-help-copy').innerText(),
        /\[object Object\]|\{\d+\}/,
      );
      await page.locator('.goal-dialog[open] button').click();
    }
    await page.evaluate(async () => {
      const app = await import('./shared.js');
      await app.transact((s) => {
        s.stage = 'cardReward';
        s.pendingReward = {
          ids: [app.lessons[0].pairs[0].id],
          before: 0,
          after: 1,
          total: app.lessons[0].pairs.length,
        };
      });
      app.go();
    });
    await page.locator('#screen #continue').waitFor();
    await page.waitForTimeout(450);
    await page.screenshot({ path: 'game-v1/tests/artifacts/interface-reward.png' });
    await nav('settings');
    for (const display of ['characters', 'pinyin', 'both']) {
      await page.locator(`[data-setting="display"][data-value="${display}"]`).click();
      await page
        .locator(`[data-setting="display"][data-value="${display}"][aria-pressed="true"]`)
        .waitFor();
      assert.equal(await page.locator('.header .ui-chinese').isVisible(), display !== 'pinyin');
      assert.equal(await page.locator('.header .ui-pinyin').isVisible(), display !== 'characters');
    }
    await page.locator('[data-setting="englishTranslations"][data-value="never"]').click();
    await page.locator('[data-value="never"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('#screen .ui-english:visible').count(), 0);
    await page.locator('[data-setting="script"][data-value="simplified"]').click();
    await page.locator('[data-value="simplified"][aria-pressed="true"]').waitFor();
    assert.equal(await page.locator('.header .ui-chinese').innerText(), '设置');
    await page.reload();
    await page.locator('#screen .settings').waitFor();
    assert.equal(await page.locator('.header .ui-chinese').innerText(), '设置');
    await nav('guide');
    assert.equal(await page.locator('#screen .ui-text').count(), 0);
    await nav('village');
    assert.ok(await page.locator('.header .ui-chinese').isVisible());
    assert.deepEqual(errors, []);
    console.log(
      'All UI screens, goal help, rewards, display/script switching and saved settings passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
