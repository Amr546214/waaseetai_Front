import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Static guard (jsdom has no layout engine): the 6-step stepper must stay compact on phones, otherwise it widens the whole
// dashboard page (429px at a 390px viewport) and the page scrolls horizontally. Verified in a real browser at 390 / 1280.
const DIR = join(process.cwd(), 'src', 'app', 'pages', 'dashboard', 'clients-overview', 'create-request');
const css = readFileSync(join(DIR, 'create-request.css'), 'utf8');
const html = readFileSync(join(DIR, 'create-request.html'), 'utf8');

/** The body of the (last) `@media (max-width: 767px)` block that mentions the stepper. */
function mobileBlock(): string {
	const start = css.lastIndexOf('@media (max-width: 767px)');
	expect(start).toBeGreaterThan(-1);
	return css.slice(start);
}

describe('create request stepper on phones', () => {
	it('shrinks the circles, hides the inactive labels and shows only the active one without widening the row', () => {
		const m = mobileBlock();
		expect(m).toMatch(/\.step-item \.step-circle\s*\{[^}]*width:\s*32px/);
		expect(m).toMatch(/\.step-item \.step-label\s*\{\s*display:\s*none/);
		expect(m).toMatch(/\.step-item\.active \.step-label\s*\{[^}]*position:\s*absolute/);
	});

	it('keeps the active label inside the row at both ends', () => {
		const m = mobileBlock();
		expect(m).toMatch(/\.step-item\.active:first-child \.step-label/);
		expect(m).toMatch(/\.step-item\.active:last-child \.step-label/);
	});

	it('leaves the desktop markup untouched (44px circles, nowrap labels) - the compact rules live only in the mobile media query', () => {
		expect(html).toContain('step-circle w-11 h-11');
		expect(html).toContain('step-label text-[13px]');
		const beforeMedia = css.slice(0, css.lastIndexOf('@media (max-width: 767px)'));
		expect(beforeMedia).not.toMatch(/\.step-item \.step-label\s*\{\s*display:\s*none/);
	});
});
