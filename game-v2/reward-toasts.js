import { render, view } from './ui/templates.js';
import { showEnglish } from './systems/translations.mjs';
import { dismissCardToast } from './reward-toasts.mjs';

export function createRewardToasts({ element, getState, lessons, word, transact }) {
  let activeKey,
    timer,
    exiting = false,
    disposed = false;
  function sync() {
    if (disposed) return;
    const state = getState(),
      reward = state.cardToasts?.[0];
    if (reward?.key === activeKey) return;
    clearTimeout(timer);
    activeKey = reward?.key;
    exiting = false;
    element.hidden = true;
    element.classList.remove('toast-enter', 'toast-exit');
    if (!reward) return;
    const card = word(reward.cardId),
      set = lessons.find((s) => s.id === reward.setId);
    if (!card || !set) {
      dismiss();
      return;
    }
    const chinese = state.settings.script === 'simplified' ? card.simplified : card.traditional;
    const label = state.settings.display === 'pinyin' ? card.pinyin : chinese;
    const pinyin =
      state.settings.display === 'characters' || state.settings.display === 'pinyin'
        ? ''
        : card.pinyin;
    const english = showEnglish(state) ? card.english : '';
    render(
      element,
      view('tpl-card-toast', [
        label,
        pinyin,
        english,
        state.settings.script === 'simplified' ? set.simplified : set.traditional,
        reward.after,
        reward.total,
        `${label}. ${pinyin}. ${english}. ${reward.after} / ${reward.total}`,
      ]),
    );
    element.style.setProperty('--toast-word-length', Math.max(1, Array.from(label).length));
    element.hidden = false;
    // Restart entry even when consecutive rewards reuse the same template.
    void element.offsetWidth;
    element.classList.add('toast-enter');
    timer = setTimeout(dismiss, 2600);
  }
  async function dismiss() {
    if (!activeKey || exiting || disposed) return;
    exiting = true;
    clearTimeout(timer);
    const key = activeKey;
    element.classList.remove('toast-enter');
    element.classList.add('toast-exit');
    timer = setTimeout(async () => {
      if (disposed || key !== activeKey) return;
      // Keep the outgoing card mounted until its animation has finished.
      await transact((s) => dismissCardToast(s, key));
      sync();
    }, 220);
  }
  element.addEventListener('click', dismiss);
  return {
    sync,
    dispose() {
      disposed = true;
      clearTimeout(timer);
      element.removeEventListener('click', dismiss);
    },
  };
}
