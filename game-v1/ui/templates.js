// HTML lives in index.html. Views describe values, never HTML strings.
// Each binding owns a DOM range; unchanged templates keep their elements alive.
import { uiPattern } from './interface-text.js';
const mounted = new WeakMap();
const roots = new WeakMap();
export const view = (id, values = []) => ({ template: id, values });
export function joinParts(items, separator = '') {
  if (typeof separator !== 'object' && items.every((item) => typeof item !== 'object'))
    return items.join(separator);
  return items.flatMap((item, index) => (index ? [separator, item] : [item]));
}
const text = (value) => (Array.isArray(value) ? value.map(text).join('') : String(value ?? ''));

function instance(description) {
  const source = document.getElementById(description.template);
  if (!source) throw new Error('Missing HTML template: ' + description.template);
  const fragment = source.content.cloneNode(true);
  const bindings = [];
  const walker = document.createTreeWalker(
    fragment,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (node.parentElement?.closest('[data-ui]')) continue;
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.hasAttribute('data-ui')) {
        const pattern = node.getAttribute('data-ui');
        bindings.push((values) => render(node, uiPattern(pattern, values)));
        continue;
      }
      for (const attribute of [...node.attributes]) {
        const flag = attribute.name.match(/^data-flag-(\d+)$/);
        if (flag) {
          node.removeAttribute(attribute.name);
          let previous = '';
          bindings.push((values) => {
            const name = text(values[Number(flag[1])]);
            if (previous && name !== previous) node.removeAttribute(previous);
            if (name && name !== previous) node.setAttribute(name, '');
            previous = name;
          });
        } else if (attribute.name.startsWith('data-ui-')) {
          const name = attribute.name.slice(8),
            pattern = attribute.value;
          bindings.push((values) => {
            const value = uiPattern(pattern, values, true);
            if (node.getAttribute(name) !== value) node.setAttribute(name, value);
          });
        } else if (/\{\{\d+\}\}/.test(attribute.value)) {
          const pattern = attribute.value;
          bindings.push((values) => {
            const value = pattern.replace(/\{\{(\d+)\}\}/g, (_, index) => text(values[index]));
            if (node.getAttribute(attribute.name) !== value)
              node.setAttribute(attribute.name, value);
          });
        }
      }
    } else if (/\{\{\d+\}\}/.test(node.data)) {
      const parts = node.data.split(/(\{\{\d+\}\})/);
      for (const part of parts) {
        const match = part.match(/^\{\{(\d+)\}\}$/);
        if (!match) {
          if (part) node.before(document.createTextNode(part));
          continue;
        }
        const start = document.createComment('binding'),
          end = document.createComment('/binding');
        node.before(start, end);
        const range = { start, end, children: [] };
        bindings.push((values) => updateRange(range, values[Number(match[1])]));
      }
      node.remove();
    }
  }
  const record = { template: description.template, fragment, bindings };
  record.update = (values) => bindings.forEach((bind) => bind(values));
  record.update(description.values);
  if (fragment.firstElementChild) roots.set(fragment.firstElementChild, record);
  return record;
}

function updateRange(range, value) {
  const values = (Array.isArray(value) ? value.flat(Infinity) : [value]).filter(
    (v) => v !== null && v !== undefined && v !== false,
  );
  values.forEach((item, index) => {
    let child = range.children[index];
    const template = item?.template || null;
    if (!child || child.template !== template) {
      if (child) removeRange(child);
      const start = document.createComment('item'),
        end = document.createComment('/item');
      const before = range.children[index + 1]?.start || range.end;
      before.before(start, end);
      child = { start, end, template };
      if (template) {
        child.instance = instance(item);
        end.before(child.instance.fragment);
      } else {
        child.textNode = document.createTextNode(text(item));
        end.before(child.textNode);
      }
      range.children[index] = child;
    } else if (template) child.instance.update(item.values);
    else if (child.textNode.data !== text(item)) child.textNode.data = text(item);
  });
  while (range.children.length > values.length) removeRange(range.children.pop());
}
function removeRange(range) {
  let node = range.start;
  while (node) {
    const next = node.nextSibling;
    node.remove();
    if (node === range.end) break;
    node = next;
  }
}
export function render(target, description) {
  let range = mounted.get(target);
  if (!range) {
    const start = document.createComment('view'),
      end = document.createComment('/view');
    target.replaceChildren(start, end);
    range = { start, end, children: [] };
    mounted.set(target, range);
  }
  updateRange(range, description);
}
export function appendView(target, description) {
  const record = instance(description);
  target.append(record.fragment);
}
export function replaceView(target, description) {
  const existing = roots.get(target);
  if (existing?.template === description.template) {
    existing.update(description.values);
    return;
  }
  const record = instance(description);
  target.replaceWith(record.fragment);
}
