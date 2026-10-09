import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProfileRequests } from './profile-requests';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';

// The AI block is driven ONLY by `aiReview`; password-change requests never show it; no score / confidence is ever rendered.
const READY = { status: 'READY', source: 'GEMINI', summary: 'ملخص الفحص', recommendation: 'يوصى بالمراجعة', generatedAt: '2026-10-09T10:00:00Z', observations: ['ملاحظة أولى', 'ملاحظة ثانية'] };
const row = (over: any = {}) => ({ id: 'abcdef123456', status: 'PENDING_HUMAN_REVIEW', category: 'CLIENT_IDENTITY', fieldLabel: 'رقم الهوية', currentValue: '***1', requestedValue: '***2', createdAt: '2026-10-08T10:00:00Z', aiConfidence: null, aiReview: null, ...over });

async function mount(rows: any[]) {
	await TestBed.configureTestingModule({ imports: [ProfileRequests], providers: [{ provide: ProfileApiService, useValue: { getMyChangeRequests: () => of({ success: true, data: rows }) } }] }).compileComponents();
	const f = TestBed.createComponent(ProfileRequests);
	f.detectChanges(); await f.whenStable(); f.detectChanges();
	return f.nativeElement as HTMLElement;
}

describe('client profile requests: AI pre-review block', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('READY (GEMINI): shows the title, summary, recommendation, observations and the advisory note', async () => {
		const el = await mount([row({ aiReview: READY })]);
		const t = el.textContent || '';
		expect(el.querySelector('[data-testid="ai-review-ready"]')).not.toBeNull();
		for (const x of ['فحص أولي بالذكاء الاصطناعي', 'ملخص الفحص', 'يوصى بالمراجعة', 'ملاحظة أولى', 'ملاحظة ثانية', 'استشاري، القرار للمراجع']) expect(t).toContain(x);
		expect(t).not.toContain('ثقة');
		expect(t).not.toContain('%');
	});

	it('FAILED: shows the unavailable text with a neutral icon, no AI title', async () => {
		const el = await mount([row({ aiReview: { ...READY, status: 'FAILED', summary: null, recommendation: null, observations: [] } })]);
		const t = el.textContent || '';
		expect(el.querySelector('[data-testid="ai-review-failed"]')?.textContent).toContain('تعذر تشغيل الفحص الأولي حاليًا. الطلب بانتظار مراجعة الفريق');
		expect(t).not.toContain('فحص أولي بالذكاء الاصطناعي');
	});

	it('null / NOT_ENOUGH_DATA / PENDING / RULES: only "بانتظار مراجعة الفريق", never the AI block', async () => {
		const el = await mount([
			row({ id: 'a1' }),
			row({ id: 'a2', aiReview: { ...READY, status: 'NOT_ENOUGH_DATA', source: 'NONE' } }),
			row({ id: 'a3', aiReview: { ...READY, status: 'PENDING', source: 'NONE' } }),
			row({ id: 'a4', aiReview: { ...READY, status: 'READY', source: 'RULES' } }),
		]);
		expect(el.querySelectorAll('[data-testid="ai-review-waiting"]').length).toBe(4);
		expect(el.querySelector('[data-testid="ai-review-ready"]')).toBeNull();
		expect(el.textContent).not.toContain('فحص أولي بالذكاء الاصطناعي');
		expect(el.textContent).toContain('بانتظار مراجعة الفريق');
		expect(el.textContent).not.toContain('ثقة');
	});

	it('CLIENT_PASSWORD_CHANGE shows NO AI block at all, even if aiReview were present', async () => {
		const el = await mount([row({ category: 'CLIENT_PASSWORD_CHANGE', aiReview: null }), row({ id: 'z2', category: 'CLIENT_PASSWORD_CHANGE', aiReview: READY })]);
		expect(el.querySelector('ws-profile-ai-review')?.children.length).toBe(0);
		expect(el.querySelector('[data-testid="ai-review-ready"]')).toBeNull();
		expect(el.querySelector('[data-testid="ai-review-waiting"]')).toBeNull();
		expect(el.querySelector('[data-testid="ai-review-failed"]')).toBeNull();
	});
});
