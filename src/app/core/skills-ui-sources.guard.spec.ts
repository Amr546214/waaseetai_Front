import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// add-account (provider / client / marketer) and the client-area profile-edit take skills ONLY from the catalog through ws-skills-picker:
// no preset skills, no input to type a skill.
const APP = join(process.cwd(), 'src', 'app');
const read = (rel: string) => readFileSync(join(APP, rel), 'utf8');
const PAGES = ['provider-overview', 'clients-overview', 'marketer-overview'].map(r => `pages/dashboard/${r}/profile/add-account`);

describe('skills UIs use the catalog picker (static)', () => {
	for (const dir of PAGES) {
		it(`${dir}: ws-skills-picker + catalog options, no typed-skill input`, () => {
			const html = read(`${dir}/add-account.html`);
			const ts = read(`${dir}/add-account.ts`);
			expect(html).toContain('<ws-skills-picker');
			expect(html).toContain('skillOptions()');
			expect(html).toContain('skillCategories()');
			expect(html).not.toMatch(/skillInput|handleSkillKey|addSkill|removeSkill/);
			expect(html).not.toMatch(/اكتب مهارة/);
			expect(html).not.toMatch(/<option value="(تصميم جرافيك وبصري|تطوير ويب وتطبيقات|كتابة محتوى وترجمة)"/);
			expect(ts).toContain('SkillsPickerComponent');
		});
	}

	it('add-account.base: reads the catalog service, starts with no preset skills, has no free-text skill methods', () => {
		const base = read('shared/add-account/add-account.base.ts');
		expect(base).toContain('SkillsCatalogService');
		expect(base).toContain('getAll()');
		expect(base).toMatch(/skills\s*=\s*signal<string\[\]>\(\[\]\)/);
		expect(base).not.toMatch(/Figma|Adobe XD/);
		expect(base).not.toMatch(/addSkill|removeSkill|handleSkillKey|skillInput/);
	});

	it('clients-overview profile-edit: picker over the catalog of the main specialty, no typed-skill input', () => {
		const html = read('pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html');
		const ts = read('pages/dashboard/clients-overview/profile/profile-edit/profile-edit.ts');
		expect(html).toContain('<ws-skills-picker');
		expect(html).not.toMatch(/addSkill\(|removeSkill\(|placeholder="اضف مهارة جديدة"/);
		expect(ts).toContain('SkillsCatalogService');
		expect(ts).toContain('getProviderMine');
		expect(ts).toContain('getCatalog');
		expect(ts).not.toMatch(/addSkill|removeSkill/);
		expect(ts).not.toMatch(/Figma|Adobe XD/);
	});

	it('provider-side request view shows no invented requirements', () => {
		const html = read('pages/dashboard/provider-overview/explore-requests/applay-request/applay-request.html');
		expect(html).not.toContain('Adobe Illustrator');
		expect(html).toContain('requiredSkills');
	});
});
