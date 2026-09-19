const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } }),
      errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install();
    const base = 'http://127.0.0.1:8765/game-v1/screens/';
    await page.goto(base + 'home.html');
    await page.locator('#screen').waitFor();
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    assert.ok(await page.locator('.pause-overlay').isHidden());
    await page.clock.fastForward(31000);
    await page.waitForURL('**/index.html?idle=1#home');
    await page.locator('#resume-journey').waitFor();
    assert.equal(await page.locator('[data-answer]').count(), 0);
    assert.ok(await page.locator('.pause-overlay').isHidden());
    await page.locator('#resume-journey').click();
    await page.locator('[data-answer]').first().waitFor();
    await page.locator('.pause-button').click();
    await page.clock.fastForward(31000);
    assert.ok(await page.locator('.pause-overlay').isVisible());
    await page.locator('.pause-overlay button').click();
    await page.evaluate(() => {
      const key = 'chinese-village-v1',
        s = JSON.parse(localStorage.getItem(key));
      s.completed = ['L01'];
      s.coins = 100000;
      s.village.buildings = { I01: 5, I02: 5, I03: 5 };
      localStorage.setItem(key, JSON.stringify(s));
    });
    await page.goto(base + 'village.html');
    await page.locator('[data-building="I03"]').waitFor();
    assert.equal(await page.locator('[data-remove]').count(), 0);
    assert.equal(await page.locator('.land-notice').count(), 0);
    assert.match(await page.locator('.village-scene').innerText(), /15 buildings/);
    assert.equal(await page.locator('[data-building="I03"]').isDisabled(), false);
    await page.locator('[data-building="I03"]').click();
    await page.waitForFunction(() =>
      document.querySelector('.village-scene').textContent.includes('16 buildings'),
    );
    await page.clock.fastForward(31000);
    assert.ok(page.url().endsWith('#village'));
    assert.deepEqual(errors, []);
    console.log(
      'Unlimited building, count, manual pause, inactivity home and utility-page exemption passed.',
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
