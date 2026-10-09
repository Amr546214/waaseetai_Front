import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AiResultCardComponent } from './ai-result-card.component';
import { AiResult, MetricSummaryDetails } from '../../core/models/ai-result.model';

@Component({ standalone: true, imports: [AiResultCardComponent], template: `<ws-ai-result-card title="ملخص" [result]="result()" [loading]="loading()" [requestFailed]="failed()" (retry)="retried = retried + 1" />` })
class Host { result = signal<AiResult<MetricSummaryDetails> | null>(null); loading = signal(false); failed = signal(false); retried = 0; }

const base = { score: null, confidence: null, recommendation: null, generatedAt: null } as const;
function mount() { const f = TestBed.createComponent(Host); f.detectChanges(); return { f, host: f.componentInstance, el: f.nativeElement as HTMLElement, tick: () => f.detectChanges() }; }
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

describe('ws-ai-result-card', () => {
	beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

	it('renders nothing before any result', () => { expect(mount().el.querySelector('section')).toBeNull(); });

	it('loading is neutral text, no AI mark', () => {
		const m = mount(); m.host.loading.set(true); m.tick();
		expect(q(m.el, 'ai-card-loading-text')!.textContent).toContain('جارٍ التحليل');
		expect(m.el.querySelector('circle')).toBeNull();
	});

	it('READY from GEMINI shows the AI mark, summary, observations and recommendations, never a number', () => {
		const m = mount();
		m.host.result.set({ ...base, status: 'READY', source: 'GEMINI', summary: 'ملخص حقيقي', details: { observations: [{ text: 'ملاحظة أ' }], recommendations: [{ text: 'اقتراح ب' }] } });
		m.tick();
		expect(q(m.el, 'ai-card-summary')!.textContent).toContain('ملخص حقيقي');
		expect(q(m.el, 'ai-card-observations')!.textContent).toContain('ملاحظة أ');
		expect(q(m.el, 'ai-card-recommendations')!.textContent).toContain('اقتراح ب');
		expect(m.el.querySelector('circle')).not.toBeNull();
		expect(m.el.textContent).not.toMatch(/\d\s*%|ثقة/);
	});

	it('READY from RULES is not AI: nothing is shown as AI', () => {
		const m = mount(); m.host.result.set({ ...base, status: 'READY', source: 'RULES', summary: 'x', details: null }); m.tick();
		expect(m.el.querySelector('circle')).toBeNull();
		expect(m.el.querySelector('[data-testid="ai-card-summary"]')).toBeNull();
	});

	it('NOT_ENOUGH_DATA says so, neutrally', () => {
		const m = mount(); m.host.result.set({ ...base, status: 'NOT_ENOUGH_DATA', source: 'NONE', summary: null, details: null }); m.tick();
		expect(q(m.el, 'ai-card-empty-text')!.textContent).toContain('لا توجد بيانات كافية للتحليل');
		expect(m.el.querySelector('circle')).toBeNull();
	});

	it('FAILED (result or request failure) says "تعذر تشغيل التحليل حاليًا" and offers a retry', () => {
		const m = mount(); m.host.result.set({ ...base, status: 'FAILED', source: 'GEMINI', summary: null, details: null }); m.tick();
		expect(q(m.el, 'ai-card-failed-text')!.textContent).toContain('تعذر تشغيل التحليل حاليًا');
		(q(m.el, 'ai-card-retry') as HTMLButtonElement).click();
		expect(m.host.retried).toBe(1);
		m.host.result.set(null); m.host.failed.set(true); m.tick();
		expect(q(m.el, 'ai-card-failed-text')).not.toBeNull();
	});
});
