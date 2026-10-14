import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { SkillsCatalogService } from './skills-catalog.service';
import { environment } from '../../../environments/environment';

describe('SkillsCatalogService', () => {
	let svc: SkillsCatalogService;
	let http: HttpTestingController;
	const base = `${environment.url_api}/skills`;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
		svc = TestBed.inject(SkillsCatalogService);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it('reads GET /skills/catalog?category= and caches per category (one request for two subscribers)', () => {
		const got: string[][] = [];
		svc.getCatalog('design').subscribe(r => got.push(r.data.skills));
		const req = http.expectOne(r => r.url === `${base}/catalog` && r.params.get('category') === 'design');
		req.flush({ success: true, data: { category: 'design', skills: ['Figma', 'Photoshop'] } });
		svc.getCatalog('design').subscribe(r => got.push(r.data.skills));
		http.expectNone(`${base}/catalog`);
		expect(got).toEqual([['Figma', 'Photoshop'], ['Figma', 'Photoshop']]);
	});

	it('a different category is a different request', () => {
		svc.getCatalog('a').subscribe();
		svc.getCatalog('b').subscribe();
		http.expectOne(r => r.params.get('category') === 'a').flush({ success: true, data: { category: 'a', skills: [] } });
		http.expectOne(r => r.params.get('category') === 'b').flush({ success: true, data: { category: 'b', skills: [] } });
	});

	it('a failed read is not cached: the next call asks the server again', () => {
		svc.getCatalog('x').subscribe({ error: () => undefined });
		http.expectOne(r => r.params.get('category') === 'x').flush('boom', { status: 500, statusText: 'err' });
		svc.getCatalog('x').subscribe();
		http.expectOne(r => r.params.get('category') === 'x').flush({ success: true, data: { category: 'x', skills: ['s'] } });
	});

	it('getAll reads /skills/catalog/all once (cached)', () => {
		svc.getAll().subscribe();
		svc.getAll().subscribe();
		http.expectOne(`${base}/catalog/all`).flush({ success: true, data: { categories: [{ slug: 'a', nameAr: 'أ', skills: ['s'] }] } });
	});

	it('getProviderMine reads /skills/provider-mine every time (the provider can change it)', () => {
		svc.getProviderMine().subscribe();
		http.expectOne(`${base}/provider-mine`).flush({ success: true, data: { skills: [], mainSpecialty: null, subSpecialties: [], specialties: [] } });
		svc.getProviderMine().subscribe();
		http.expectOne(`${base}/provider-mine`).flush({ success: true, data: { skills: [], mainSpecialty: null, subSpecialties: [], specialties: [] } });
	});
});
