import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER } from 'rxjs';
import { vi } from 'vitest';
import { ProviderProfileComponent } from './provider-profile/provider-profile';
import { CompareProvidersComponent } from './compare-providers/compare-providers';
import { MarketplaceService } from '../../../core/services/marketplace.service';

// Skills shown on client-facing provider pages come from the API output (identical labels); with none there is an honest empty state.
describe('provider skills on client-facing pages', () => {
	beforeEach(async () => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		const svc = new Proxy({}, { get: () => () => NEVER });
		await TestBed.configureTestingModule({
			imports: [ProviderProfileComponent, CompareProvidersComponent],
			providers: [provideRouter([]), { provide: MarketplaceService, useValue: svc }],
		}).compileComponents();
	});
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('provider profile: skills from the API render as tags; empty list shows the honest empty state', () => {
		const f = TestBed.createComponent(ProviderProfileComponent);
		const c: any = f.componentInstance;
		const host = f.nativeElement as HTMLElement;
		const base = { id: 'p1', name: 'م', specialties: [], services: [], reviews: [], basicInfo: {} };
		c.loading.set(false);
		c.provider.set({ ...base, skills: ['Figma', 'Photoshop'] });
		f.detectChanges();
		expect(Array.from(host.querySelectorAll('.skill-tags-row .skill-tag')).map(x => x.textContent?.trim())).toEqual(['Figma', 'Photoshop']);
		expect(host.querySelector('[data-testid="skills-empty"]')).toBeNull();
		c.provider.set({ ...base, skills: [] });
		f.detectChanges();
		expect(host.querySelectorAll('.skill-tags-row .skill-tag').length).toBe(0);
		expect(host.querySelector('[data-testid="skills-empty"]')?.textContent).toContain('لا توجد مهارات');
	});

	it('compare providers: skills render with identical labels; none shows the honest empty row', () => {
		const f = TestBed.createComponent(CompareProvidersComponent);
		const c: any = f.componentInstance;
		const host = f.nativeElement as HTMLElement;
		const card = (id: string, skills: string[]) => ({ id, fullName: id, initials: 'م', levelName: '', headline: '', avatarUrl: null, isVerified: false, aiScore: 0, rating: 0, reviewsCount: 0, completedProjects: 0, responseHours: null, hourlyRate: null, minServicePrice: null, maxServicePrice: null, skills, location: '—' });
		f.detectChanges(); // ngOnInit first, then the test data
		c.loading.set(false);
		c.providers.set([card('a', ['Figma', 'SEO']), card('b', [])]);
		f.detectChanges();
		const rows = Array.from(host.querySelectorAll('.feat-row')).map(x => x.textContent?.trim());
		expect(rows).toContain('Figma');
		expect(rows).toContain('SEO');
		expect(host.querySelectorAll('[data-testid="compare-skills-empty"]').length).toBe(1);
	});
});
