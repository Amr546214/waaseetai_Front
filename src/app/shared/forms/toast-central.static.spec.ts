import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Owner rule: every success/error/warning message comes from ONE place, UiNotificationService, rendered by <app-notification-host>.
// This guard fails if a page grows its own toast again (local state, markup/CSS with a fixed toast, or alert()).
// ALLOW-LIST: production files that may keep toast-like code, each with a one-line reason.
const ALLOW: Record<string, string> = {
	'src/app/shared/forms/notification-host.component.ts': 'the central host itself',
	'src/app/core/services/ui-notification.service.ts': 'the central service itself',
	// Exceptions (server-pushed notification popup with an action link, NOT action feedback; fed only by NotificationEngineService):
	'src/app/core/services/notification-engine.service.ts': 'server-pushed notification engine (separate system)',
	'src/app/sheards/navbar/navbar.html': 'renders the engine popup for server-pushed notifications (action link)',
	'src/app/sheards/dashboard/nav-dashboard/nav-dashboard.html': 'renders the engine popup for server-pushed notifications (action link)',
};

const read = (p: string) => readFileSync(p, 'utf8');
const walk = (dir: string, out: string[] = []): string[] => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) walk(p, out); else out.push(p); } return out; };
const prod = () => walk('src/app').filter(f => /\.(ts|html|css)$/.test(f) && !/\.spec\.ts$/.test(f) && !(f in ALLOW));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const rules = (css: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].trim(), body: m[2] }));

describe('toast feedback is central (UiNotificationService)', () => {
	it('no production CSS defines a toast/snackbar rule that is fixed/absolute positioned', () => {
		const offenders: string[] = [];
		for (const file of prod().filter(f => f.endsWith('.css'))) {
			for (const r of rules(stripComments(read(file)))) {
				if (/toast|snackbar/i.test(r.sel) && /position\s*:\s*(fixed|absolute)/.test(r.body)) offenders.push(`${file}: ${r.sel}`);
			}
		}
		expect(offenders).toEqual([]);
	});
	it('no production markup/TS renders an inline fixed toast/snackbar element', () => {
		const offenders: string[] = [];
		for (const file of prod().filter(f => /\.(html|ts)$/.test(f))) {
			const src = stripComments(read(file));
			for (const m of src.matchAll(/<[^>]*(?:toast|snackbar)[^>]*>/gi)) if (/position\s*:\s*fixed|\bfixed\b/.test(m[0])) offenders.push(`${file}: ${m[0].slice(0, 80)}`);
		}
		expect(offenders).toEqual([]);
	});
	it('no page defines local toast state or a showToast method', () => {
		const offenders: string[] = [];
		const re = /\b(toastMessage|toastVisible|toastMsg|toastTimer|showToast)\b|\btoast\s*=\s*signal|\bsnackbar\w*\s*=\s*signal/;
		for (const file of prod().filter(f => f.endsWith('.ts') || f.endsWith('.html'))) {
			const m = stripComments(read(file)).match(re);
			if (m) offenders.push(`${file}: ${m[0]}`);
		}
		expect(offenders).toEqual([]);
	});
	it('no production code uses alert()', () => {
		const offenders: string[] = [];
		for (const file of prod().filter(f => f.endsWith('.ts') || f.endsWith('.html'))) {
			if (/(^|[^.\w$])(window\.)?alert\s*\(/m.test(stripComments(read(file)))) offenders.push(file);
		}
		expect(offenders).toEqual([]);
	});
	it('the allow-list stays small and every entry exists', () => {
		expect(Object.keys(ALLOW).length - 2).toBeLessThanOrEqual(3); // minus the central host + service
		for (const f of Object.keys(ALLOW)) expect(() => statSync(f)).not.toThrow();
	});
});
