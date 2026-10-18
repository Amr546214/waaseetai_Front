import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// D8: «إرسال طلب تعديل» (Tailwind "bg-gradient-to-r from-cyan-500 to-blue-600 text-white") was white text on a WHITE background in the light theme.
// Cause: ws-light-polish.js read the oklch() gradient as "no background" (rgb()-only parser) and forced the big rounded button to a white "card".
// Static guards (the real rendering is checked in the local Playwright run).
const ROOT = join(__dirname, '..', '..', '..', '..');
const polish = readFileSync(join(ROOT, 'public', 'assets', 'ws-light-polish.js'), 'utf8');
const styles = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');

const lum = (hex: string) => {
	const n = parseInt(hex.slice(1), 16);
	const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
	return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
};
const contrastOnWhite = (hex: string) => 1.05 / (lum(hex) + 0.05);

describe('gradient call-to-action buttons: readable in both themes', () => {
	it('the light-theme polish script parses modern colors (oklch/oklab) so a Tailwind v4 gradient is not mistaken for "no background"', () => {
		expect(polish).toMatch(/oklch\|oklab/);
		expect(polish).toContain('getImageData');
	});

	it('the "card surface" repaint (forced white background) never applies to buttons, links, controls or role=button', () => {
		const rule = polish.slice(polish.indexOf('var interactive='), polish.indexOf('var interactive=') + 400);
		expect(rule).toContain('BUTTON');
		expect(rule).toContain("role')==='button'");
		expect(polish).toMatch(/rad>=10 && rcc\.width>=200 && rcc\.height>=56 && !colored && !interactive/);
	});

	it('styles.css darkens the cyan->blue gradient stops: every state keeps a white label at WCAG AA (>= 4.5:1)', () => {
		const block = styles.slice(styles.indexOf('Gradient call-to-action buttons'));
		const colors = Array.from(block.matchAll(/--tw-gradient-(?:from|to): (#[0-9A-Fa-f]{6})/g)).map(m => m[1]);
		expect(colors.length).toBeGreaterThanOrEqual(4); // normal from/to + hover from/to
		for (const c of colors) expect(contrastOnWhite(c), c).toBeGreaterThanOrEqual(4.5);
		expect(block).toContain(':hover:not(:disabled)');
		expect(block).toContain(':focus-visible');
		expect(block).toContain(':disabled');
		expect(block).toContain('color: #fff');
	});
});
