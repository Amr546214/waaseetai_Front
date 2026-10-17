// Counts the API requests the REAL frontend makes during a representative navigation session per role.
// Needs: `ng serve --configuration local --port 4311` (API at http://localhost:5009/api) and Google Chrome. The API is a local STUB that answers
// every call with an empty-but-valid body and records it; nothing talks to dev/prod. Counts are what the app asks for on those pages with
// empty data (calls that only appear when lists have rows are not seen: the table in the report adds a margin for that).
// Run: node tools/measure-session-requests.mjs [out.json]
import http from 'node:http';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const APP = 'http://127.0.0.1:4311';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const log = []; let step = 'boot';
const stub = http.createServer((req, res) => {
	res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); res.setHeader('Access-Control-Allow-Credentials', 'true');
	res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*'); res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
	if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
	log.push({ step, method: req.method, url: req.url.split('?')[0] });
	let data = { items: [], total: 0 };
	if (/access-state/.test(req.url)) data = { state: 'APPROVED', canAccessDashboard: true, message: '', reason: null, hasSample: true, specialties: [] };
	res.setHeader('content-type', 'application/json');
	res.end(JSON.stringify({ success: true, data, items: [], total: 0, pagination: { page: 1, limit: 10, total: 0, totalPages: 0 }, message: 'ok' }));
});
await new Promise(r => stub.listen(5009, '127.0.0.1', r));

const users = {
	client: { accountType: 'CLIENT_INDIVIDUAL', activeRole: 'CLIENT', home: '/client-overview', pages: ['/client-overview', '/client-overview/my-requests', '/client-overview/my-requests/r1', '/client-overview/projects/active', '/client-overview/finance/wallet', '/client-overview/finance/transactions', '/client-overview/notifications', '/client-overview/messages', '/client-overview/profile', '/client-overview/market', '/client-overview/reports', '/client-overview/disputes'] },
	provider: { accountType: 'PROVIDER_INDIVIDUAL', activeRole: 'PROVIDER', home: '/provider-overview', pages: ['/provider-overview', '/provider-overview/explore-requests', '/provider-overview/offers', '/provider-overview/projects/active', '/provider-overview/finance/wallet', '/provider-overview/finance/transactions', '/provider-overview/notifications', '/provider-overview/messages', '/provider-overview/reports', '/provider-overview/business-models/market', '/provider-overview/profile/data', '/provider-overview/disputes'] },
	affiliate: { accountType: 'MARKETING_BROKER', activeRole: 'AFFILIATE', home: '/marketer-overview', pages: ['/marketer-overview', '/marketer-overview/referrals', '/marketer-overview/ref-links', '/marketer-overview/commissions', '/marketer-overview/withdraw', '/marketer-overview/assets', '/marketer-overview/profile', '/marketer-overview/notifications', '/marketer-overview/messages', '/marketer-overview/help'] },
	admin: { accountType: 'SUPER_ADMIN', activeRole: 'SUPER_ADMIN', home: '/supper-admin-overview', pages: ['/supper-admin-overview', '/supper-admin-overview/users', '/supper-admin-overview/requests', '/supper-admin-overview/finance', '/supper-admin-overview/disputes', '/supper-admin-overview/support', '/supper-admin-overview/kyc', '/supper-admin-overview/settings'] },
};

const chromeDir = mkdtempSync(join(tmpdir(), 'chrome-rl-'));
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9333', `--user-data-dir=${chromeDir}`, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let targets; for (let i = 0; i < 40; i++) { try { targets = await (await fetch('http://127.0.0.1:9333/json')).json(); if (targets.length) break; } catch {} await sleep(500); }
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = expression => cdp('Runtime.evaluate', { expression, awaitPromise: true });

const result = {};
for (const [role, u] of Object.entries(users)) {
	log.length = 0;
	const user = { id: 'u-' + role, email: role + '@test.local', firstName: 'T', lastName: 'U', accountType: u.accountType, activeRole: u.activeRole, roles: [u.activeRole === 'AFFILIATE' ? 'AFFILIATE' : u.activeRole], status: 'ACTIVE', isEmailVerified: true };
	await cdp('Page.enable');
	const src = `try{localStorage.clear();const t='stub.${role}.token';['waseet_token','access_token','token'].forEach(k=>localStorage.setItem(k,t));localStorage.setItem('waseet_user',${JSON.stringify(JSON.stringify(user))});}catch(e){}`;
	const { result: { identifier } = {} } = (await cdp('Page.addScriptToEvaluateOnNewDocument', { source: src })).result ?? {};
	step = 'p0 ' + u.pages[0];
	await cdp('Page.navigate', { url: APP + u.pages[0] });
	await sleep(6000);
	const perPage = [{ page: u.pages[0], calls: log.filter(l => l.step === step).length }];
	for (let i = 1; i < u.pages.length; i++) {
		step = `p${i} ${u.pages[i]}`;
		await evalJs(`history.pushState({}, '', ${JSON.stringify(u.pages[i])}); dispatchEvent(new PopStateEvent('popstate'));`);
		await sleep(2500);
		perPage.push({ page: u.pages[i], calls: log.filter(l => l.step === step).length });
	}
	const dup = {}; for (const l of log) { const k = l.method + ' ' + l.url; dup[k] = (dup[k] || 0) + 1; }
	result[role] = { total: log.length, pages: u.pages.length, perPage, topRepeated: Object.entries(dup).sort((a, b) => b[1] - a[1]).slice(0, 8) };
	if (identifier) await cdp('Page.removeScriptToEvaluateOnNewDocument', { identifier });
	await cdp('Page.navigate', { url: 'about:blank' }); await sleep(500);
}
console.log(JSON.stringify(result, null, 1));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 1));
ws.close(); chrome.kill(); stub.close(); process.exit(0);
