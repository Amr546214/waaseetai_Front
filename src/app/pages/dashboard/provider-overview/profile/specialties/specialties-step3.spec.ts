import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Step 3 of the specialty wizard: an ADVISORY AI review of the portfolio samples (GET latest / POST ai-evaluate), or an honest state.
const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { Specialties } from './specialties';

const html = () => readFileSync(join(__dirname, 'specialties.html'), 'utf-8');
const bodyText = (f: ComponentFixture<Specialties>) => ((f.nativeElement as HTMLElement).textContent || '').replace(/\s+/g, ' ');
const READY = { status: 'READY', source: 'GEMINI', score: null, summary: 'ملخص المراجعة', generatedAt: '2026-10-09T10:00:00Z', unavailableReason: null, samplesCount: 2,
	details: { strengths: [{ text: 'قوة أ', basedOn: [] }], warnings: [{ text: 'ملاحظة ب', basedOn: [] }], recommendations: [{ text: 'توصية ج', basedOn: [] }] } };
const NOT_ENOUGH = { status: 'NOT_ENOUGH_DATA', source: 'NONE', score: null, summary: null, generatedAt: null, details: null, unavailableReason: null, samplesCount: 1 };
const FAILED = (reason: string) => ({ status: 'FAILED', source: 'GEMINI', score: null, summary: null, generatedAt: null, details: null, unavailableReason: reason, samplesCount: 1 });

describe('Specialties wizard — step 3 advisory AI portfolio review', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;
	let get: ReturnType<typeof vi.fn>, post: ReturnType<typeof vi.fn>;

	async function setup(opts: { latest?: any; evaluate?: () => any; samples?: number } = {}) {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		get = vi.fn(() => (opts.latest === undefined ? of({ success: true, data: NOT_ENOUGH }) : opts.latest));
		post = vi.fn(opts.evaluate ?? (() => of({ success: true, data: READY })));
		await TestBed.configureTestingModule({ imports: [Specialties], providers: [{ provide: HttpClient, useValue: { get, post } }] }).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		component.providerSpecialtyId.set('ps-real-1');
		component.samples.set(Array.from({ length: opts.samples ?? 2 }, (_, i) => ({ id: `s${i}`, subSpecialty: 'x', title: 'نموذج', description: '', technologies: [], technologiesInput: '', publicFile: null, publicFileName: null, proofFiles: [], proofFileNames: [] })) as any);
		component.currentStep.set(3);
		component.loadPortfolioReview();
		fixture.detectChanges();
	}
	const q = (id: string) => (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	it('button hidden without samples; shown with samples', async () => {
		await setup({ samples: 0 });
		expect(q('specialty-ai-review-btn')).toBeNull();
		TestBed.resetTestingModule();
		await setup({ samples: 2 });
		expect(q('specialty-ai-review-btn')).toBeTruthy();
	});
	it('the latest stored review loads on entering the step (GET), without calling the model (no POST)', async () => {
		await setup({ latest: of({ success: true, data: READY }) });
		expect(get.mock.calls[0][0]).toContain('/provider/specialties/ps-real-1/ai-evaluation');
		expect(post).not.toHaveBeenCalled();
		expect(q('specialty-ai-review-summary')!.textContent).toContain('ملخص المراجعة');
	});
	it('READY renders summary, strengths, warnings, recommendations; no score/confidence when null; advisory note', async () => {
		await setup({ latest: of({ success: true, data: READY }) });
		expect(q('specialty-ai-review-strengths')!.textContent).toContain('قوة أ');
		expect(q('specialty-ai-review-warnings')!.textContent).toContain('ملاحظة ب');
		expect(q('specialty-ai-review-recommendations')!.textContent).toContain('توصية ج');
		expect(q('specialty-ai-review-score')).toBeNull();
		expect(q('specialty-ai-review-note')!.textContent).toContain('لا تقبل التخصص ولا تمنح شارة');
		expect(bodyText(fixture)).not.toMatch(/ثقة|تمت الموافقة|تم اعتماد التخصص/);
	});
	it('loading while the review runs, then the result replaces it', async () => {
		const subj = new Subject<any>();
		await setup({ evaluate: () => subj.asObservable() });
		component.requestPortfolioReview(); fixture.detectChanges();
		expect(q('specialty-ai-review-loading')!.textContent).toContain('جارٍ التحليل');
		subj.next({ success: true, data: READY }); subj.complete(); fixture.detectChanges();
		expect(q('specialty-ai-review-loading')).toBeNull();
		expect(q('specialty-ai-review-ready')).toBeTruthy();
	});
	it('NOT_ENOUGH_DATA: "أضف نماذج أعمال كافية ليتم تحليلها"', async () => {
		await setup({ evaluate: () => of({ success: true, data: NOT_ENOUGH }) });
		component.requestPortfolioReview(); fixture.detectChanges();
		expect(q('specialty-ai-review-empty')!.textContent).toContain('أضف نماذج أعمال كافية ليتم تحليلها');
		expect(q('specialty-ai-review-ready')).toBeNull();
	});
	it('FAILED (request error or ERROR result): "تعذر تشغيل المراجعة حاليًا" with a retry; no fake result', async () => {
		await setup({ evaluate: () => throwError(() => ({ status: 500 })) });
		component.requestPortfolioReview(); fixture.detectChanges();
		expect(q('specialty-ai-review-failed')!.textContent).toContain('تعذر تشغيل المراجعة حاليًا');
		expect(q('specialty-ai-review-retry')).toBeTruthy();
		expect(q('specialty-ai-review-ready')).toBeNull();
		post.mockReturnValue(of({ success: true, data: FAILED('ERROR') }));
		(q('specialty-ai-review-retry') as HTMLButtonElement).click(); fixture.detectChanges();
		expect(post).toHaveBeenCalledTimes(2);
		expect(q('specialty-ai-review-failed')!.textContent).toContain('تعذر تشغيل المراجعة حاليًا');
	});
	it('FAILED because the AI is not configured: same message, but NO retry loop and no request button', async () => {
		await setup({ evaluate: () => of({ success: true, data: FAILED('NOT_CONFIGURED') }) });
		component.requestPortfolioReview(); fixture.detectChanges();
		expect(q('specialty-ai-review-failed')!.textContent).toContain('تعذر تشغيل المراجعة حاليًا');
		expect(q('specialty-ai-review-retry')).toBeNull();
		expect(q('specialty-ai-review-btn')).toBeNull();
		expect(post).toHaveBeenCalledTimes(1);
	});
	it('the review never blocks the wizard: declarations are shown and the next button enables once ticked', async () => {
		await setup({ evaluate: () => throwError(() => ({ status: 503 })) });
		const root = fixture.nativeElement as HTMLElement;
		expect(root.querySelector('[data-testid="step3-declarations"]')).toBeTruthy();
		const next = () => Array.from(root.querySelectorAll('button')).find(b => (b.textContent || '').includes('التالي')) as HTMLButtonElement;
		expect(next().disabled).toBe(true);
		component.declarations.update(d => d.map(x => ({ ...x, checked: true })));
		fixture.detectChanges();
		expect(next().disabled).toBe(false);
	});
	it('static: advisory wording, no old score dashboard, no approval claim', () => {
		const src = html();
		expect(src).toContain('مراجعة بالذكاء الاصطناعي');
		expect(src).toContain('لا تقبل التخصص ولا تمنح شارة');
		expect(src).not.toContain('AI Score');
		expect(src).not.toContain('هذه المراجعة غير متاحة حاليًا');
	});
});
