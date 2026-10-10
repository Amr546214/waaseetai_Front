import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The three-step registration stepper must be centred and evenly spaced: three EQUAL columns (every item, the last one too), the connector line is
// drawn from each circle's centre to the next one (so it is straight and level with the circles), and long labels may wrap instead of overflowing.
const css = readFileSync(join(__dirname, 'register.css'), 'utf8');
const html = readFileSync(join(__dirname, 'register.html'), 'utf8');

describe('register stepper (all three register states)', () => {
	for (const x of ['rg-s1', 'rg-s2', 'rg-s3']) {
		describe(x, () => {
			it('equal columns: no `flex:none` last item, and the stepper is centred with a max width', () => {
				expect(css).not.toContain(`app-register .${x} .step-item:last-child{flex:none}`);
				expect(css).toMatch(new RegExp(`app-register \\.${x} \\.step-item\\{[^}]*flex:1`));
				expect(css).toMatch(new RegExp(`app-register \\.${x} \\.stepper\\{[^}]*max-width:440px[^}]*margin-inline:auto`));
			});
			it('the line is drawn centre-to-centre by the items; the separate connector elements are hidden', () => {
				expect(css).toContain(`app-register .${x} .step-connector{display:none}`);
				expect(css).toMatch(new RegExp(`app-register \\.${x} \\.step-item:not\\(:last-child\\)::after\\{[^}]*top:14px[^}]*inset-inline-start:calc\\(50% \\+ 21px\\)[^}]*width:calc\\(100% - 42px\\)`));
				expect(css).toContain(`app-register .${x} .step-item.step-done:not(:last-child)::after{background:var(--gradient-brand)}`);
			});
			it('labels may wrap (no nowrap overflow on narrow screens) and rows are top-aligned with the circles', () => {
				const label = css.match(new RegExp(`app-register \\.${x} \\.step-label\\{[^}]*\\}`))![0];
				expect(label).not.toContain('white-space:nowrap');
				expect(label).toContain('text-wrap:balance');
				expect(css).toContain(`app-register .${x} .step-row{display:flex;align-items:flex-start;width:100%}`);
			});
		});
	}
	it('the logic and the order of the steps are untouched (role -> basic info -> verification)', () => {
		const order = [...html.matchAll(/<div class="step-label">([^<]+)<\/div>/g)].map(m => m[1]);
		expect(order.slice(0, 3)).toEqual(['اختيار الدور', 'البيانات الاساسية', 'التحقق']);
	});
});
