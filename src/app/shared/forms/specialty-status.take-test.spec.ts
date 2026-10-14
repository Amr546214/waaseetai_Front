import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { SpecialtyStatusComponent } from './specialty-status.component';
import { ProviderAccessService } from '../../core/services/provider-access.service';

// «إجراء الاختبار» used to link to the page it is on (profile/specialties) = a no-op. While the onboarding test is pending it must open the wizard's test step.
function setup(state: string | null, approvalState = 'TEST_NOT_TAKEN') {
	const latest = signal<any>(state ? { state } : null);
	const load = vi.fn(() => of({ state } as any));
	TestBed.configureTestingModule({ imports: [SpecialtyStatusComponent], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: { latest, load } }] });
	const f = TestBed.createComponent(SpecialtyStatusComponent);
	f.componentRef.setInput('registered', [{ specialtyId: 's1', name: 'تصميم', approvalState }]);
	f.detectChanges();
	return { f, load, el: f.nativeElement as HTMLElement };
}

describe('specialty status «إجراء الاختبار»', () => {
	it('ASSESSMENT_REQUIRED: opens the setup wizard (test step), not the page it is on', () => {
		const { el } = setup('ASSESSMENT_REQUIRED');
		const a = el.querySelector('[data-testid="take-test-cta"]') as HTMLAnchorElement;
		expect(a.textContent).toContain('إجراء الاختبار');
		expect(a.getAttribute('href')).toBe('/provider-overview/profile/setup');
	});
	it('SETUP_INCOMPLETE: also the wizard', () => {
		expect((setup('SETUP_INCOMPLETE').el.querySelector('[data-testid="take-test-cta"]') as HTMLAnchorElement).getAttribute('href')).toBe('/provider-overview/profile/setup');
	});
	it('other states keep the normal link', () => {
		const a = setup('PENDING_REVIEW').el.querySelector('[data-testid="take-test-cta"]') as HTMLAnchorElement;
		expect(a.getAttribute('href')).toBe('/provider-overview/profile/specialties');
	});
	it('unknown state reads the backend once and keeps the normal link meanwhile', () => {
		const unknown = setup(null);
		expect(unknown.load).toHaveBeenCalledTimes(1);
		expect((unknown.el.querySelector('[data-testid="take-test-cta"]') as HTMLAnchorElement).getAttribute('href')).toBe('/provider-overview/profile/specialties');
	});
	it('rows that are not «test not taken» are untouched (no wizard link)', () => {
		const { el } = setup('ASSESSMENT_REQUIRED', 'PASSED_NO_SAMPLES');
		expect(el.querySelector('[data-testid="take-test-cta"]')).toBeNull();
		expect((el.querySelector('.wss-cta') as HTMLAnchorElement).getAttribute('href')).toBe('/provider-overview/business-models/accreditation/new');
	});
});
