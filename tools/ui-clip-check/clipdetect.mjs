// Visual clip detector for Arabic text (manual tool, not part of CI).
//
// For every visible Arabic text node it measures the REAL glyph extent (with
// descenders, via canvas actualBoundingBox*) and compares it with the box of the
// nearest ancestor that clips (overflow != visible). Collapsed panels
// (height < 2px, e.g. closed FAQ answers) are ignored on purpose.
//
//   npm i -D playwright            # or use an existing Playwright install
//   npx ng build --configuration production
//   cp dist/frontend/browser/index.csr.html dist/frontend/browser/index.html
//   <serve dist/frontend/browser with an SPA fallback, proxying GET /api/* if you want real data>
//   node tools/ui-clip-check/clipdetect.mjs http://127.0.0.1:4301 ./clip-report
//
// Prints "CLIPPED: N" and one line per clipped text; N must be 0.
import { chromium } from 'playwright';
import fs from 'node:fs';
const [,, base, label] = process.argv;
const PAGES = ['/', '/marketplace', '/marketplace/categories', '/auth/login', '/auth/register', '/pricing', '/about', '/how-it-works', '/contact', '/support'];
const VIEWPORTS = [{ w: 1440, h: 900, name: 'desktop' }, { w: 390, h: 844, name: 'mobile' }];
const DETECT = () => {
  const AR = /[؀-ۿ]/;
  const cv = document.createElement('canvas').getContext('2d');
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const txt = node.textContent.trim();
    if (!txt || !AR.test(txt)) continue;
    const el = node.parentElement; if (!el) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const range = document.createRange(); range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter(r => r.width > 0 && r.height > 0);
    if (!rects.length) continue;
    const r = rects[0];
    if (r.bottom < 0 || r.top > innerHeight * 6) continue;
    cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const m = cv.measureText(txt);
    const fs = parseFloat(cs.fontSize);
    const baseline = r.top + m.fontBoundingBoxAscent;
    const gTop = baseline - m.actualBoundingBoxAscent, gBot = baseline + m.actualBoundingBoxDescent;
    // nearest clipping ancestor (overflow != visible on y axis)
    let a = el, clip = null;
    while (a && a !== document.documentElement) {
      const c = getComputedStyle(a);
      if (c.overflowY !== 'visible') { clip = a; break; }
      a = a.parentElement;
    }
    const lh = cs.lineHeight === 'normal' ? (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent) : parseFloat(cs.lineHeight);
    const glyphH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    let clippedTop = 0, clippedBot = 0, clipSel = '';
    if (clip && clip !== document.body) {
      const cr = clip.getBoundingClientRect(); const cc = getComputedStyle(clip);
      if (cr.height < 2) continue; // collapsed accordion / hidden panel by design
      const top = cr.top + parseFloat(cc.borderTopWidth), bot = cr.bottom - parseFloat(cc.borderBottomWidth);
      clippedTop = Math.max(0, top - gTop); clippedBot = Math.max(0, gBot - bot);
      clipSel = clip.tagName.toLowerCase() + (clip.className && typeof clip.className === 'string' ? '.' + clip.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    }
    const key = el.tagName + el.className + txt.slice(0, 20);
    if (seen.has(key)) continue; seen.add(key);
    out.push({
      text: txt.slice(0, 26), el: el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''),
      fs: +fs.toFixed(1), lhRatio: +(lh / fs).toFixed(2), glyphRatio: +(glyphH / fs).toFixed(2),
      clip: clipSel, clippedTop: +clippedTop.toFixed(1), clippedBot: +clippedBot.toFixed(1),
      overflowHidden: !!clipSel
    });
  }
  return out;
};
const browser = await chromium.launch();
const result = { label, base, findings: [], tightButNotClipped: [], pages: {} };
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, locale: 'ar-SA' });
  const page = await ctx.newPage();
  for (const p of PAGES) {
    try { await page.goto(base + p, { waitUntil: 'networkidle', timeout: 25000 }); } catch {}
    await page.waitForTimeout(800);
    await page.evaluate(async () => { await document.fonts.ready; });
    const rows = await page.evaluate(DETECT);
    result.pages[`${vp.name}${p}`] = rows.length;
    for (const r of rows) {
      if (r.clippedTop > 0.5 || r.clippedBot > 0.5) result.findings.push({ vp: vp.name, page: p, ...r });
      else if (r.lhRatio < 1.2 && r.overflowHidden) result.tightButNotClipped.push({ vp: vp.name, page: p, ...r });
    }
  }
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${label}.json`, JSON.stringify(result, null, 1));
console.log(`texts checked per page:`, JSON.stringify(result.pages));
console.log(`CLIPPED: ${result.findings.length}   tight line-height inside overflow-hidden (not yet clipped): ${result.tightButNotClipped.length}`);
for (const f of result.findings.slice(0, 40)) console.log(` ${f.vp} ${f.page} | ${f.el} "${f.text}" fs=${f.fs} lh=${f.lhRatio} glyph=${f.glyphRatio} | clipper=${f.clip} top-${f.clippedTop}px bottom-${f.clippedBot}px`);
