import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { New } from './new';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';
import { ProviderAccessService } from '../../../../../../core/services/provider-access.service';

// A refusal because of a missing requirement carries the correct link; a lost answer keeps its state and the next send first looks at the requests that exist.
describe('accreditation request form: requirement links and uncertain outcome', () => {
	let submit: any; let samples: any;
	function mount() {
		localStorage.clear();
		submit = vi.fn(() => of({ success: true, data: { sample: { id: 's9' } } }));
		samples = vi.fn(() => of({ success: true, samples: [] }));
		const api = {
			getPassedSpecialties: () => of({ success: true, categories: [{ categoryId: 'c', categoryName: 'ت', specialties: [{ id: 'ps1', specialtyId: 's1', name: 'برمجة', subSpecialties: [] }] }], registered: [] }),
			submitAccreditationRequest: submit, getAccreditationSamples: samples,
			getAccountActionCompletion: vi.fn(() => of({})), deleteAccreditationProof: vi.fn(() => of({})),
		};
		TestBed.configureTestingModule({ imports: [New], providers: [provideRouter([]), { provide: ProviderApiService, useValue: api }, { provide: ProviderAccessService, useValue: { invalidate: vi.fn(), load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false }) } }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }] });
		vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const f = TestBed.createComponent(New); f.detectChanges();
		const c = f.componentInstance as any;
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2);
		c.title.set('نظام المخزون'); c.description.set('وصف تقني كامل للنموذج'); c.technologiesUsed.set(['React']);
		c.attachments.set([{ id: 'a', name: 'p.pdf', size: '1 MB', url: 'blob:x', type: 'application/pdf', file: new File(['x'], 'p.pdf') }]);
		return { f, c, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });
	const fail = (status: number, body: any) => throwError(() => new HttpErrorResponse({ status, error: body }));

	it('the specialty test was not passed: the reason AND the link to the specialties page', () => {
		const t = mount();
		submit.mockReturnValue(fail(403, { success: false, code: 'SPECIALTY_TEST_NOT_PASSED', message: 'يجب اجتياز الاختبار الفني لهذا التخصص قبل رفع نموذج الاعتماد؛ أكمل الاختبار من صفحة التخصصات.' }));
		t.c.goNext(); t.f.detectChanges();
		expect(t.el.querySelector('[data-testid="submit-error-link"]')!.getAttribute('href')).toContain('/provider-overview/profile/specialties');
		expect(t.c.hasError()).toContain('اجتياز الاختبار');
		expect(t.c.title()).toBe('نظام المخزون');
		expect(t.c.attachments().length).toBe(1);
	});

	it('409 «a request is already under review»: link to the requests list', () => {
		const t = mount();
		submit.mockReturnValue(fail(409, { success: false, message: 'لديك طلب اعتماد قيد المراجعة لهذا التخصص؛ تابعه من «إجراءات الحساب»' }));
		t.c.goNext(); t.f.detectChanges();
		expect(t.el.querySelector('[data-testid="submit-error-link"]')!.getAttribute('href')).toContain('/business-models/accreditation/list');
	});

	it('lost answer: the outcome is UNCERTAIN (also stored); sending again with an open request of the specialty reports it as arrived and posts NOTHING', () => {
		const t = mount();
		submit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
		t.c.goNext(); t.f.detectChanges();
		expect(t.c.hasError()).toContain('نتيجة الإرسال غير مؤكدة');
		expect(localStorage.getItem('ws:accreditation-submit-uncertain:v1')).toBeTruthy();
		samples.mockReturnValue(of({ success: true, samples: [{ id: 'sm1', status: 'MANUAL_REVIEW', providerSpecialty: { id: 'ps1' } }] }));
		t.c.title.set('عنوان معدّل بعد ضياع الرد'); // edited content: the check does not depend on it
		t.c.submitForAiEvaluation(); t.f.detectChanges();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(t.c.manualReviewNotice()).toContain('وصل طلبك سابقًا');
		expect(t.c.uncertainSince()).toBeNull();
	});

	it('lost answer, nothing open for the specialty: the send never arrived, the next press posts', () => {
		const t = mount();
		submit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
		t.c.goNext();
		submit.mockReturnValue(of({ success: true, data: { sample: { id: 's9' } } }));
		t.c.submitForAiEvaluation();
		expect(submit).toHaveBeenCalledTimes(2);
	});

	it('the check itself fails: nothing is posted and the user is sent to «طلبات الاعتماد»', () => {
		const t = mount();
		submit.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
		t.c.goNext();
		samples.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
		t.c.submitForAiEvaluation(); t.f.detectChanges();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(t.c.hasError()).toContain('فلن نرسل طلبًا جديدًا');
		expect(t.c.errorLink()!.url.join('/')).toContain('accreditation/list');
	});
});
