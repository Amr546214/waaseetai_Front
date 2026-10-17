import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { New } from './new';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';
import { ProviderAccessService } from '../../../../../../core/services/provider-access.service';

// Batch B T1 (§3, §4): proof files are mandatory, server field errors reach the field, «استكمال البيانات» re-opens the SAME request with its data.
describe('accreditation request form: proof files, field errors, completion', () => {
	function mount(opts: { resubmit?: string; submit?: () => any; completion?: any } = {}) {
		const submitAccreditationRequest = vi.fn(opts.submit ?? (() => of({ success: true, data: { sample: { id: 's9' } } })));
		const api = {
			getPassedSpecialties: () => of({ success: true, categories: [{ categoryId: 'c', categoryName: 'ت', specialties: [{ id: 'ps1', specialtyId: 's1', name: 'برمجة', subSpecialties: [] }] }], registered: [] }),
			submitAccreditationRequest,
			getAccountActionCompletion: vi.fn(() => of({ data: opts.completion })),
			deleteAccreditationProof: vi.fn(() => of({ success: true })),
		};
		TestBed.configureTestingModule({
			imports: [New],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: api },
				{ provide: ProviderAccessService, useValue: { invalidate: vi.fn(), load: () => of({ state: 'PENDING_REVIEW', canAccessDashboard: false }) } },
				{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(opts.resubmit ? { resubmit: opts.resubmit } : {}) } } },
			],
		});
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const f = TestBed.createComponent(New);
		f.detectChanges();
		return { f, c: f.componentInstance as any, api, nav, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());
	const fill = (c: any) => { c.title.set('نظام المخزون'); c.description.set('وصف تقني كامل للنموذج'); c.technologiesUsed.set(['React']); };

	it('a link alone is not enough: no file = step invalid, the missing file is named at the field and nothing is sent', () => {
		const { f, c, api, el } = mount();
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2); fill(c); c.projectUrl.set('https://example.com');
		f.detectChanges();
		expect(c.isValidStep2).toBe(false);
		c.goNext(); f.detectChanges();
		expect(api.submitAccreditationRequest).not.toHaveBeenCalled();
		const err = el.querySelector('[data-testid="err-files"]') as HTMLElement;
		expect(err.getAttribute('role')).toBe('alert');
		expect(err.textContent).toContain('ملف إثبات');
		expect(el.querySelector('#proof-upload')!.getAttribute('aria-invalid')).toBe('true');
		expect(el.querySelector('[data-testid="proof-requirements"]')!.textContent).toContain('15 ميجابايت');
	});

	it('invalid title/description: each message sits next to its field with aria-invalid, and the first invalid field gets focus', async () => {
		const { f, c, el } = mount();
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2); f.detectChanges();
		c.goNext(); f.detectChanges();
		const title = el.querySelector('#acc-title') as HTMLInputElement;
		expect(title.getAttribute('aria-invalid')).toBe('true');
		expect(title.getAttribute('aria-describedby')).toBe('acc-title-err');
		expect(el.querySelector('#acc-title-err')!.getAttribute('role')).toBe('alert');
		expect(el.querySelector('#acc-description')!.getAttribute('aria-invalid')).toBe('true');
		await new Promise(r => setTimeout(r, 5));
	});

	it('a server field error (files) comes back to the form: step 2, message at the field, everything entered is kept', () => {
		const body = { success: false, message: 'ارفع ملف إثبات', errors: [{ path: 'files', field: 'files', message: 'ارفع ملف إثبات واحدًا على الأقل' }] };
		const { f, c, el } = mount({ submit: () => throwError(() => new HttpErrorResponse({ status: 400, error: body })) });
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2); fill(c); c.attachments.set([{ id: 'a', name: 'p.pdf', size: '1 MB', url: 'blob:x', type: 'application/pdf', file: new File(['x'], 'p.pdf') }]);
		c.goNext(); f.detectChanges();
		expect(c.currentStep()).toBe(2);
		expect(el.querySelector('[data-testid="err-files"]')!.textContent).toContain('ارفع ملف إثبات واحدًا على الأقل');
		expect(c.title()).toBe('نظام المخزون');
		expect(c.attachments().length).toBe(1);
		expect(c.isAnalyzing()).toBe(false);
	});

	it('a 409 (a request is already under review) stays a generic honest message, not an invented field error', () => {
		const { f, c } = mount({ submit: () => throwError(() => new HttpErrorResponse({ status: 409, error: { success: false, message: 'لديك طلب اعتماد قيد المراجعة لهذا التخصص' } })) });
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2); fill(c); c.attachments.set([{ id: 'a', name: 'p.pdf', size: '1', url: 'blob:x', type: 'application/pdf', file: new File(['x'], 'p.pdf') }]);
		c.goNext(); f.detectChanges();
		expect(Object.keys(c.fieldErrors())).toEqual([]);
		expect(c.hasError()).toContain('قيد المراجعة');
	});

	it('a double click sends ONE request, and success goes to the REAL log of the new request', () => {
		const { c, api, nav } = mount();
		c.selectedSpecialtyId.set('ps1'); c.currentStep.set(2); fill(c); c.attachments.set([{ id: 'a', name: 'p.pdf', size: '1', url: 'blob:x', type: 'application/pdf', file: new File(['x'], 'p.pdf') }]);
		api.submitAccreditationRequest.mockImplementation(() => { c.submitForAiEvaluation(); return of({ success: true, data: { sample: { id: 's9' } } }); });
		c.goNext();
		expect(api.submitAccreditationRequest).toHaveBeenCalledTimes(1);
		expect(nav).toHaveBeenCalledWith('/provider-overview/account-actions/s9');
	});

	it('«استكمال البيانات»: opens the same request with its previous data, documents kept, the fields to fix highlighted, and re-sends with resubmitSampleId + proofIds', () => {
		const completion = { id: 'r1', specialty: { providerSpecialtyId: 'ps1', nameAr: 'برمجة' }, model: { title: 'نموذج قديم', description: 'وصف قديم طويل', technologiesUsed: ['Vue'], projectUrl: 'https://old.example', githubUrl: null }, attachments: [{ id: 'up1', fileName: 'old.pdf', bytes: 5 }], completionFields: ['description'], adminNote: 'وضّح الوصف' };
		const { f, c, el, api } = mount({ resubmit: 'r1', completion });
		expect(c.currentStep()).toBe(2);
		expect([c.title(), c.description(), c.technologiesUsed(), c.projectUrl()]).toEqual(['نموذج قديم', 'وصف قديم طويل', ['Vue'], 'https://old.example']);
		expect(el.querySelector('[data-testid="admin-note"]')!.textContent).toContain('وضّح الوصف');
		expect(el.querySelector('[data-testid="existing-proofs"]')!.textContent).toContain('old.pdf');
		expect((el.querySelector('#acc-description') as HTMLElement).style.borderColor).not.toBe('');
		expect(c.isValidStep2).toBe(true); // the kept document counts, no re-upload needed
		c.description.set('وصف جديد أوضح بكثير'); f.detectChanges();
		c.goNext();
		const fd = (api.submitAccreditationRequest.mock.calls[0] as unknown as [FormData])[0];
		expect(fd.get('resubmitSampleId')).toBe('r1');
		expect(JSON.parse(String(fd.get('proofIds')))).toEqual(['up1']);
	});

	it('deleting the only required document restores the missing state', () => {
		const completion = { id: 'r1', specialty: { providerSpecialtyId: 'ps1', nameAr: 'برمجة' }, model: { title: 'ن', description: 'وصف قديم طويل', technologiesUsed: ['Vue'] }, attachments: [{ id: 'up1', fileName: 'old.pdf', bytes: 5 }], completionFields: [] };
		const { c, api } = mount({ resubmit: 'r1', completion });
		c.removeExistingProof('up1');
		expect(api.deleteAccreditationProof).toHaveBeenCalledWith('up1');
		expect(c.existingProofs().length).toBe(0);
		expect(c.isValidStep2).toBe(false);
	});

	it('a request that cannot be completed (409) shows the honest reason, not a blank form', () => {
		TestBed.resetTestingModule();
		TestBed.configureTestingModule({ imports: [New], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getAccountActionCompletion: () => throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'لا يمكن استكمال هذا الطلب في حالته الحالية' } })) } }, { provide: ProviderAccessService, useValue: { invalidate: vi.fn(), load: () => of({}) } }, { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ resubmit: 'r1' }) } } }] });
		const f = TestBed.createComponent(New); f.detectChanges();
		expect((f.nativeElement as HTMLElement).querySelector('[data-testid="load-error"]')!.textContent).toContain('لا يمكن استكمال');
	});
});
