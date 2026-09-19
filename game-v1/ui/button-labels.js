import { view, render } from './templates.js';
import { showEnglish } from '../systems/translations.mjs';

const labels = {
  home: ['遊戲', '游戏', 'yóu xì', 'Play'],
  sets: ['卡冊', '卡册', 'kǎ cè', 'Sets'],
  village: ['村落', '村落', 'cūn luò', 'Village'],
  tech: ['研究', '研究', 'yán jiū', 'Tech'],
  build: ['建造', '建造', 'jiàn zào', 'Build'],
  exchange: ['交換', '交换', 'jiāo huàn', 'Exchange'],
  buy: ['買入', '买入', 'mǎi rù', 'Buy'],
  sell: ['賣出', '卖出', 'mài chū', 'Sell'],
  All: ['全部', '全部', 'quán bù', 'All'],
  Infrastructure: ['補給', '补给', 'bǔ jǐ', 'Supply'],
  Trade: ['貿易', '贸易', 'mào yì', 'Trade'],
  Community: ['社區', '社区', 'shè qū', 'Community'],
  Study: ['學習', '学习', 'xué xí', 'Study'],
  research: ['研究', '研究', 'yán jiū', 'Research'],
  complete: ['完成', '完成', 'wán chéng', 'Complete'],
  resources: ['缺少資源', '缺少资源', 'quē shǎo zī yuán', 'Need resources'],
  prerequisite: ['先研究', '先研究', 'xiān yán jiū', 'Research first'],
  level: ['先通關', '先通关', 'xiān tōng guān', 'Clear level'],
  sentence: ['完成句子', '完成句子', 'wán chéng jù zi', 'Finish a sentence set'],
  earlier: ['先建造', '先建造', 'xiān jiàn zào', 'Build earlier on this path'],
  expansion: ['完成擴建', '完成扩建', 'wán chéng kuò jiàn', 'Finish expansion'],
  fund: ['擴建倉庫', '扩建仓库', 'kuò jiàn cāng kù', 'Fund storehouse'],
  cancel: ['取消付款', '取消付款', 'qǔ xiāo fù kuǎn', 'Cancel · lose payments'],
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

export function actionLabel(action, reason, state) {
  if (!reason) return buttonLabel(action, state);
  if (reason === 'Complete') return buttonLabel('complete', state);
  if (reason === 'Need resources') return buttonLabel('resources', state);
  if (reason === 'Complete a sentence set') return buttonLabel('sentence', state);
  if (reason === 'Finish expansion') return buttonLabel('expansion', state);
  if (reason.startsWith('Clear L')) return buttonLabel('level', state, reason.slice(6));
  if (reason.startsWith('Earlier ')) return buttonLabel('earlier', state);
  return buttonLabel('prerequisite', state);
}
