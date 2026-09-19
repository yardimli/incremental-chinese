const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await context.addInitScript(() => {
      document.hasFocus = () => true;
      window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
    });
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const root = 'http://127.0.0.1:8765/game-v1/screens/';
    await page.goto(root + 'settings.html');
    await page.locator('[data-setting="englishTranslations"]').first().waitFor();
    assert.equal(await page.locator('[data-value="until10"]').getAttribute('aria-pressed'), 'true');
    for (const [mode, level, expected] of [
      ['until10', 9, true],
      ['until10', 10, false],
      ['always', 10, true],
      ['never', 1, false],
    ]) {
      await page.evaluate(
        ({ mode, level }) => {
          const key = 'chinese-village-v1',
            s = JSON.parse(localStorage.getItem(key));
          s.level = level;
          s.highestLevel = level;
          s.settings.englishTranslations = mode;
          s.cards.L01 = ['L01-00'];
          localStorage.setItem(key, JSON.stringify(s));
        },
        { mode, level },
      );
      for (const screen of ['sets', 'village', 'tech']) {
        await page.goto(root + screen + '.html');
        await page.locator('#screen').waitFor();
        assert.equal(
          (await page.locator('.english-translation').count()) > 0,
          expected,
          mode + ' ' + level + ' ' + screen,
        );
        assert.ok(
          await page.evaluate(
            () =>
              document.documentElement.scrollHeight <= 852 &&
              document.documentElement.scrollWidth <= 393,
          ),
        );
      }
      await page.evaluate(() => {
        const key = 'chinese-village-v1',
          s = JSON.parse(localStorage.getItem(key));
        s.stage = 'cardReward';
        s.pendingReward = {
          ids: ['L01-00', 'L01-01'],
          before: 0,
          after: 2,
          total: 10,
          resume: 'tap',
        };
        localStorage.setItem(key, JSON.stringify(s));
      });
      await page.goto(root + 'card-reward.html');
      await page.locator('.hero-card').waitFor();
      assert.equal(
        (await page.locator('.hero-card .english-translation').count()) > 0,
        expected,
        mode + ' ' + level + ' card reward',
      );
      assert.equal(
        (await page.locator('.small .english-translation').count()) > 0,
        expected,
        mode + ' ' + level + ' additional reward',
      );
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 852));
      for (const reward of ['set-reward', 'sentence-reward']) {
        await page.evaluate(async (reward) => {
          const key = 'chinese-village-v1',
            s = JSON.parse(localStorage.getItem(key));
          const manifest = await fetch('./lessons/index.json').then((r) => r.json());
          s.setIndex =
            reward === 'set-reward'
              ? 0
              : manifest.sets.findIndex((file) => file.includes('sentences-'));
          s.stage = 'setReward';
          s.pendingReward = null;
          localStorage.setItem(key, JSON.stringify(s));
        }, reward);
        await page.goto(root + reward + '.html');
        await page.locator('.reward-emblem').waitFor();
        assert.equal(
          (await page.locator('.reward-emblem .english-translation').count()) > 0,
          expected,
          mode + ' ' + level + ' ' + reward,
        );
        assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= 852));
      }
      await page.evaluate(() => {
        const key = 'chinese-village-v1',
          s = JSON.parse(localStorage.getItem(key));
        s.setIndex = 0;
        s.stage = 'tap';
        s.pendingReward = null;
        localStorage.setItem(key, JSON.stringify(s));
      });
    }
    await page.goto(root + 'settings.html');
    await page.locator('[data-value="always"]').click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem('chinese-village-v1')).settings.englishTranslations ===
        'always',
    );
    await page.reload();
    await page.locator('[data-value="always"]').waitFor();
    assert.equal(await page.locator('[data-value="always"]').getAttribute('aria-pressed'), 'true');
    await page.goto(root + 'home.html');
    await page.locator('#screen').waitFor();
    assert.equal(await page.locator('.english-translation').count(), 0);
    assert.deepEqual(errors, []);
    console.log(
      'Translation settings, level 9/10 boundary, persistence, screen scope and phone bounds passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
