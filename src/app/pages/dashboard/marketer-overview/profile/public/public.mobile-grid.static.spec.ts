import { readFileSync } from 'node:fs';

// At 390px the profile grid must collapse to ONE shrinkable column. The rule once targeted `.main-inner > div:nth-child(3)` while the grid is the 2nd child,
// so the two fixed columns (280px + 1fr) pushed the page to 529px. The rule now names the grid itself, and the template carries that class.
describe('marketer public profile: mobile grid', () => {
	const dir = 'src/app/pages/dashboard/marketer-overview/profile/public/';
	const html = readFileSync(dir + 'public.html', 'utf8');
	const css = readFileSync(dir + 'public.css', 'utf8');

	it('the two-column grid element has the pub-grid class', () => {
		expect(html).toMatch(/<div class="pub-grid" style="display:grid;grid-template-columns:280px 1fr/);
	});
	it('a phone-width rule collapses exactly that class to a shrinkable single column', () => {
		const media = css.slice(css.indexOf('@media(max-width:767px)'));
		expect(media).toMatch(/\.pub-grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
		expect(media).toMatch(/\.pub-grid\s*>\s*\*\s*\{\s*min-width:\s*0/);
	});
	it('no rule depends on the position of the grid among its siblings', () => {
		expect(css).not.toMatch(/\.main-inner\s*>\s*div:nth-child\(3\)/);
	});
});
