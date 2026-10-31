const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const root = join(__dirname, '..');
const template = readFileSync(join(root, 'src/app/pages/dashboard/clients-overview/my-request/request-details/request-details.html'), 'utf8');
const polish = readFileSync(join(root, 'public/assets/ws-light-polish.js'), 'utf8');

function render(owned = true) {
  let dialogTag = template.match(/<div class="[^"]*\bneg-dialog\b[^"]*"[^>]*>/)[0];
  if (!owned) dialogTag = dialogTag.replace(' data-ws-theme-owned', '');
  const dom = new JSDOM(`<html><head></head><body class="light-theme"><div id="neg-modal">${dialogTag}<div class="neg-dialog-head" style="background:rgb(245,245,245);border-radius:12px">Heading</div></div></div></body></html>`, {
    url: 'https://dev.waseetai.com', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const header = dom.window.document.querySelector('.neg-dialog-head');
  header.dataset.originalStyle = header.getAttribute('style');
  header.getBoundingClientRect = () => ({ width: 400, height: 80 });
  // Supply layout/color inputs that jsdom cannot reliably compute from the app's CSS.
  const getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  dom.window.getComputedStyle = element => {
    const style = getComputedStyle(element);
    if (element !== header) return style;
    return new Proxy(style, { get(target, property) {
      if (property === 'borderTopLeftRadius') return '12px';
      if (property === 'backgroundColor') return 'rgb(245, 245, 245)';
      const value = target[property];
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  };
  dom.window.eval(polish);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  return dom;
}

test('the negotiation dialog does not match the global forced-dark modal styles', () => {
  const dom = render();
  try {
    const dialog = dom.window.document.querySelector('.neg-dialog');
    const rules = Array.from(dom.window.document.getElementById('ws-modal-glass').sheet.cssRules);
    assert.equal(rules.some(rule => rule.selectorText && dialog.matches(rule.selectorText)), false);
  } finally { dom.window.close(); }
});

test('runtime light-theme polish does not repaint the negotiation header', () => {
  const dom = render();
  const legacy = render(false);
  try {
    const header = dom.window.document.querySelector('.neg-dialog-head');
    assert.equal(header.getAttribute('style'), header.dataset.originalStyle);
    assert.equal(header.style.getPropertyPriority('background'), '');
    const unownedHeader = legacy.window.document.querySelector('.neg-dialog-head');
    assert.notEqual(unownedHeader.getAttribute('style'), unownedHeader.dataset.originalStyle, 'The unprotected header must reproduce the unwanted repaint');
  } finally { dom.window.close(); legacy.window.close(); }
});
