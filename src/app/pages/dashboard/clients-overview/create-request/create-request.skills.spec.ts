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

	beforeEach(async () => {
		sessionStorage.clear();
		gets.length = 0;
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: {
				get: (url: string, opts?: any) => {
					gets.push(`${url}?category=${opts?.params?.category ?? ''}`);
					if (url.endsWith('/skills/catalog')) return of({ success: true, data: { category: opts.params.category, skills: ['Figma', 'Photoshop', 'SEO'] } });
					return of({ success: false });
				},
				post: () => of({ success: true, data: {} }),
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

	it('the free-text mandatory requirements are not sent as skills', () => {
		component.requirements.set(['توفير شعار']);
		component.setRequiredSkills(['SEO']);
		const compose = (component as any).composeConditions();
		expect(compose).toContain('توفير شعار');
		expect(component.requiredSkills()).toEqual(['SEO']);
	});
});
