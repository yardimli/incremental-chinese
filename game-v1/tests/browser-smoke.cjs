const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  // Headless windows can lack OS focus. Exercise gameplay without changing production pause logic.
  await context.addInitScript(() => {
    document.hasFocus = () => true;
    window.addEventListener('blur', (e) => e.stopImmediatePropagation(), true);
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const root = 'http://127.0.0.1:8765/game-v1/';
  await page.goto(root + 'screens/home.html');
  await page.locator('[data-answer]').waitFor();
  await page.locator('[data-answer]').click();
  await page.waitForTimeout(1000);
  await page.locator('[data-answer]').click();
  await page.waitForTimeout(1000);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('chinese-village-v1')));
  if (before.coins !== 20) throw Error('Two taps should award 20, got ' + before.coins);
  await page.goto(root + 'screens/memory.html');
  await page.locator('[data-memory-set]').first().click();
  await page.locator('[data-flip]').first().waitFor();
  let deck = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chinese-village-v1')).memory.deck,
  );
  const pair = deck.findIndex((c, i) => i > 0 && c.id === deck[0].id);
  await page.locator('[data-flip="0"]').click();
  await page.locator('[data-flip="' + pair + '"]').click();
  await page.waitForTimeout(100);
  if ((await page.locator('.remembered').count()) !== 2) throw Error('Memory pair did not match');
  await page.reload();
  await page.locator('.remembered').first().waitFor();
  fs.mkdirSync('game-v1/tests/artifacts', { recursive: true });
  await page.screenshot({ path: 'game-v1/tests/artifacts/memory.png' });
  // Seed a separate disposable browser profile, never the user's save.
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('chinese-village-v1'));
    s.completed = ['L01'];
    s.coins = 5000;
    s.village.resources.timber = 80;
    s.village.resources.stone = 80;
    s.village.resources.knowledge = 10;
    localStorage.setItem('chinese-village-v1', JSON.stringify(s));
  });
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('chinese-village-v1'));
    delete s.memory;
    localStorage.setItem('chinese-village-v1', JSON.stringify(s));
  });
  await page.goto(root + 'screens/memory.html');
  await page.locator('[data-memory-set]').first().click();
  await page.locator('[data-flip="11"]').waitFor();
  if ((await page.locator('[data-flip]').count()) !== 12)
    throw Error('Full board must fit six pairs');
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'game-v1/tests/artifacts/memory-full.png' });
  await page.goto(root + 'screens/village.html');
  await page.locator('[data-building="I03"]').click();
  await page.locator('[data-building="I03"]').waitFor();
  await page.screenshot({ path: 'game-v1/tests/artifacts/village.png' });
  await page.goto(root + 'screens/tech.html');
  await page.locator('[data-tech="R01A"]').click();
  await page.locator('[data-tech="R01A"]').waitFor();
  await page.waitForFunction(
    () => document.querySelector('[data-tech="R01A"]')?.textContent === 'Complete',
  );
  if ((await page.locator('[data-tech="R01A"]').textContent()) !== 'Complete')
    throw Error('Research failed');
  await page.screenshot({ path: 'game-v1/tests/artifacts/tech.png' });
  await page.goto(root + 'screens/village.html');
  await page.locator('[data-building="P01A"]').click();
  await page.waitForTimeout(100);
  const built = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chinese-village-v1')).village.buildings.P01A,
  );
  if (built !== 1) throw Error('Build failed');
  for (const screen of [
    'home',
    'sets',
    'village',
    'tech',
    'memory',
    'settings',
    'restart',
    'bonus',
  ]) {
    await page.goto(root + 'screens/' + screen + '.html');
    await page.locator('#screen').waitFor();
    const size = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
    }));
    if (size.height > 852 || size.width > 393)
      throw Error(screen + ' document overflow ' + JSON.stringify(size));
  }
  async function seedMode(mode) {
    await page.evaluate(async (mode) => {
      const E = await import('./engine.mjs'),
        manifest = await fetch('./lessons/index.json').then((r) => r.json());
      const lessons = await Promise.all(
        manifest.sets.map((f) => fetch('./lessons/' + f).then((r) => r.json())),
      );
      const s = E.freshState(lessons, Date.now(), 42);
      s.settings.muted = true;
      if (mode === 'match') {
        s.stage = 'match';
        s.matchOrder = lessons[0].pairs.map((w) => w.id);
      }
      if (mode === 'order') {
        s.setIndex = lessons.findIndex((x) => x.type === 'sentences');
        s.level = 3;
        s.stage = 'order';
        s.sentenceDeck = lessons[s.setIndex].sentences.slice(0, 10).map((q) => q.id);
      }
      if (mode === 'battle') {
        s.difficulty = 4;
        s.cards.L01 = lessons[0].pairs.map((w) => w.id);
        s.current = null;
        E.newPrompt(s, lessons);
      }
      localStorage.setItem(E.SAVE_KEY, JSON.stringify(s));
    }, mode);
  }
  await seedMode('match');
  await page.goto(root + 'screens/match.html');
  await page.locator('[data-side="cn"]').first().waitFor();
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForURL('**/index.html#card-reward');
  await page.locator('#continue').waitFor();
  await page.screenshot({ path: 'game-v1/tests/artifacts/card-reward.png' });
  await page.locator('#continue').click();
  await page.waitForURL('**/index.html#match');
  await page.locator('[data-side="cn"]').first().waitFor();
  await seedMode('order');
  await page.goto(root + 'screens/order.html');
  await page.locator('#check').waitFor();
  await page.keyboard.press('Space');
  await page.waitForTimeout(800);
  await page.keyboard.press('Space');
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('chinese-village-v1')).sentenceIndex === 2,
  );
  await seedMode('battle');
  await page.goto(root + 'screens/home.html');
  await page.locator('.battle-target').first().waitFor();
  await page.waitForTimeout(1000);
  await page.keyboard.press('Space');
  await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('chinese-village-v1')).coins > 0,
  );
  await page.goto(root + 'index.html');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(300);
  const fit = await page.locator('.phone').boundingBox();
  if (fit.height > 568.1 || fit.width > 320.1) throw Error('Phone scaling failed');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Browser checks passed: taps, memory/reload, tech, building, 8 screens, 320×568 scaling.',
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
