/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOCIAL_LINKS } from './social-links';

const read = (p: string) => readFileSync(join(__dirname, '..', '..', p), 'utf-8');

describe('social links: one list for the whole site', () => {
	it('every link is a clean https account URL (no share-session tracking parameters)', () => {
		for (const [name, url] of Object.entries(SOCIAL_LINKS)) {
			expect(url, name).toMatch(/^https:\/\//);
			expect(url, name).not.toMatch(/[?&](utm_|si=|stkn=|_r=|_t=|s=)/);
		}
		expect(SOCIAL_LINKS.linkedin).toBe('https://www.linkedin.com/in/waseet-ai-a856492a5');
	});
	it('the contact page and the footer take their links from it (no hard-coded social URL, no invented company page)', () => {
		for (const file of ['pages/website/contact/contact.html', 'sheards/footer/footer.html']) {
			const html = read(file);
			expect(html, file).not.toMatch(/href="https?:\/\/[^"]*(x\.com|twitter\.com|instagram\.com|snapchat\.com|linkedin\.com|youtube\.com|tiktok\.com)/);
			expect(html, file).toContain('[href]="social.linkedin"');
		}
		expect(read('pages/website/contact/contact.ts')).toContain('SOCIAL_LINKS');
		expect(read('sheards/footer/footer.ts')).toContain('SOCIAL_LINKS');
	});
	it('the about page: the team cards without a personal profile use the platform accounts (no invented company page, no wrong X handle); personal profiles stay', () => {
		const html = read('pages/website/about/about.html');
		expect(html).not.toContain('linkedin.com/company'); expect(html).not.toContain('x.com/waseetai');
		expect(html).toContain('[href]="social.linkedin"'); expect(html).toContain('[href]="social.x"');
		expect(html).toContain('linkedin.com/in/karim-muhammad-561573289'); // a member's own profile is untouched
		expect(read('pages/website/about/about.ts')).toContain('SOCIAL_LINKS');
	});
});
