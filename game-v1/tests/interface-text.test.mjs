import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configureInterfaceText, ui, uiText, uiPattern } from '../ui/interface-text.js';

const catalogue = JSON.parse(readFileSync(new URL('../data/ui-text.json', import.meta.url)));
const flatten = (value) => (Array.isArray(value) ? value.map(flatten).join('') : String(value));
test('interface messages keep numeric placeholders and respect script/display/English preferences', () => {
  const state = {
    settings: { script: 'traditional', display: 'both', englishTranslations: 'always' },
  };
  configureInterfaceText(catalogue, () => state);
  assert.deepEqual(ui('While away: +{0}', 120).values.map(flatten), [
    '離線收益：+120',
    'lí xiàn shōu yì: +120',
    'While away: +120',
  ]);
  state.settings.script = 'simplified';
  assert.equal(flatten(ui('Settings').values[0]), '设置');
  state.settings.display = 'pinyin';
  state.settings.englishTranslations = 'never';
  assert.deepEqual(ui('Settings').values.map(flatten), ['', 'shè dìng', '']);
  state.settings.display = 'characters';
  assert.equal(uiText('Settings'), '设置');
  state.settings.englishTranslations = 'until10';
  state.highestLevel = 10;
  assert.equal(ui('Settings').values[2], '');
});
test('nested terms and template binding indices use the matching language', () => {
  configureInterfaceText(catalogue, () => ({
    settings: { display: 'both', englishTranslations: 'always' },
  }));
  assert.deepEqual(
    uiPattern('Restore an earlier {{4}} building', [0, 0, 0, 0, ui('Trade')]).values.map(flatten),
    [
      '恢復較早的貿易建築',
      'huī fù jiào zǎo de mào yì jiàn zhú',
      'Restore an earlier Trade building',
    ],
  );
});
test('all interface translations preserve their source placeholders', () => {
  const parameters = (text) => [...text.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort();
  for (const [key, entry] of Object.entries(catalogue)) {
    for (const language of ['traditional', 'simplified', 'pinyin']) {
      assert.ok(entry[language], key + ': ' + language);
      assert.deepEqual(
        parameters(entry[language]),
        parameters(entry.english || key),
        key + ': ' + language,
      );
    }
  }
});
