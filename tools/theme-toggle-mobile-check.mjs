// Mobile (390x844, touch) reachability check of the light/dark toggle with REAL input events (CDP Input.dispatchTouchEvent), not DOM .click().
// Needs: `ng serve --configuration local --port 4311` + Google Chrome. API is a local stub on :5009 (nothing talks to dev/prod).
// Run: node tools/theme-toggle-mobile-check.mjs <screens-dir> [rtl|ltr]
import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = 'http://localhost:4311', OUT = process.argv[2] || '.', DIR = process.argv[3] || 'rtl';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const stub = http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
	if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
	if (process.env.DEBUG_REQ) console.error(req.method, req.url);
	let data = { items: [], total: 0 };
	if (/access-state/.test(req.url)) data = { state: 'APPROVED', canAccessDashboard: true, message: '', reason: null, hasSample: true, specialties: [] };
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify({ success: true, data, items: [], total: 0, pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, message: 'ok' }));
});
await new Promise(r => stub.listen(5009, '127.0.0.1', r));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9334', `--user-data-dir=${mkdtempSync(join(tmpdir(), 'chrome-tt-'))}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9334/json')).json(); if (targets.length) break; } catch {} await sleep(500); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
const errs = [];
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errs.push((d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 300)); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errs.push('console: ' + d.params.args.map(a => a.value ?? a.description ?? '').join(' | ').slice(0, 400)); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => (await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async name => { const r = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64')); };

// Finds a visible toggle button for `want` ('dark'|'light') that is really on top at its centre point (not covered by an overlay).
const FIND = want => `(() => { const label = want => want === 'dark' ? 'داكن' : 'فاتح';
 const out = []; document.querySelectorAll('[role=group][aria-label="تبديل الثيم"] button').forEach(b => {
  if (b.textContent.trim() !== label('${want}')) return; const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
  if (!r.width || !r.height || cs.visibility === 'hidden') return; const x = r.x + r.width / 2, y = r.y + r.height / 2;
  if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return; const top = document.elementFromPoint(x, y);
  out.push({ x, y, w: r.width, h: r.height, onTop: !!top && (top === b || b.contains(top)), pressed: b.getAttribute('aria-pressed') }); });
 return out.find(o => o.onTop) || null; })()`;
const tap = async (x, y) => { await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(500); };
const state = () => ev(`({ ls: localStorage.getItem('waseet_theme'), html: document.documentElement.className, body: document.body.className, dt: document.documentElement.getAttribute('data-theme') })`);

const roles = {
	guest: { page: '/', menu: 'public' },
	'public-authed': { page: '/', menu: 'public', acc: 'CLIENT_INDIVIDUAL', role: 'CLIENT' },
	provider: { page: '/provider-overview/notifications', menu: 'dash', acc: 'PROVIDER_INDIVIDUAL', role: 'PROVIDER' },
	client: { page: '/client-overview/notifications', menu: 'dash', acc: 'CLIENT_INDIVIDUAL', role: 'CLIENT' },
	marketer: { page: '/marketer-overview', menu: 'dash', acc: 'MARKETING_BROKER', role: 'AFFILIATE' },
	admin: { page: '/supper-admin-overview/settings', menu: 'dash', acc: 'SUPER_ADMIN', role: 'SUPER_ADMIN' },
};
const res = {};
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await cdp('Emulation.setTouchEmulationEnabled', { enabled: true });
for (const [name, c] of Object.entries(roles)) {
	if (process.env.ROLES && !process.env.ROLES.split(',').includes(name)) continue;
	const user = c.acc ? { id: 'u-' + name, email: name + '@test.local', firstName: 'T', lastName: 'U', accountType: c.acc, activeRole: c.role, roles: [c.role], status: 'ACTIVE', isEmailVerified: true } : null;
	const src = `try{if(!sessionStorage.getItem('tt_init')){localStorage.clear();localStorage.setItem('waseet_theme','dark');sessionStorage.setItem('tt_init','1');}${user ? `const t='stub.token';['waseet_token','access_token','token'].forEach(k=>localStorage.setItem(k,t));localStorage.setItem('waseet_user',${JSON.stringify(JSON.stringify(user))});` : ''}}catch(e){}`;
	const r0 = await cdp('Page.addScriptToEvaluateOnNewDocument', { source: src });
	await cdp('Page.navigate', { url: APP + c.page });
	for (let i = 0; i < 100; i++) { await sleep(500); if (await ev(c.menu === 'public' ? `!!document.querySelector('.menu-btn')` : `!!document.querySelector('#user-btn') && !document.querySelector('.page-loader, .global-app-loader')`)) break; } await sleep(1500);
	await ev(`document.documentElement.dir='${DIR}'`);
	const r = { steps: [] };
	await ev(`window.__ev=[];['touchstart','touchend','pointerdown','pointerup','click'].forEach(n=>document.addEventListener(n,e=>window.__ev.push(n+':'+(e.target.className||e.target.tagName)),true));new MutationObserver(()=>window.__ev.push('dd:'+!!document.querySelector('#user-dropdown'))).observe(document.body,{childList:true,subtree:true});`);
	let t = await ev(FIND('light'));
	r.visibleWithoutMenu = !!t;
	if (!t) {
		// open the menu a user would open on mobile
		const sel = c.menu === 'public' ? 'button.menu-btn, .menu-btn' : '#user-btn';
		const b = await ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return { x: r.x + r.width/2, y: r.y + r.height/2, vis: !!r.width, onTop: top === e || e.contains(top), cover: top && (top.tagName + '.' + top.className + ' ' + (top.closest('[class]')||{}).className) }; })()`);
		r.menuButton = b;
		if (b && b.vis) {
			for (let k = 0; k < 6 && !t; k++) {
				for (let w = 0; w < 40 && await ev(`!!document.querySelector('.page-loader')`); w++) await sleep(500);
				const b2 = await ev(`(() => { const e = document.querySelector('${sel}'); const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`);
				await tap(b2.x, b2.y); await sleep(600); t = await ev(FIND('light')); r.tries = k + 1;
			}
			r.visibleAfterMenu = !!t;
			if (!t) r.ev = await ev('window.__ev.slice(-30)');
			if (!t) r.debug = await ev(`(() => { const d = document.querySelector('#user-dropdown'); const bs = [...document.querySelectorAll('[role=group][aria-label="تبديل الثيم"] button')].map(b => { const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return { t: b.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height, top: top && (top.tagName + '.' + top.className) }; }); return { dd: d && JSON.stringify(d.getBoundingClientRect()), exp: document.querySelector('#user-btn').getAttribute('aria-expanded'), bs }; })()`);
		}
	}
	await shot(`${name}-${DIR}-before-tap`);
	if (t) {
		r.target = t;
		await tap(t.x, t.y + (process.env.EDGE_TAP && t.h < 44 ? 17 : 0));
		r.afterLight = await state();
		await shot(`${name}-${DIR}-after-light`);
		r.pressedAfter = await ev(`[...document.querySelectorAll('[role=group][aria-label="تبديل الثيم"] button')].filter(b=>b.textContent.trim()==='فاتح').map(b=>b.getAttribute('aria-pressed'))`);
		await cdp('Page.reload'); await sleep(7000);
		r.afterReload = await state();
		// back to dark through the UI as well
		let m = await ev(FIND('dark'));
		if (!m) { const sel = c.menu === 'public' ? 'button.menu-btn, .menu-btn' : '#user-btn'; const b = await ev(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 }; })()`); if (b) { await tap(b.x, b.y); m = await ev(FIND('dark')); } }
		if (m) { await tap(m.x, m.y); r.backToDark = await state(); }
	}
	r.errs = errs.splice(0).slice(0, 6);
	res[name] = r;
	await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier: r0.result.identifier });
	await cdp('Page.navigate', { url: 'about:blank' }); await sleep(300);
}
console.log(JSON.stringify(res, null, 1));
ws.close(); chrome.kill(); stub.close(); process.exit(0);
