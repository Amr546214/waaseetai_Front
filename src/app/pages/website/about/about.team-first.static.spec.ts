import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The first person of the team section is Amr Okasha, the first in charge of the project, with his own GitHub / LinkedIn (not the company links).
const html = readFileSync(join(process.cwd(), 'src/app/pages/website/about/about.html'), 'utf8');
describe('about page: team section', () => {
	const grid = html.slice(html.indexOf('<div class="team-grid">'));
	const first = grid.slice(grid.indexOf('<div class="team-card"'), grid.indexOf('</div>\n          </div>\n', grid.indexOf('team-socials')) + 40);
	it('Amr Okasha is the first card, as the first in charge of the project', () => {
		expect(first).toContain('data-testid="team-first-founder"'); expect(first).toContain('عمرو عكاشة'); expect(first).toContain('القائم الأول على المشروع');
		expect(grid.indexOf('عمرو عكاشة')).toBeLessThan(grid.indexOf('عبدالرحمن العامر'));
		expect((grid.match(/عمرو عكاشة<\/div>/g) ?? []).length).toBe(1); // not duplicated further down
	});
	it('his links are GitHub and LinkedIn (his profiles), and his photo has a fallback to the initial', () => {
		expect(first).toContain('href="https://github.com/Amr546214"');
		expect(first).toContain('href="https://www.linkedin.com/in/%D9%90%D9%90amr-okasha/"');
		expect(first).toContain('#ws-social-github'); expect(first).not.toContain('x.com'); expect(first).not.toContain('linkedin.com/company');
		expect(first).toContain('/images/team/amr-okasha.jpg'); expect(first).toContain('onerror="this.remove()"');
		expect(html).toContain('<symbol id="ws-social-github"');
	});
});
