import { TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NewProject } from './new-project';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';

// Failed loads are not empty states, a failed / lost publish is explained beside the action, and a lost answer is never followed by a blind second create.
describe('provider new service wizard: load failures, publish outcomes, requirement links', () => {
	let svc: any; let api: any;
	function mount(opts: { edit?: string } = {}) {
		localStorage.clear();
		svc = {
			initSocket: vi.fn(), onStreamStart: vi.fn(), onStreamChunk: vi.fn(), onStreamEnd: vi.fn(), disconnectSocket: vi.fn(),
			publishService: vi.fn(() => of({ success: true })), updateService: vi.fn(() => of({ success: true })),
			getMyMarketModels: vi.fn(() => of({ success: true, data: { models: [] } })), getServiceById: vi.fn(() => of({ data: {} })),
		};
		api = { getPassedSpecialties: vi.fn(() => of({ success: true, categories: [], registered: [] })), getAccreditationSamples: vi.fn(() => of({ success: true, samples: [] })) };
		TestBed.configureTestingModule({
			imports: [NewProject],
			providers: [
				provideRouter([]),
				{ provide: NewProjectService, useValue: svc }, { provide: ProviderApiService, useValue: api },
				{ provide: SkillsCatalogService, useValue: { getCatalog: () => of({ success: true, data: { skills: [] } }), getProviderMine: () => of({ success: true, data: { skills: [], specialties: [] } }) } },
				{ provide: ActivatedRoute, useValue: { queryParams: of(opts.edit ? { edit: opts.edit } : {}), snapshot: { queryParamMap: convertToParamMap(opts.edit ? { edit: opts.edit } : {}), paramMap: convertToParamMap({}) } } },
			],
		});
		const f = TestBed.createComponent(NewProject);
		f.detectChanges();
		return { f, c: f.componentInstance as any, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

	it('edit mode: if the service cannot be loaded the wizard is BLOCKED with a retry (an empty form must never be saved over the real service)', () => {
		const t = mount({ edit: 'svc-1' });
		svc.getServiceById.mockReturnValue(throwError(() => ({ status: 503, error: { message: 'x' } })));
		t.c.loadExistingService('svc-1'); t.f.detectChanges();
		expect(t.el.querySelector('[data-testid="load-error"]')).not.toBeNull();
		t.c.projectName.set('اسم'); t.c.projectDesc.set('وصف طويل كفاية للمتابعة في المعالج');
		void t.c.goNext();
		expect(svc.updateService).not.toHaveBeenCalled();
		expect(t.c.currentStep()).toBe(1);
	});

	it('specialties load failure: step 2 says the load failed (not «no accredited specialties») and retries', () => {
		const t = mount();
		api.getPassedSpecialties.mockReturnValue(throwError(() => ({ status: 503, error: { message: 'x' } })));
		t.c.loadPassedSpecialties(); t.c.currentStep.set(2); t.f.detectChanges();
		expect(t.c.specialtiesLoadError()).not.toBe('');
		expect(t.el.querySelector('[data-testid="load-error"]')).not.toBeNull();
		api.getPassedSpecialties.mockReturnValue(of({ success: true, categories: [], registered: [] }));
		(t.el.querySelector('[data-testid="load-error-retry"]') as HTMLButtonElement).click(); t.f.detectChanges();
		expect(t.c.specialtiesLoadError()).toBe('');
	});

	const publishable = (t: any) => { t.c.currentStep.set(5); t.c.projectName.set('خدمة'); t.c.projectDesc.set('وصف'); t.c.selectedSpecialty.set('sp'); t.c.selectedModel.set('as'); };
	const flush = () => new Promise<void>(r => setTimeout(r, 0));

	it('a lost publish answer marks the outcome UNCERTAIN beside the button; pressing publish again lists the services created since and creates nothing', async () => {
		const t = mount(); publishable(t);
		svc.publishService.mockReturnValue(throwError(() => ({ status: 0, error: null })));
		(t.c as any).submitProject(); await flush(); t.f.detectChanges();
		expect(svc.publishService).toHaveBeenCalledTimes(1);
		expect(t.c.uncertainSince()).not.toBeNull();
		expect(t.el.querySelector('[data-testid="publish-error"]')!.textContent).toContain('نتيجة النشر غير مؤكدة');
		svc.getMyMarketModels.mockReturnValue(of({ success: true, data: { models: [{ id: 'new-1', title: 'خدمتي', status: 'PUBLISHED', createdAt: new Date().toISOString() }, { id: 'old', title: 'قديمة', status: 'PUBLISHED', createdAt: '2020-01-01T00:00:00Z' }] } }));
		t.c.projectName.set('اسم معدّل بعد ضياع الرد'); // content changed: the gate is not tied to identical content
		(t.c as any).submitProject(); await flush(); t.f.detectChanges();
		expect(svc.publishService).toHaveBeenCalledTimes(1);
		expect(t.c.publishCandidates().map((x: any) => x.id)).toEqual(['new-1']);
		expect(t.el.querySelector('[data-testid="publish-candidates"]')).not.toBeNull();
	});

	it('nothing created since: the lost publish never arrived, so the next press publishes; the explicit «انشر خدمة جديدة» choice also publishes', async () => {
		const t = mount(); publishable(t);
		svc.publishService.mockReturnValue(throwError(() => ({ status: 0, error: null })));
		(t.c as any).submitProject(); await flush();
		svc.publishService.mockReturnValue(of({ success: true }));
		(t.c as any).submitProject(); await flush();
		expect(svc.publishService).toHaveBeenCalledTimes(2);
		expect(t.c.uncertainSince()).toBeNull();
		// explicit choice
		TestBed.resetTestingModule();
		const u = mount(); publishable(u);
		u.c.setUncertain(Date.now() - 3600_000);
		svc.getMyMarketModels.mockReturnValue(of({ success: true, data: { models: [{ id: 'x', title: 't', status: 'PUBLISHED', createdAt: new Date().toISOString() }] } }));
		(u.c as any).submitProject(); await flush();
		expect(svc.publishService).not.toHaveBeenCalled();
		u.c.publishAnyway(); await flush();
		expect(svc.publishService).toHaveBeenCalledTimes(1);
	});

	it('the check itself fails: nothing is created and the reason is shown beside the button', async () => {
		const t = mount(); publishable(t);
		t.c.setUncertain(Date.now());
		svc.getMyMarketModels.mockReturnValue(throwError(() => ({ status: 0 })));
		(t.c as any).submitProject(); await flush(); t.f.detectChanges();
		expect(svc.publishService).not.toHaveBeenCalled();
		expect(t.c.publishError()).toContain('فلن ننشئ خدمة جديدة');
	});

	it('a server refusal with a requirement (specialty not approved) shows the reason under the field and the correct link to complete it', async () => {
		const t = mount(); publishable(t);
		svc.publishService.mockReturnValue(throwError(() => ({ status: 403, error: { success: false, code: 'SPECIALTY_NOT_APPROVED', message: 'تخصص «X» قيد المراجعة؛ يمكنك النشر فيه بعد اعتماده', errors: [{ field: 'specialtyId', path: 'specialtyId', message: 'تخصص «X» قيد المراجعة؛ يمكنك النشر فيه بعد اعتماده', code: 'SPECIALTY_NOT_APPROVED' }] } })));
		(t.c as any).submitProject(); await flush(); t.f.detectChanges();
		expect(t.c.currentStep()).toBe(2);
		expect(t.c.specialtyError()).toContain('قيد المراجعة');
		expect(t.el.querySelector('[data-testid="requirement-link"]')!.getAttribute('href')).toContain('/provider-overview/business-models/accreditation/list');
	});

	it('server 5xx: the reason is beside the publish button (not only a toast) and the outcome is uncertain', async () => {
		const t = mount(); publishable(t);
		svc.publishService.mockReturnValue(throwError(() => ({ status: 500, error: { success: false, code: 'INTERNAL_ERROR', traceId: 'ab12cd34', message: 'حدث خطأ غير متوقع من جهتنا. رمز المتابعة: ab12cd34' } })));
		(t.c as any).submitProject(); await flush(); t.f.detectChanges();
		expect(t.el.querySelector('[data-testid="publish-error"]')).not.toBeNull();
	});
});
