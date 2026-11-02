const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { JSDOM } = require('jsdom');

const polish = readFileSync(join(__dirname, '../public/assets/ws-light-polish.js'), 'utf8');

test('light-theme styling keeps the workspace ring driven by its bound progress', () => {
  const dom = new JSDOM('<html><head></head><body class="light-theme"><div class="lc-ring" style="--progress:0"><b>0%</b></div></body></html>', {
    url: 'https://dev.waseetai.com', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  try {
    dom.window.eval(polish);
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    const injected = dom.window.document.getElementById('ws-polish-css').textContent;
    const background = injected.match(/\.lc-ring\{background:([^}]+)/)[1];
    // jsdom does not render conic gradients, so inspect the actual runtime rule.
    // It must retain the live binding, rather than overriding every API value with a fixed percentage.
    assert.match(background, /var\(--progress(?:,\s*0)?\)/);
    assert.doesNotMatch(background, /\s60%/);
    const ring = dom.window.document.querySelector('.lc-ring');
    for (const progress of [0, 25, 100]) {
      ring.style.setProperty('--progress', String(progress));
      const resolved = background.replace(/var\(--progress(?:,\s*0)?\)/, ring.style.getPropertyValue('--progress'));
      assert.match(resolved, new RegExp(`calc\\(${progress}\\s*\\*\\s*1%\\)`));
    }
  } finally {
    dom.window.close();
  }
});
