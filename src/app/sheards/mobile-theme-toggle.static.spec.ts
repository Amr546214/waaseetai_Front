import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// J2 D-C1: on a phone the light/dark switch must be reachable. The top-bar toggles are hidden on narrow screens, so the same ThemeService control
// lives inside the account dropdown (dashboards) and the drawer (public navbar, signed-in). Pointer reachability is checked in a real browser (tools/theme-toggle-mobile-check.mjs).
const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');

describe('J2 D-C1 mobile theme toggle', () => {
	const dashHtml = read('dashboard/nav-dashboard/nav-dashboard.html');
	const dashCss = read('dashboard/nav-dashboard/nav-dashboard.css');
	const navHtml = read('navbar/navbar.html');
	const navCss = read('navbar/navbar.css');

	it('dashboard: the dropdown carries a toggle wired to ThemeService with aria-pressed and a group name', () => {
		const block = dashHtml.slice(dashHtml.indexOf('class="udrop-theme"'), dashHtml.indexOf('udrop-theme-sep'));
		expect(block).toContain("themeService.setTheme('dark')");
		expect(block).toContain("themeService.setTheme('light')");
		expect(block).toContain('aria-label="تبديل الثيم"');
		expect((block.match(/\[attr\.aria-pressed\]/g) || []).length).toBe(2);
	});
	it('dashboard: the dropdown toggle is phone-only (top-bar one hidden <=430px), tap target >= 44px, no duplicate id', () => {
		expect(dashCss).toMatch(/\.udrop-theme,\.udrop-theme-sep\{display:none\}/);
		expect(dashCss).toMatch(/max-width:430px\)\{[\s\S]*\.topbar>\.t-toggle\{display:none\}[\s\S]*\.udrop-theme\{display:flex/);
		expect(dashCss).toMatch(/\.t-toggle-menu \.seg\{[^}]*min-height:44px/);
		expect(dashHtml.match(/id="theme-toggle"/g)?.length).toBe(1);
	});
	it('public navbar: the signed-in drawer carries a toggle wired to ThemeService (guest keeps the visible header toggle)', () => {
		const block = navHtml.slice(navHtml.indexOf('class="drawer-theme"'));
		expect(block.slice(0, 900)).toContain("themeService.setTheme('dark')");
		expect(block.slice(0, 900)).toContain("themeService.setTheme('light')");
		expect(block.slice(0, 900)).toContain('aria-label="تبديل الثيم"');
		expect(navHtml.indexOf('class="drawer-theme"')).toBeGreaterThan(navHtml.indexOf('authStore.isAuthenticated()")'));
		expect(navCss).toMatch(/\.drawer-theme-toggle \.seg\{[^}]*min-height:44px/);
	});
});
