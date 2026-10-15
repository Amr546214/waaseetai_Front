import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { FinalApproval } from './final-approval';

// Achievement summary (final-approval page) on the SERVER lifecycle: a settled project is never «اكتملت كل المراحل» / «قيد التنفيذ», shows no held money, no fake 100%,
// and the settlement's own figures (kept separate from the money released through stage approvals).
const stage = (o: Record<string, unknown>) => ({ id: 's', stageNumber: 1, title: 'المرحلة 1: تصميم', amount: 8, status: 'pending', threads: [], ...o });
const SETTLED = { success: true, data: {
	title: 'مشروع', price: 25, providerName: 'نورة', closedBySettlement: true, statusLabel: 'أُغلق بتسوية نزاع', contractStatus: 'COMPLETED',
	financial: { contractValue: 25, contractValueNote: 'قيمة العقد التعاقدية قبل التسوية، وليست مبلغًا ينتظر الإفراج', heldNow: 0, releasedByStageApprovals: 0, settlement: { refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } },
	stages: [stage({ id: 's1', status: 'submitted', displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية', threads: [{ note: 'تسليم', files: [{ name: 'a.pdf', url: 'https://res.cloudinary.com/demo/image/upload/v1/a.pdf' }] }] }), stage({ id: 's2', stageNumber: 2, title: 'تطوير', displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية' }), stage({ id: 's3', stageNumber: 3, title: 'تسليم نهائي', displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية' })] } };

describe('final approval / achievement summary: lifecycle', () => {
	async function setup(ws: any) {
		await TestBed.configureTestingModule({ imports: [FinalApproval], providers: [provideRouter([]),
			{ provide: HttpClient, useValue: { get: () => of(ws), post: vi.fn() } },
			{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } }] }).compileComponents();
		const f = TestBed.createComponent(FinalApproval); f.detectChanges(); await f.whenStable(); f.detectChanges();
		vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
		const el = f.nativeElement as HTMLElement;
		return { f, c: f.componentInstance, el, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('settled: badge «أُغلق بتسوية نزاع», no «اكتملت كل المراحل» / «قيد التنفيذ» / «محتجز», no rating action, stages «أُغلقت بالتسوية»', async () => {
		const s = await setup(SETTLED);
		expect(s.q('fa-badge')!.textContent).toContain('أُغلق بتسوية نزاع');
		for (const bad of ['اكتملت كل المراحل', 'المشروع قيد التنفيذ', 'محتجز بالضمان', 'أُفرِج كامل']) expect(s.text(), bad).not.toContain(bad);
		expect(s.text()).not.toMatch(/محتجز\s*[1-9]/); // «محتجز الآن 0» is fine; no positive held amount is shown
		expect(s.q('fa-continue-rating')).toBeNull();
		expect(s.q('fa-settled-no-rating')!.textContent).toContain('لا يتاح تقييمه');
		expect(s.el.querySelectorAll('.fa-rate-btn').length).toBe(0);
		expect(s.text()).toContain('أُغلقت بالتسوية');
		expect(s.c.allStagesCompleted()).toBe(false);
	});

	it('settled: the settlement figures (10 refund / 15 release / 1.86 commission / 13.14 net) are shown apart from the stage-approval releases; historical value labelled; nothing held', async () => {
		const s = await setup(SETTLED);
		expect(s.q('fa-refund')!.textContent).toContain('10');
		expect(s.q('fa-release')!.textContent).toContain('15');
		expect(s.q('fa-settlement')!.textContent).toContain('1.86');
		expect(s.q('fa-settlement')!.textContent).toContain('13.14');
		expect(s.q('fa-stage-released')!.textContent).toContain('0');
		expect(s.q('fa-held-now')!.textContent!.trim()).toBe('0');
		expect(s.q('fa-settle-note')!.textContent).toContain('وليست مبلغًا ينتظر الإفراج');
		const money = Array.from(s.el.querySelectorAll('[data-testid="fa-stage-money"]')).map(e => e.textContent!);
		expect(money.every(m => m.includes('تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج'))).toBe(true);
		expect(s.c.releasedAmount()).toBe(0);
	});

	it('stage headings never duplicate «المرحلة N»', async () => {
		const s = await setup(SETTLED);
		const titles = Array.from(s.el.querySelectorAll('[data-testid="fa-stage-title"]')).map(e => e.textContent!.trim());
		expect(titles).toEqual(['المرحلة 1: تصميم', 'المرحلة 2: تطوير', 'المرحلة 3: تسليم نهائي']);
	});

	it('a normal delivery-completed project is unchanged: all approved, rating action offered', async () => {
		const s = await setup({ success: true, data: { title: 'م', price: 20, providerName: 'ن', contractStatus: 'COMPLETED', completedByDelivery: true, closedBySettlement: false, financial: { releasedByStageApprovals: 20, heldNow: 0, settlement: null, contractValue: 20 }, stages: [stage({ id: 'a', status: 'completed', amount: 10 }), stage({ id: 'b', stageNumber: 2, status: 'completed', amount: 10 })] } });
		expect(s.q('fa-badge')!.textContent).toContain('اكتملت كل المراحل');
		expect(s.q('fa-continue-rating')).not.toBeNull();
		expect(s.q('fa-settlement')).toBeNull();
		expect(s.c.releasedAmount()).toBe(20);
	});
});
