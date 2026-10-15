/// <reference types="node" />

// §7: the avatar dropdown (dashboard top bar of every role + website navbar) opens «سوق الخدمات» at the real
// marketplace route, in a new tab so the dashboard (and the active role) stay untouched. «الموقع الرئيسي» is gone.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const files = ['dashboard/nav-dashboard/nav-dashboard.html', 'navbar/navbar.html'];

describe('avatar menu: سوق الخدمات', () => {
	for (const f of files) {
		const html = readFileSync(join(__dirname, f), 'utf-8');
		it(`${f} links to /marketplace and no longer says الموقع الرئيسي`, () => {
			expect(html).not.toContain('الموقع الرئيسي');
			const m = /<a[^>]*data-testid="udrop-marketplace"[^>]*>[\s\S]*?<\/a>/.exec(html);
			expect(m).not.toBeNull();
			expect(m![0]).toContain('routerLink="/marketplace"');
			expect(m![0]).toContain('سوق الخدمات');
			expect(m![0]).toContain('role="menuitem"');
			// opening the market must not switch the role: no click handler other than closing the menu
			expect(m![0]).not.toMatch(/switchActiveRole|switchRole/);
		});
		it(`${f}: the item sits inside the dropdown that the mobile layout already shows (no hidden/overflow class on it)`, () => {
			const m = /<a[^>]*data-testid="udrop-marketplace"[^>]*>/.exec(html)![0];
			expect(m).not.toMatch(/hidden|md:|lg:|overflow/);
		});
	}
});
