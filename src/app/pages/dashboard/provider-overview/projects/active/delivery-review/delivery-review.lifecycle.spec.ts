import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { DeliveryReview } from './delivery-review';
import { AuthStore } from '../../../../../../core/store/auth.store';

// Provider side: final delivery / closure page on the server lifecycle. Settled -> «أُغلق بتسوية نزاع», settlement figures, nothing to deliver and no «بانتظار اعتماد العميل»;
// completed by delivery -> closed + rating entry; waiting -> only when the final delivery really waits for the client; undelivered -> the server's reason; skeleton while loading.
const stage = (o: Record<string, unknown>) => ({ id: 's', stageNumber: 1, title: 'المرحلة 1: تصميم', amount: 10, isDone: false, status: 'pending', statusText: 'لم تبدأ', threads: [], ...o });
const base = (o: Record<string, unknown>) => ({ success: true, data: { projectId: 'p', title: 'مشروع', conversationId: 'c', closedBySettlement: false, completedByDelivery: false, statusLabel: 'مشروع نشط', eligibility: { upload: { allowed: true, reason: null } }, financial: { contractValue: 20, heldNow: 20, releasedByStageApprovals: 0, settlement: null, fullyPaidToProvider: false }, stages: [stage({}), stage({ id: 's2', stageNumber: 2, title: 'تطوير' })], ...o } });

async function setup(response: any) {
	await TestBed.configureTestingModule({ imports: [DeliveryReview], providers: [provideRouter([]),
		{ provide: HttpClient, useValue: { get: () => (response instanceof Subject ? response : of(response)), post: vi.fn() } },
		{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'contract-1' }) } } }] }).compileComponents();
	const f = TestBed.createComponent(DeliveryReview); f.detectChanges(); await f.whenStable(); f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	return { f, c: f.componentInstance, el, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
}

describe('provider final delivery page: lifecycle', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('settled: label, settlement figures apart from stage releases, historical value, no «بانتظار اعتماد العميل», no upload, no «أُفرِج كامل المبلغ»', async () => {
		const s = await setup(base({
			closedBySettlement: true, statusLabel: 'أُغلق بتسوية نزاع', eligibility: { upload: { allowed: false, reason: 'أُغلق المشروع بتسوية نزاع' } },
			financial: { contractValue: 25, contractValueNote: 'قيمة العقد التعاقدية قبل التسوية، وليست مبلغًا ينتظر الإفراج', heldNow: 0, releasedByStageApprovals: 0, fullyPaidToProvider: false, settlement: { refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } },
			stages: [stage({ status: 'submitted', lifecycle: { amountState: 'HISTORICAL', awaitingClientReview: false } }), stage({ id: 's2', stageNumber: 2, title: 'تطوير', lifecycle: { amountState: 'HISTORICAL', awaitingClientReview: false } })] }));
		expect(s.q('pdr-badge')!.textContent).toContain('أُغلق بتسوية نزاع');
		for (const bad of ['بانتظار اعتماد العميل', 'أُفرِج كامل المبلغ', 'تم إغلاق المشروع بنجاح', 'رفع تسليم جديد', 'الدفعة النهائية (محتجزة']) expect(s.text(), bad).not.toContain(bad);
		expect(s.q('pdr-settled-final')).not.toBeNull();
		expect(s.q('pdr-upload')).toBeNull();
		expect(s.q('pdr-settlement')!.textContent).toContain('1.86');
		expect(s.q('pdr-settlement')!.textContent).toContain('13.14');
		expect(s.q('pdr-settle-release')!.textContent).toContain('15');
		expect(s.q('pdr-held-now')!.textContent!.trim()).toBe('0');
		expect(Array.from(s.el.querySelectorAll('[data-testid="pdr-stage-money"]')).every(e => e.textContent!.includes('وليست مبلغًا ينتظر الإفراج'))).toBe(true);
	});

	it('stage headings never duplicate «المرحلة N»', async () => {
		const s = await setup(base({}));
		expect(Array.from(s.el.querySelectorAll('[data-testid="pdr-stage-title"]')).map(e => e.textContent!.trim())).toEqual(['المرحلة 1: تصميم', 'المرحلة 2: تطوير']);
	});

	it('completed by delivery: closed message and the rating entry, «المشروع مكتمل»', async () => {
		const s = await setup(base({ completedByDelivery: true, eligibility: { upload: { allowed: false, reason: 'اكتمل' } }, financial: { contractValue: 20, heldNow: 0, releasedByStageApprovals: 20, settlement: null, fullyPaidToProvider: true }, stages: [stage({ isDone: true, status: 'completed' }), stage({ id: 's2', stageNumber: 2, isDone: true, status: 'completed' })] }));
		expect(s.q('pdr-badge')!.textContent).toContain('المشروع مكتمل');
		expect(s.text()).toContain('تم إغلاق المشروع بنجاح');
		expect(s.q('pdr-settled-final')).toBeNull();
	});

	it('final delivery really waiting: «بانتظار اعتماد العميل»; undelivered: the server reason and no waiting claim', async () => {
		const waiting = await setup(base({ stages: [stage({ isDone: true, status: 'completed' }), stage({ id: 's2', stageNumber: 2, status: 'submitted', lifecycle: { awaitingClientReview: true } })] }));
		expect(waiting.q('pdr-badge')!.textContent).toContain('بانتظار اعتماد العميل');
		TestBed.resetTestingModule();
		const idle = await setup(base({ eligibility: { upload: { allowed: true, reason: null } }, stages: [stage({ isDone: true, status: 'completed' }), stage({ id: 's2', stageNumber: 2, status: 'in_progress', lifecycle: { awaitingClientReview: false } })] }));
		expect(idle.q('pdr-badge')!.textContent).not.toContain('بانتظار اعتماد العميل');
		expect(idle.q('pdr-not-delivered')).not.toBeNull();
	});

	it('loading: skeleton only', async () => {
		const s = await setup(new Subject<any>());
		expect(s.el.querySelector('.skeleton-row')).not.toBeNull();
		expect(s.q('pdr-badge')).toBeNull();
	});
});
