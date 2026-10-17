import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NewProject } from './new-project';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';
import { expectFieldProblem, expectFocused, expectNoFieldProblem, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

const CATEGORIES = [{ categoryId: 'c1', categoryName: 'التصميم', specialties: [{ id: 'ps1', specialtyId: 's1', name: 'هوية', icon: '', score: 90, subSpecialties: [] }] }];

describe('NewProject wizard: validation wiring + no ready-made numbers', () => {
	let fixture: ComponentFixture<NewProject>;
	let c: any;
	let np: any;
	const root = () => fixture.nativeElement as HTMLElement;
	const q = <T extends HTMLElement = HTMLElement>(sel: string) => root().querySelector(sel) as T | null;
	const nextBtn = () => Array.from(root().querySelectorAll('button')).find(b => /التالي|نشر وإطلاق/.test(b.textContent ?? '')) as HTMLButtonElement;

	const setup = (service?: any) => {
		np = {
			initSocket: vi.fn(), onStreamStart: vi.fn(), onStreamChunk: vi.fn(), onStreamEnd: vi.fn(), disconnectSocket: vi.fn(),
			getServiceById: vi.fn(() => of({ data: service })),
			publishService: vi.fn(() => of({ success: true })),
			updateService: vi.fn(() => of({ success: true })),
			analyzeProjectModel: vi.fn(() => of({ success: false })),
		};
		TestBed.configureTestingModule({
			imports: [NewProject],
			providers: [
				provideRouter([]),
				{ provide: NewProjectService, useValue: np },
				{ provide: ProviderApiService, useValue: {
					getPassedSpecialties: () => of({ success: true, categories: CATEGORIES, registered: [] }),
					getAccreditationSamples: () => of({ success: true, samples: [] }),
				} },
				{ provide: SkillsCatalogService, useValue: {
					getCatalog: () => of({ success: true, data: { skills: [] } }),
					getProviderMine: () => of({ success: true, data: { skills: [] } }),
				} },
			],
		});
		fixture = TestBed.createComponent(NewProject);
		c = fixture.componentInstance;
		fixture.detectChanges();
	};
	const go = async (step: number) => { c.currentStep.set(step); fixture.detectChanges(); await fixture.whenStable(); };
	const click = async () => { nextBtn().click(); await settleForm(); fixture.detectChanges(); };
	const fillValid = () => {
		c.projectName.set('تصميم هوية'); c.projectDesc.set('وصف');
		c.selectedSpecialty.set('ps1');
		c.accreditationModels.set([{ id: 'm1', specialtyId: 's1', title: 't', status: 'APPROVED', score: 1 }]);
		c.selectedModel.set('m1');
		c.totalAmount.set(1000);
		c.stages.set([{ title: 'أ', desc: '', days: 3, percentage: 100 }]);
	};

	it('step 1: invalid next marks name + description and focuses the first one', async () => {
		setup();
		expect(nextBtn().disabled).toBe(false);
		await click();
		expectFocused(q('#np-name'));
		expectFieldProblem(q('#np-name'), /اسم المشروع/);
		expectFieldProblem(q('#np-desc'), /وصف/);
		expect(c.currentStep()).toBe(1);
	});

	it('step 2 and 3: missing specialty / model are explained at the picker, not only in a toast', async () => {
		setup();
		c.projectName.set('س'); c.projectDesc.set('ص');
		await go(2);
		await click();
		expectFocused(q('#np-specialty'));
		expectFieldProblem(q('#np-specialty'), /تخصصاً رئيسياً/);
		c.selectedSpecialty.set('ps1');
		await go(3);
		await click();
		expectFieldProblem(q('#np-model'), /نموذجاً/);
	});

	it('numeric defaults: budget, days and added-stage numbers start empty (no 4500, no 5, no 0)', async () => {
		setup();
		expect(c.totalAmount()).toBeNull();
		expect(c.stages()[0].days).toBeNull();
		c.addStage();
		expect(c.stages()[1].days).toBeNull();
		expect(c.stages()[1].percentage).toBeNull();
		await go(4);
		const amount = q<HTMLInputElement>('#np-total-amount')!;
		expect(amount.value).toBe('');
		expect(amount.placeholder).not.toMatch(/\d/);
		expect(q<HTMLInputElement>('#np-stage-days-0')!.value).toBe('');
	});

	it('step 4: empty budget / days block with field messages; 0 is not accepted as a value', async () => {
		setup();
		c.stages.set([{ title: '', desc: '', days: null, percentage: 100 }]);
		await go(4);
		await click();
		expectFocused(q('#np-total-amount'));
		expectFieldProblem(q('#np-total-amount'), /الميزانية/);
		expectFieldProblem(q('#np-stage-title-0'), /عنوان/);
		expectFieldProblem(q('#np-stage-days-0'), /مدة/);
		c.totalAmount.set(0);
		expect(c.isValidStep4()).toBe(false);
	});

	it('edit mode restores the saved budget and stage numbers', async () => {
		setup({ title: 'x', description: 'y', totalAmount: 2500, stages: [{ title: 'م', percentage: 100, deliveryDays: 7 }] });
		c.loadExistingService('svc');
		expect(c.totalAmount()).toBe(2500);
		expect(c.stages()[0].days).toBe(7);
	});

	it('publish 422 on a field opens the closed step 1 and marks the name', async () => {
		setup();
		fillValid();
		fixture.autoDetectChanges(true); // the step switches while the helper waits for it to render
		np.publishService.mockReturnValue(throwError(() => httpFail(422, { errors: [{ path: ['title'], message: 'اسم المشروع غير واضح' }] })));
		await go(5);
		await click();
		await settleForm(); fixture.detectChanges();
		expect(c.currentStep()).toBe(1);
		expectFocused(q('#np-name'));
		expectFieldProblem(q('#np-name'), 'اسم المشروع غير واضح');
	});

	it('publish 429 / network stay generic, never marked on a field', async () => {
		setup();
		fillValid();
		for (const status of [429, 0, 503]) {
			np.publishService.mockReturnValue(throwError(() => httpFail(status, { message: 'Too many requests' })));
			await go(5);
			await click();
			await settleForm(); fixture.detectChanges();
			expectNoFieldProblem(root());
			expect(c.currentStep()).toBe(5);
		}
	});

	it('double click on publish sends ONE request', async () => {
		setup();
		fillValid();
		const pending = new Subject<any>();
		np.publishService.mockReturnValue(pending);
		await go(5);
		nextBtn().click();
		await c.goNext();
		await c.goNext();
		expect(np.publishService).toHaveBeenCalledTimes(1);
		expect(c.isSubmitting()).toBe(true);
		fixture.detectChanges();
		expect((root().querySelector('button[aria-busy="true"]') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('NewProject step 2: the sub-specialty star follows whether the chosen specialty HAS sub-specialties', () => {
	const CATS = [{ categoryId: 'c1', categoryName: 'م', specialties: [
		{ id: 'withsubs', specialtyId: 's1', name: 'برمجة', icon: '', score: 90, subSpecialties: ['ويب', 'موبايل'] },
		{ id: 'nosubs', specialtyId: 's2', name: 'هوية', icon: '', score: 90, subSpecialties: [] },
	] }];
	let fixture: ComponentFixture<NewProject>; let c: any;
	beforeEach(() => {
		TestBed.configureTestingModule({ imports: [NewProject], providers: [
			provideRouter([]),
			{ provide: NewProjectService, useValue: { initSocket: vi.fn(), onStreamStart: vi.fn(), onStreamChunk: vi.fn(), onStreamEnd: vi.fn(), disconnectSocket: vi.fn(), getServiceById: vi.fn(() => of({})) } },
			{ provide: ProviderApiService, useValue: { getPassedSpecialties: () => of({ success: true, categories: CATS, registered: [] }), getAccreditationSamples: () => of({ success: true, samples: [] }) } },
			{ provide: SkillsCatalogService, useValue: { getCatalog: () => of({ success: true, data: { skills: [] } }), getProviderMine: () => of({ success: true, data: { skills: [] } }) } },
		] });
		fixture = TestBed.createComponent(NewProject); c = fixture.componentInstance;
		fixture.detectChanges(); c.currentStep.set(2); fixture.detectChanges();
	});
	const pick = (id: string) => { c.selectMainSpecialty({ id, specialtyId: id === 'withsubs' ? 's1' : 's2' }); fixture.detectChanges(); };
	const el = () => fixture.nativeElement as HTMLElement;
	const subTitleStar = () => Array.from(el().querySelectorAll('.spec-section-title')).find(t => (t.textContent ?? '').includes('التخصص الفرعي'))?.querySelector('.ws-req') ?? null;

	it('with sub-specialties: star + aria-required + validator require one; switching to one without drops all three and the stale value; switching back requires again', () => {
		pick('withsubs');
		expect(subTitleStar()).not.toBeNull();
		expect(el().querySelector('#np-subspecialty')!.getAttribute('aria-required')).toBe('true');
		expect(c.isValidStep2()).toBe(false);
		c.selectSubSpecialty('ويب'); fixture.detectChanges();
		expect(c.isValidStep2()).toBe(true);
		expect(c.effectiveSubSpecialty()).toBe('ويب');

		pick('nosubs');
		expect(subTitleStar()).toBeNull();
		expect(el().querySelector('#np-subspecialty')).toBeNull();
		expect(c.isValidStep2()).toBe(true);
		expect(c.selectedSubSpecialty()).toBe('');
		expect(c.effectiveSubSpecialty()).toBe('');
		expect(c.stepProblems(2)).toEqual([]);

		pick('withsubs');
		expect(subTitleStar()).not.toBeNull();
		expect(c.isValidStep2()).toBe(false);
		expect(c.selectedSubSpecialty()).toBe('');
	});

	it('a leftover sub value that does not belong to the current specialty is never counted or submitted', () => {
		pick('nosubs');
		c.selectedSubSpecialty.set('ويب'); // e.g. restored from an old saved description
		expect(c.effectiveSubSpecialty()).toBe('');
		pick('withsubs');
		c.selectedSubSpecialty.set('غير موجود');
		expect(c.isValidStep2()).toBe(false);
	});
});
