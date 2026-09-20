const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = 'http://127.0.0.1:8765/game-v2/screens/memory.html';
    await page.goto(url);
    await page.locator('#screen').waitFor();
    await page.evaluate(() => {
      const k = 'chinese-game-v2',
        s = JSON.parse(localStorage.getItem(k));
      s.completed = ['L01'];
      s.settings.muted = true;
      localStorage.setItem(k, JSON.stringify(s));
    });
    await page.reload();
    await page.locator('[data-memory-set]').first().click();
    await page.locator('[data-flip="11"]').waitFor();
    const deck = await page.evaluate(
      () => JSON.parse(localStorage.getItem('chinese-game-v2')).memory.deck,
    );
    const mate = deck.findIndex((c, i) => i > 0 && c.id === deck[0].id);
    const third = deck.findIndex((c) => c.id !== deck[0].id),
      wrong = deck.findIndex((c) => c.id !== deck[0].id && c.id !== deck[third].id);
    const card = (i) => page.locator('[data-flip="' + i + '"]');
    await card(0).click();
    await card(mate).click();
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      window.solvedNode = document.querySelector('.remembered');
      window.flips = [];
      document.querySelector('.memory-grid').addEventListener('transitionrun', (e) => {
        if (e.propertyName === 'transform')
          window.flips.push(Number(e.target.closest('[data-flip]').dataset.flip));
      });
    });
    await card(third).click();
    await page.waitForTimeout(350);
    assert.equal(
      await page.evaluate(() => window.solvedNode === document.querySelector('.remembered')),
      true,
      'Solved DOM node must stay mounted',
    );
    assert.deepEqual(
      await page.evaluate(() => window.flips),
      [third],
      'Only the newly opened card should flip',
    );
    await card(wrong).click();
    await page.waitForFunction(
      (i) => !document.querySelector('[data-flip="' + i + '"]').classList.contains('face-up'),
      third,
    );
    const closing = await card(third)
      .locator('.memory-inner')
      .evaluate((e) => e.getAnimations().some((a) => a.transitionProperty === 'transform'));
    assert.ok(closing, 'Wrong pair must transition back, not snap shut');
    await page.waitForTimeout(350);
    const flips = await page.evaluate(() => window.flips);
    assert.equal(flips.filter((i) => i === third).length, 2);
    assert.equal(flips.filter((i) => i === wrong).length, 2);
    assert.equal(flips.includes(0) || flips.includes(mate), false);
    assert.equal(await page.locator('.remembered').count(), 2);
    await card(third).click();
    await page.waitForFunction(
      (i) => document.querySelector('[data-flip="' + i + '"]').classList.contains('face-up'),
      third,
    );
    assert.deepEqual(errors, []);
    console.log(
      'Solved cards stay mounted/still; only changed cards flip; wrong cards animate closed and can reopen.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
