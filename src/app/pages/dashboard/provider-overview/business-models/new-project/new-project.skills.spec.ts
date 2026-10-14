import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { NewProject } from './new-project';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';

const CATEGORIES = [{
	categoryId: 'cat-design', categoryName: 'التصميم',
	specialties: [
		{ id: 'ps1', specialtyId: 's1', name: 'هوية بصرية', icon: '', score: 90, subSpecialties: [] },
		{ id: 'ps2', specialtyId: 's2', name: 'واجهات', icon: '', score: 90, subSpecialties: [] },
	],
}, {
	categoryId: 'cat-dev', categoryName: 'البرمجة',
	specialties: [{ id: 'ps3', specialtyId: 's3', name: 'ويب', icon: '', score: 90, subSpecialties: [] }],
}];
const CATALOG: Record<string, string[]> = {
	'cat-design': ['Figma', 'Photoshop', 'Illustrator'],
	'cat-dev': ['Angular', 'Node'],
};

describe('NewProject (model upload) skills from the catalog', () => {
	let fixture: ComponentFixture<NewProject>;
	let c: any;
	let np: any;
	let catalog: any;

	const setup = (opts: { mine?: string[]; service?: any; edit?: boolean } = {}) => {
		np = {
			initSocket: vi.fn(), onStreamStart: vi.fn(), onStreamChunk: vi.fn(), onStreamEnd: vi.fn(), disconnectSocket: vi.fn(),
			getServiceById: vi.fn(() => of({ data: opts.service })),
			publishService: vi.fn(() => of({ success: true })),
			updateService: vi.fn(() => of({ success: true })),
		};
		catalog = {
			getCatalog: vi.fn((k: string) => of({ success: true, data: { category: k, skills: CATALOG[k] ?? [] } })),
			getProviderMine: vi.fn(() => of({ success: true, data: { skills: opts.mine ?? [], mainSpecialty: 'x', subSpecialties: [], specialties: [] } })),
		};
		TestBed.configureTestingModule({
			imports: [NewProject],
			providers: [
				provideRouter([]),
				{ provide: NewProjectService, useValue: np },
				{ provide: ProviderApiService, useValue: {
					getPassedSpecialties: () => of({ success: true, categories: CATEGORIES, registered: [] }),
					getAccreditationSamples: () => of({ success: true, data: [] }),
				} },
				{ provide: SkillsCatalogService, useValue: catalog },
			],
		});
		fixture = TestBed.createComponent(NewProject);
		c = fixture.componentInstance;
		fixture.detectChanges();
		if (opts.edit) { c.editServiceId.set('svc-1'); c.loadExistingService('svc-1'); }
		fixture.detectChanges();
	};
	const el = () => fixture.nativeElement as HTMLElement;
	const goStep2 = () => { c.currentStep.set(2); fixture.detectChanges(); };
	afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });

	it('after the specialty is chosen the catalog skills of its category are offered, and the provider saved skills are pre-selected', () => {
		setup({ mine: ['Figma', 'Excel-not-in-catalog'] });
		goStep2();
		c.selectMainSpecialty(CATEGORIES[0].specialties[0]);
		fixture.detectChanges();
		expect(catalog.getCatalog).toHaveBeenCalledWith('cat-design');
		expect(c.skillOptions()).toEqual(CATALOG['cat-design']);
		expect(c.selectedSkills()).toEqual(['Figma']);
		const chips = Array.from(el().querySelectorAll('[data-testid="skills-selected"] .skp-chip')).map(x => x.getAttribute('data-skill'));
		expect(chips).toEqual(['Figma']);
		const opts = Array.from(el().querySelectorAll('[data-testid="skills-options"] .skp-opt')).map(x => x.getAttribute('data-skill'));
		expect(opts).toEqual(['Photoshop', 'Illustrator']);
	});

	it('switching to another field clears the old skills and re-suggests from the new catalog only', () => {
		setup({ mine: ['Figma', 'Angular'] });
		goStep2();
		c.selectMainSpecialty(CATEGORIES[0].specialties[0]);
		fixture.detectChanges();
		expect(c.selectedSkills()).toEqual(['Figma']);
		c.selectMainSpecialty(CATEGORIES[1].specialties[0]);
		fixture.detectChanges();
		expect(c.skillOptions()).toEqual(CATALOG['cat-dev']);
		expect(c.selectedSkills()).toEqual(['Angular']);
	});

	it('the selected skills are sent as `skills` when publishing', () => {
		setup({ mine: ['Figma'] });
		c.selectMainSpecialty(CATEGORIES[0].specialties[0]);
		c.onSkillsChange(['Figma', 'Photoshop']);
		c.projectName.set('نموذج');
		c.submitProject();
		expect(np.publishService).toHaveBeenCalledTimes(1);
		expect(np.publishService.mock.calls[0][0].skills).toEqual(['Figma', 'Photoshop']);
	});

	it('edit/reload restores the saved selection of the service (not the profile suggestion)', () => {
		setup({ mine: ['Photoshop'], edit: true, service: { title: 't', description: 'd', specialtyId: 'ps1', skills: ['Illustrator'] } });
		expect(c.selectedSkills()).toEqual(['Illustrator']);
		goStep2();
		const chips = Array.from(el().querySelectorAll('[data-testid="skills-selected"] .skp-chip')).map(x => x.getAttribute('data-skill'));
		expect(chips).toEqual(['Illustrator']);
		c.submitProject();
		expect(np.updateService.mock.calls[0][1].skills).toEqual(['Illustrator']);
	});

	it('shows the server 400 message next to the skills and returns to the specialty step', () => {
		setup();
		c.selectMainSpecialty(CATEGORIES[0].specialties[0]);
		np.publishService.mockReturnValue(throwError(() => ({ status: 400, error: { message: 'مهارات غير مدرجة في كتالوج المجال: Excel' } })));
		c.currentStep.set(5);
		c.submitProject();
		fixture.detectChanges();
		expect(c.currentStep()).toBe(2);
		expect(c.skillsError()).toContain('Excel');
		expect(el().querySelector('[data-testid="model-skills-error"]')?.textContent).toContain('Excel');
	});

	it('a catalog failure is an honest message, not a made-up list', () => {
		setup();
		catalog.getCatalog.mockReturnValue(throwError(() => new Error('x')));
		goStep2();
		c.selectMainSpecialty(CATEGORIES[0].specialties[0]);
		fixture.detectChanges();
		expect(c.skillOptions()).toEqual([]);
		expect(c.skillsError()).toContain('تعذر تحميل مهارات');
	});
});
