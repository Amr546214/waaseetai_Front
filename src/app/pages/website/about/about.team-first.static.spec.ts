import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The team section: Abdulrahman Al-Amer first, then Amr Okasha (first in charge of the project, with his own GitHub / LinkedIn), the rest as before, and the two software engineers at the end.
const html = readFileSync(join(process.cwd(), 'src/app/pages/website/about/about.html'), 'utf8');
const grid = html.slice(html.indexOf('<div class="team-grid">'));
const names = [...grid.matchAll(/team-name">([^<]+)</g)].map(m => m[1]);
const cardOf = (testid: string) => { const i = grid.indexOf(`data-testid="${testid}"`); return grid.slice(i, grid.indexOf('</div>\n          </div>\n', grid.indexOf('team-socials', i)) + 40); };

describe('about page: team section', () => {
	it('order: Abdulrahman first, Amr second, Karim and Ziad last; nobody duplicated', () => {
		expect(names).toEqual(['عبدالرحمن العامر', 'عمرو عكاشة', 'ميمونة العباد', 'فريق مختص', 'محمد أنس', 'نديم بدر', 'كريم محمد', 'زياد حسانين']);
	});
	it('Amr Okasha: the first in charge of the project, his own GitHub / LinkedIn (not the company links), photo with fallback', () => {
		const c = cardOf('team-first-founder');
		expect(c).toContain('القائم الأول على المشروع'); expect(c).toContain('href="https://github.com/Amr546214"'); expect(c).toContain('href="https://www.linkedin.com/in/%D9%90%D9%90amr-okasha/"');
		expect(c).not.toContain('x.com'); expect(c).not.toContain('linkedin.com/company'); expect(c).toContain('/images/team/amr-okasha.jpg'); expect(c).toContain('onerror="this.remove()"');
		expect(html).toContain('<symbol id="ws-social-github"');
	});
	it('Karim Muhammad and Ziad Hassanein: software engineers with their own GitHub / LinkedIn and photos', () => {
		const k = cardOf('team-member-karim'), z = cardOf('team-member-ziad');
		expect(k).toContain('مهندس برمجيات'); expect(k).toContain('href="https://github.com/KariMuhammad"'); expect(k).toContain('href="https://www.linkedin.com/in/karim-muhammad-561573289"'); expect(k).toContain('/images/team/karim-muhammad.jpg');
		expect(z).toContain('مهندس برمجيات'); expect(z).toContain('href="https://github.com/ziadhassanein21"'); expect(z).toContain('href="https://www.linkedin.com/in/ziad-hassanein-iti/"'); expect(z).toContain('/images/team/ziad-hassanein.jpg');
		for (const c of [k, z]) { expect(c).not.toContain('utm_'); expect(c).not.toContain('x.com'); }
	});
});
