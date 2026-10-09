import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ModelDetails } from './model-details';
import { NewProjectService } from '../../../../../../core/services/new-project.service';
import { AuthStore } from '../../../../../../core/store/auth.store';

// The details page shows only STORED fields of the audit report. No sub-metric is derived from aiScore and no static
// "ملاحظات" are composed. Without a stored report the page says so honestly.
const model = (over: any) => ({ id: 'm1', title: 'خدمة', category: 'تصميم', createdAtFormatted: '1 يناير', viewsCount: 1, offersCount: 0, rating: 4, reviewsCount: 1, aiScore: 0, tags: [], status: 'PUBLISHED', ...over });

function render(m: any) {
	TestBed.configureTestingModule({
		imports: [ModelDetails],
		providers: [
			provideRouter([]),
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'm1' } } } },
			{ provide: NewProjectService, useValue: { getMyMarketModels: () => of({ success: true, data: { models: [m] } }) } },
			{ provide: AuthStore, useValue: { currentUser: () => null } },
		],
	});
	const f = TestBed.createComponent(ModelDetails);
	f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('ModelDetails - audit report', () => {
	beforeEach(() => {
		(window as any).matchMedia = vi.fn(() => ({ matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
	});
	afterEach(() => TestBed.resetTestingModule());

	it('no stored report: honest empty state, no AI badge / score, no derived metrics or canned notes', () => {
		const el = render(model({ aiScore: 0 }));
		expect(el.querySelector('[data-testid="audit-report-empty"]')?.textContent).toContain('لم يصدر تقرير تدقيق بعد');
		const t = el.textContent || '';
		expect(t).not.toContain('AI 0/100');
		expect(t).not.toContain('جودة التنفيذ');
		expect(t).not.toContain('أصالة العمل');
		expect(t).not.toContain('ملاحظات وسيط AI');
		expect(t).not.toContain('صدر يوم الاعتماد');
		expect(el.querySelector('.mdl-ai-metric')).toBeNull();
	});

	it('stored report: renders its summary, strengths and issues verbatim and the real score', () => {
		const el = render(model({ aiScore: 87, aiAuditReport: { summary: 'ملخص مخزّن', strengths: ['قوة 1'], issues: ['ملاحظة 1'] } }));
		const t = el.textContent || '';
		expect(t).toContain('ملخص مخزّن');
		expect(t).toContain('قوة 1');
		expect(t).toContain('ملاحظة 1');
		expect(t).toContain('AI 87/100');
		expect(el.querySelector('[data-testid="audit-report-empty"]')).toBeNull();
		expect(t).not.toContain('توافق جيد مع طلبات تخصص');
	});
});
