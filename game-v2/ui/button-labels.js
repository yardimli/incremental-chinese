import { view, render } from './templates.js';
import { showEnglish } from '../systems/translations.mjs';

const labels = {
  home: ['主頁', '主页', 'zhǔ yè', 'Home'],
  sets: ['卡冊', '卡册', 'kǎ cè', 'Sets'],
};

export function buttonLabel(key, state, detail = '') {
  const [traditional, simplified, pinyin, english] = labels[key];
  const settings = state.settings;
  return view('tpl-button-label', [
    settings.display === 'pinyin'
      ? ''
      : settings.script === 'simplified'
        ? simplified
        : traditional,
    settings.display === 'characters' ? '' : pinyin,
    showEnglish(state) ? english : '',
    detail,
  ]);
}

export function refreshButtonLabels(root, state) {
  root.querySelectorAll('[data-button-label]').forEach((node) => {
    render(node, buttonLabel(node.dataset.buttonLabel, state));
  });
}
