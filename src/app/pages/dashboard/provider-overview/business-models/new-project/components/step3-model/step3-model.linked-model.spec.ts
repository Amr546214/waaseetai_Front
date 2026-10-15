import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Step3ModelComponent } from './step3-model.component';

// Batch B T1 (§5): the standalone «معرض الأعمال» upload section is gone from the publishing path; the linked approved model is shown instead.
describe('market publishing step 3: approved model linking', () => {
	function mount(selected: string, models: any[], errorMessage = '') {
		TestBed.configureTestingModule({ imports: [Step3ModelComponent], providers: [provideRouter([])] });
		const f = TestBed.createComponent(Step3ModelComponent);
		f.componentRef.setInput('accreditedCount', 1); f.componentRef.setInput('distinctSpecialtiesCount', 1); f.componentRef.setInput('totalViewsCount', 0); f.componentRef.setInput('averageAiScore', 0);
		f.componentRef.setInput('isLoadingModels', false); f.componentRef.setInput('filteredModels', models); f.componentRef.setInput('selectedModel', selected); f.componentRef.setInput('errorMessage', errorMessage);
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement };
	}
	afterEach(() => TestBed.resetTestingModule());
	const model = { id: 'm1', title: 'نموذج معتمد', specialtyName: 'برمجة', status: 'AI_VERIFIED', score: 0, views: 0, attachments: [] };

	it('has no gallery upload section or file input for display images', () => {
		const { el } = mount('m1', [model]);
		expect(el.textContent).not.toContain('معرض أعمال المشروع');
		expect(el.querySelector('input[type="file"]')).toBeNull();
	});
	it('shows the model actually linked instead of asking to upload proof again', () => {
		const { el } = mount('m1', [model]);
		expect(el.querySelector('[data-testid="linked-model-title"]')!.textContent).toContain('نموذج معتمد');
		expect(el.textContent).toContain('ولا حاجة لرفع إثبات جديد');
	});
	it('with nothing selected it says a model is required, and a server error is shown with role=alert', () => {
		const { el } = mount('', [model], 'نموذج الاعتماد المختار لا يخص هذا التخصص');
		expect(el.querySelector('[data-testid="linked-model-missing"]')).not.toBeNull();
		expect(el.querySelector('[data-testid="model-error"]')!.getAttribute('role')).toBe('alert');
	});
});
