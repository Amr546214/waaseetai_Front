import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { on: vi.fn(), off: vi.fn(), once: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

import { CreateRequest } from './create-request';

// Required skills come from the backend catalog of the chosen field (no local list) and are sent as `requiredSkills`.
describe('create request — required skills from the catalog', () => {
	let component: CreateRequest;
	let fixture: any;
	const gets: string[] = [];
	const posts: any[] = [];

	beforeEach(async () => {
		sessionStorage.clear();
		gets.length = 0;
		posts.length = 0;
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: {
				get: (url: string, opts?: any) => {
					gets.push(`${url}?category=${opts?.params?.category ?? ''}`);
					if (url.endsWith('/skills/catalog')) return of({ success: true, data: { category: opts.params.category, skills: ['Figma', 'Photoshop', 'SEO'] } });
					return of({ success: false });
				},
				post: (url: string, body: any) => { posts.push({ url, body }); return of({ success: true, data: {} }); },
			} }],
		}).compileComponents();
		fixture = TestBed.createComponent(CreateRequest);
		component = fixture.componentInstance;
		await fixture.whenStable();
		(component as any).specialties.set([{ id: 'cat-1', name: 'تصميم', subs: ['شعارات'] }]);
		fixture.detectChanges();
	});
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('choosing the specialty loads the catalog skills of that category through the skills endpoint', () => {
		component.selectSpec('cat-1');
		fixture.detectChanges();
		expect(gets.some(u => u.endsWith('/skills/catalog?category=cat-1'))).toBe(true);
		expect(component.skillOptions()).toEqual(['Figma', 'Photoshop', 'SEO']);
	});

	it('the step-3 picker offers the catalog skills, an unknown skill cannot be added, and the picked ones are sent as requiredSkills', () => {
		component.selectSpec('cat-1');
		component.currentStep.set(3);
		fixture.detectChanges();
		const host = fixture.nativeElement as HTMLElement;
		const opts = Array.from(host.querySelectorAll('[data-testid="skills-options"] .skp-opt')).map(x => x.getAttribute('data-skill'));
		expect(opts).toEqual(['Figma', 'Photoshop', 'SEO']);
		(host.querySelector('[data-skill="Figma"].skp-opt') as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(component.requiredSkills()).toEqual(['Figma']);
		expect(host.querySelector('[data-testid="skills-selected"] .skp-chip')?.getAttribute('data-skill')).toBe('Figma');
	});

	it('changing the specialty clears the previous skills', () => {
		component.selectSpec('cat-1');
		component.setRequiredSkills(['Figma']);
		component.selectSpec('other');
		expect(component.requiredSkills()).toEqual([]);
	});

	it('FINAL POST body: catalog skills only in requiredSkills; free-text extra conditions only inside customConditions (never as skills)', async () => {
		component.selectSpec('cat-1');
		fixture.detectChanges();
		component.setTitle('طلب تصميم شعار');
		component.setDescription('وصف تفصيلي للمشروع المطلوب');
		component.setRequiredSkills(['Figma', 'SEO']);
		component.requirements.set(['توفير شعار قديم', 'ملفات قابلة للتعديل']);
		component.customConditions.set('ملاحظة العميل');
		component.budgetType.set('fixed');
		component.budgetFixed.set(500);
		component.deliveryDays.set(10);
		await component.submitRequest();
		const post = posts.find(p => p.body && 'requiredSkills' in p.body);
		expect(post).toBeTruthy();
		const body = post.body;
		expect(body.requiredSkills).toEqual(['Figma', 'SEO']);
		expect(body.requiredSkills.some((x: string) => x.includes('شعار') || x.includes('ملفات'))).toBe(false);
		expect(body.customConditions).toContain('شروط إضافية: توفير شعار قديم، ملفات قابلة للتعديل');
		expect(body.customConditions).toContain('ملاحظة العميل');
		// every sent skill is a catalog name
		for (const sk of body.requiredSkills) expect(['Figma', 'Photoshop', 'SEO']).toContain(sk);
	});

	it('UI wording: step 3 calls free text «شروط إضافية» (not skills) and the review step separates sub-specialties / skills / extra conditions', () => {
		component.selectSpec('cat-1');
		component.toggleSub('شعارات');
		component.setRequiredSkills(['Figma']);
		component.requirements.set(['نص حر']);
		component.currentStep.set(3);
		fixture.detectChanges();
		const host = fixture.nativeElement as HTMLElement;
		const card = host.querySelector('[data-testid="required-skills-card"]')!;
		expect(card.textContent).toContain('المهارات المطلوبة');
		expect(host.textContent).toContain('شروط إضافية');
		expect(host.textContent).not.toContain('المتطلبات الإلزامية');
		// the free text is never rendered inside the skills picker chips
		expect(Array.from(card.querySelectorAll('.skp-chip')).map(x => x.getAttribute('data-skill'))).toEqual(['Figma']);
		component.currentStep.set(6);
		fixture.detectChanges();
		expect(host.querySelector('[data-testid="review-skills"]')?.textContent?.trim()).toBe('Figma');
		expect(host.querySelector('[data-testid="review-subs"]')?.textContent).toContain('شعارات');
		expect(host.querySelector('[data-testid="review-extra-conditions"]')?.textContent).toContain('نص حر');
		expect(host.querySelector('[data-testid="review-skills"]')?.textContent).not.toContain('نص حر');
	});
});
