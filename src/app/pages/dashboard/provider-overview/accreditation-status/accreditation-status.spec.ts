import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccreditationStatusPage, PENDING_REVIEW_MESSAGE, SAMPLE_REQUIRED_MESSAGE } from './accreditation-status';
import { ProviderAccessService, ProviderAccessState } from '../../../../core/services/provider-access.service';

const base = (o: Partial<ProviderAccessState>): ProviderAccessState => ({ state: 'PENDING_REVIEW', canAccessDashboard: false, message: '', reason: null, hasSample: true, specialties: [], ...o });

describe('AccreditationStatusPage', () => {
	function mount(load: () => any) {
		const loadSpy = vi.fn(load);
		TestBed.configureTestingModule({ imports: [AccreditationStatusPage], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: { load: loadSpy, invalidate: vi.fn() } }] });
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const f = TestBed.createComponent(AccreditationStatusPage);
		f.detectChanges();
		const el = f.nativeElement as HTMLElement;
		return { f, el, loadSpy, nav, q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('SETUP_INCOMPLETE: backend message + button to the wizard', () => {
		const { q, nav } = mount(() => of(base({ state: 'SETUP_INCOMPLETE', message: 'أكمل بياناتك' })));
		expect(q('status-message')!.textContent).toContain('أكمل بياناتك');
		q('status-action-setup')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview/profile/setup');
		expect(q('status-action-setup')!.textContent).toContain('إكمال بيانات الحساب');
	});
	it('ASSESSMENT_REQUIRED: message + button to the wizard', () => {
		const { q, nav } = mount(() => of(base({ state: 'ASSESSMENT_REQUIRED', hasSample: false, message: 'أكمل الاختبار لإكمال اعتماد حسابك.' })));
		expect(q('status-message')!.textContent).toContain('أكمل الاختبار لإكمال اعتماد حسابك.');
		q('status-action-setup')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview/profile/setup');
	});
	it('SAMPLE_REQUIRED: key message + upload button', () => {
		const { q, nav } = mount(() => of(base({ state: 'SAMPLE_REQUIRED', hasSample: false, message: SAMPLE_REQUIRED_MESSAGE })));
		expect(q('status-message')!.textContent).toContain('اجتزت الاختبار، لكن يجب رفع نموذج الاعتماد لإكمال المراجعة.');
		q('status-action-upload')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview/business-models/accreditation/new');
	});
	it('PENDING_REVIEW: key message + submitted specialties with their sample status, no dashboard button', () => {
		const { q, el } = mount(() => of(base({ message: PENDING_REVIEW_MESSAGE, specialties: [{ providerSpecialtyId: 'a', specialtyId: 's', nameAr: 'برمجة', status: 'PENDING', isPassed: true, sample: { id: 'x', status: 'MANUAL_REVIEW', rejectionReason: null, submittedAt: '2026-10-14' } }] })));
		expect(q('status-message')!.textContent).toContain('تم اجتياز الاختبار، ونموذج الاعتماد قيد المراجعة. ستفتح لوحة مقدم الخدمة بعد اعتماد الإدارة.');
		expect(q('status-specialties')!.textContent).toContain('برمجة');
		expect(q('status-specialties')!.textContent).toContain('قيد المراجعة اليدوية');
		expect(q('status-action-dashboard')).toBeNull();
		expect(el.textContent).not.toMatch(/ساعة|ساعات|خلال \d/);
	});
	it('PENDING_REVIEW falls back to the agreed wording when the backend sends no message', () => {
		expect(mount(() => of(base({ message: '' }))).q('status-message')!.textContent).toContain(PENDING_REVIEW_MESSAGE);
	});
	it('REJECTED: backend reason + re-upload button', () => {
		const { q } = mount(() => of(base({ state: 'REJECTED', message: 'تم رفض النموذج', reason: 'النموذج غير واضح' })));
		expect(q('status-reason')!.textContent).toContain('النموذج غير واضح');
		expect(q('status-action-upload')).not.toBeNull();
	});
	it('APPROVED: button opens the dashboard', () => {
		const { q, nav } = mount(() => of(base({ state: 'APPROVED', canAccessDashboard: true, message: 'تم اعتماد حسابك' })));
		q('status-action-dashboard')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview');
	});
	it('error: honest message + retry re-reads the state', () => {
		let fail = true;
		const { q, f, loadSpy } = mount(() => (fail ? throwError(() => new Error('500')) : of(base({}))));
		expect(q('status-error')!.textContent).toContain('تعذّر التحقق');
		fail = false;
		q('status-retry')!.click();
		f.detectChanges();
		expect(loadSpy).toHaveBeenCalledTimes(2);
		expect(q('status-error')).toBeNull();
		expect(q('status-message')).not.toBeNull();
	});
	it('refresh button re-reads the state', () => {
		const { q, loadSpy } = mount(() => of(base({})));
		q('status-refresh')!.click();
		expect(loadSpy).toHaveBeenCalledTimes(2);
	});
});
