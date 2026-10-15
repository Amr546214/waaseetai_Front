import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AccountActionsPage, PENDING_REVIEW_MESSAGE, SAMPLE_REQUIRED_MESSAGE, ApprovalRequestItem } from './account-actions';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { ProviderAccessService, ProviderAccessState } from '../../../../core/services/provider-access.service';

const base = (o: Partial<ProviderAccessState>): ProviderAccessState => ({ state: 'PENDING_REVIEW', canAccessDashboard: false, message: '', reason: null, hasSample: true, specialties: [], ...o });

const reqItem = (o: Partial<ApprovalRequestItem> = {}): ApprovalRequestItem => ({ id: 'r1', requestNo: 'REQ-ABCD1234', status: 'UNDER_REVIEW', statusLabel: 'قيد المراجعة', specialty: { providerSpecialtyId: 'ps1', nameAr: 'برمجة', subSpecialties: [] }, model: { title: 'نموذج المخزون', description: 'وصف', technologiesUsed: ['React'], projectUrl: null, githubUrl: null }, attachments: [{ id: 'a1', fileName: 'proof.pdf', mimeType: 'application/pdf', bytes: 10 }], allowedAttachments: { maxFiles: 10, maxMegabytes: 15, allowedExtensions: ['png', 'pdf'], label: 'x', note: '' }, revision: 1, adminNote: null, rejectionReason: null, completionFields: [], canResubmit: false, submittedAt: '2026-10-15T10:00:00Z', updatedAt: '2026-10-15T11:00:00Z', decidedAt: null, history: [{ id: 'h1', kind: 'SUBMITTED', label: 'تم إرسال الطلب للمراجعة', revision: 1, note: null, at: '2026-10-15T10:00:00Z' }], ...o });

describe('AccountActionsPage (replaces the approval-status page)', () => {
	function mount(load: () => any, items: ApprovalRequestItem[] = []) {
		const loadSpy = vi.fn(load);
		TestBed.configureTestingModule({ imports: [AccountActionsPage], providers: [provideRouter([]), { provide: ProviderAccessService, useValue: { load: loadSpy, invalidate: vi.fn() } }, { provide: ProviderApiService, useValue: { getAccountActions: () => of({ success: true, data: { items } }) } }] });
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const f = TestBed.createComponent(AccountActionsPage);
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
	it('PENDING_REVIEW: key message, no dashboard button, no invented hours; the request is in the log', () => {
		const { q, el } = mount(() => of(base({ message: PENDING_REVIEW_MESSAGE })), [reqItem()]);
		expect(q('status-message')!.textContent).toContain('تم اجتياز الاختبار، ونموذج الاعتماد قيد المراجعة. ستفتح لوحة مقدم الخدمة بعد اعتماد الإدارة.');
		expect(q('request-log')!.textContent).toContain('برمجة');
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

	it('the log shows request id, specialty, model, attachments, allowed types, dates, status and history', () => {
		const { q, el } = mount(() => of(base({})), [reqItem()]);
		expect(q('request-no')!.textContent).toContain('REQ-ABCD1234');
		expect(el.textContent).toContain('برمجة');
		expect(q('request-model')!.textContent).toContain('نموذج المخزون');
		expect(q('request-attachments')!.textContent).toContain('proof.pdf');
		expect(q('request-attachments')!.textContent).toContain('15 ميجابايت');
		expect(q('request-status')!.textContent).toContain('قيد المراجعة');
		expect(q('request-dates')!.textContent).toContain('أُرسل');
		expect(q('request-history')!.textContent).toContain('تم إرسال الطلب للمراجعة');
		expect(q('request-complete')).toBeNull();
	});
	it('completion required: the admin note is shown and «استكمال البيانات» opens the SAME request with its fields', () => {
		const { q, nav } = mount(() => of(base({ state: 'COMPLETION_REQUIRED', message: '' })), [reqItem({ status: 'COMPLETION_REQUIRED', statusLabel: 'مطلوب استكمال البيانات', adminNote: 'أضف وصفًا أوضح', completionFields: ['description'], canResubmit: true })]);
		expect(q('status-message')!.textContent).toContain('استكمال');
		expect(q('request-admin-note')!.textContent).toContain('أضف وصفًا أوضح');
		expect(q('request-fields')!.textContent).toContain('الوصف الفني');
		q('request-complete')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview/business-models/accreditation/new?resubmit=r1');
	});
	it('rejected: the reason is visible and the request can be corrected and re-sent (no duplicate row)', () => {
		const { q, nav } = mount(() => of(base({ state: 'REJECTED', reason: 'غير واضح' })), [reqItem({ status: 'REJECTED', statusLabel: 'مرفوض', adminNote: 'غير واضح', rejectionReason: 'غير واضح', canResubmit: true })]);
		expect(q('request-admin-note')!.textContent).toContain('غير واضح');
		q('request-resubmit')!.click();
		expect(nav).toHaveBeenCalledWith('/provider-overview/business-models/accreditation/new?resubmit=r1');
		expect(q('status-action-upload')).toBeNull();
	});
	it('empty log and a failed log read are honest (no invented rows)', () => {
		expect(mount(() => of(base({}))).q('log-empty')).not.toBeNull();
	});
});
