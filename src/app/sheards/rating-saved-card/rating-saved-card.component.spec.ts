import { TestBed } from '@angular/core/testing';
import { RatingSavedCard } from './rating-saved-card.component';

describe('RatingSavedCard (read-only saved review)', () => {
	function render(review: any) {
		TestBed.configureTestingModule({ imports: [RatingSavedCard] });
		const f = TestBed.createComponent(RatingSavedCard);
		f.componentRef.setInput('review', review);
		f.detectChanges();
		return f.nativeElement as HTMLElement;
	}
	afterEach(() => TestBed.resetTestingModule());

	it('shows exactly the stored stars, tags, comment and date, with no form or buttons', () => {
		const el = render({ id: 'r1', rating: 4, comment: 'عمل ممتاز', tags: ['جودة عالية', 'احترافية'], createdAt: '2026-10-14T19:58:51.834Z' });
		expect(el.querySelectorAll('[data-testid="saved-rating-stars"] svg.on').length).toBe(4);
		expect(el.querySelectorAll('[data-testid="saved-rating-stars"] svg').length).toBe(5);
		expect(el.querySelector('[data-testid="saved-rating-value"]')?.textContent).toContain('4 / 5');
		expect(Array.from(el.querySelectorAll('.rsc-tag')).map(x => x.textContent!.trim())).toEqual(['جودة عالية', 'احترافية']);
		expect(el.querySelector('[data-testid="saved-rating-comment"]')?.textContent).toContain('عمل ممتاز');
		expect(el.querySelector('[data-testid="saved-rating-date"]')?.textContent).toMatch(/2026\/10\/14/);
		expect(el.querySelector('button, textarea, input')).toBeNull();
	});

	it('omits tags and comment when none were saved (nothing is invented)', () => {
		const el = render({ id: 'r2', rating: 2, comment: null, tags: [], createdAt: '2026-10-14T19:58:51.834Z' });
		expect(el.querySelector('[data-testid="saved-rating-tags"]')).toBeNull();
		expect(el.querySelector('[data-testid="saved-rating-comment"]')).toBeNull();
		expect(el.querySelectorAll('[data-testid="saved-rating-stars"] svg.on').length).toBe(2);
	});

	it('shows the visibility state: published for the public, or private (parties + admin only); nothing is drawn for an older server that sends no flag', () => {
		const base = { id: 'r3', rating: 5, comment: null, tags: [], createdAt: '2026-10-14T19:58:51.834Z' };
		expect(render({ ...base, isPublic: true }).querySelector('[data-testid="saved-rating-visibility"]')?.textContent).toContain('منشور للعامة');
		TestBed.resetTestingModule();
		expect(render({ ...base, isPublic: false }).querySelector('[data-testid="saved-rating-visibility"]')?.textContent).toContain('غير منشور: مرئي لك وللطرف الآخر وللإدارة فقط');
		TestBed.resetTestingModule();
		expect(render(base).querySelector('[data-testid="saved-rating-visibility"]')).toBeNull();
	});
});
