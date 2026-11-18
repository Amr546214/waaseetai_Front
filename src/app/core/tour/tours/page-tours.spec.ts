import { ALL_TOURS } from './index';
import { PAGE_TOURS, pageTourFor } from './page-tours';
import { VISITOR_TOUR } from './visitor.tour';

describe('page tours', () => {
	it('all step ids across every tour are unique (they are the audio file names)', () => {
		const ids = ALL_TOURS.flatMap(t => t.steps.map(s => s.id));
		expect(new Set(ids).size).toBe(ids.length);
		expect(ALL_TOURS).toContain(VISITOR_TOUR);
		for (const e of PAGE_TOURS) expect(ALL_TOURS).toContain(e.tour);
	});
	it('each page tour stays on its own page, in Arabic, with real sentences', () => {
		for (const e of PAGE_TOURS) for (const s of e.tour.steps) {
			expect(s.route).toBe(e.path);
			expect(/[؀-ۿ]/.test(s.text)).toBe(true);
			expect(s.text.length).toBeGreaterThan(10);
		}
	});
	it('pageTourFor matches the path only (query, hash, trailing slash ignored); other pages and every dashboard path have none', () => {
		expect(pageTourFor('/about')?.tour.id).toBe('page-about-v1');
		expect(pageTourFor('/blog/?q=ai#x')?.tour.id).toBe('page-blog-v1');
		expect(pageTourFor('/contact/')?.tour.id).toBe('page-contact-v1');
		expect(pageTourFor('/auth/register')?.presence).toBe('#email');
		for (const p of ['/', '/blog/some-article', '/client-overview', '/provider-overview/projects', '/marketer-overview', '/supper-admin-overview', '/assistant']) expect(pageTourFor(p), p).toBeNull();
	});
});
