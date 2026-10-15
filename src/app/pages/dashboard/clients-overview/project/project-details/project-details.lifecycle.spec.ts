import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectDetails } from './project-details';

vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });

// Client project details read the SERVER lifecycle: the review bar (approve / revise) exists only for a stage the server says is reviewable;
// an undelivered stage shows no review bar; a settled project shows the banner, the settlement figures and no held money; skeleton while loading.
const ok = { allowed: true, reason: null, code: null };
const blocked = (code: string, reason: string) => ({ allowed: false, reason, code });
const stage = (o: Record<string, unknown>) => ({ id: 's', stageNumber: 1, title: 'المرحلة 1: تصميم', description: '', amount: 10, percentage: 50, days: 7, status: 'pending', roundsCount: 0, threads: [], amountHeld: true, ...o });
const DATA = (o: Record<string, unknown> = {}) => ({
	id: 'c', projectId: 'proj-1', role: 'client', conversationId: 'conv', title: 'مشروع', clientName: 'نورة', contractRef: 'CT-1', price: 20, durationDays: 14, daysLeft: 5, progress: 0,
	escrowTotal: 20, escrowHeld: 20, escrowReleased: 0, status: 'ACTIVE', statusLabel: 'مشروع نشط', contractStatus: 'ACTIVE', escrowStatus: 'HELD', escrowFunded: true, disputeStatus: null, disputeFreeze: { frozen: false },
	closedBySettlement: false, completedByDelivery: false, financial: { contractValue: 20, heldNow: 20, releasedByStageApprovals: 0, settlement: null },
	stages: [], deliveries: [], edits: [], messages: [], files: [], employee: null,
	aiInsights: { confidence: null, earlyDays: null, matchPercentage: null, riskLevel: 'غير محسوبة', riskLevelKey: 'unknown', healthRating: 'بانتظار بيانات كافية', bullets: [] }, ...o });

async function setup(data: any) {
	const get = vi.fn((url: string) => String(url).includes('/amendments') ? of({ success: true, data: [] }) : String(url).includes('rating') ? of({ canRate: false, review: null }) : (data instanceof Subject ? data : of({ success: true, data })));
	await TestBed.configureTestingModule({ imports: [ProjectDetails], providers: [provideRouter([]), { provide: HttpClient, useValue: { get, post: vi.fn() } },
		{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) }, params: of({ id: 'proj-1' }) } }] }).compileComponents();
	const f = TestBed.createComponent(ProjectDetails); f.detectChanges(); await f.whenStable(); f.detectChanges();
	f.componentInstance.setTab('miles'); f.detectChanges();
	const el = f.nativeElement as HTMLElement;
	return { f, c: f.componentInstance, el, text: () => el.textContent!.replace(/\s+/g, ' '), q: (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null };
}

describe('client project details: lifecycle', () => {
	afterEach(() => TestBed.resetTestingModule());

	it('delivered stage: «تسليم جديد بانتظار قرارك» with approve + revise; the undelivered stage has no review bar', async () => {
		const s = await setup(DATA({ stages: [
			stage({ id: 's1', status: 'submitted', roundsCount: 1, threads: [{ id: 't', author: 'م', authorInitial: 'م', date: new Date().toISOString(), note: 'ن', files: [{ name: 'a', url: 'https://x.test/a' }] }], lifecycle: { awaitingClientReview: true, closedBySettlement: false, eligibility: { approve: ok, requestRevision: ok } } }),
			stage({ id: 's2', stageNumber: 2, status: 'in_progress', lifecycle: { awaitingClientReview: false, closedBySettlement: false, eligibility: { approve: blocked('STAGE_NOT_DELIVERED', 'لم يسلّم'), requestRevision: blocked('STAGE_NOT_DELIVERED', 'لم يسلّم') } } })] }));
		expect(s.el.querySelectorAll('[data-testid="pd-approve-miles"]').length).toBe(1);
		expect(s.el.querySelectorAll('[data-testid="pd-revise-miles"]').length).toBe(1);
		expect(s.text()).toContain('تسليم جديد بانتظار قرارك');
		expect(s.el.querySelectorAll('.lc-mbar').length).toBe(1);
	});

	it('settled: banner, settlement figures, held 0, no review bar, no «قيد التنفيذ» days, stage value labelled historical', async () => {
		const s = await setup(DATA({
			status: 'COMPLETED', contractStatus: 'COMPLETED', statusLabel: 'أُغلق بتسوية نزاع', closedBySettlement: true, escrowHeld: 0, escrowReleased: 0, escrowStatus: 'RELEASED',
			financial: { contractValue: 25, contractValueNote: 'قيمة العقد التعاقدية قبل التسوية، وليست مبلغًا ينتظر الإفراج', heldNow: 0, releasedByStageApprovals: 0, settlement: { refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } },
			stages: [stage({ id: 's1', status: 'submitted', amountHeld: false, displayStatus: 'CLOSED_BY_SETTLEMENT', displayStatusLabel: 'أُغلقت بالتسوية', lifecycle: { awaitingClientReview: false, closedBySettlement: true, eligibility: { approve: blocked('CLOSED_BY_SETTLEMENT', 'تسوية'), requestRevision: blocked('CLOSED_BY_SETTLEMENT', 'تسوية') } } })] }));
		expect(s.q('pd-settled-banner')!.textContent).toContain('أُغلق بتسوية نزاع');
		expect(s.el.querySelectorAll('[data-testid="pd-approve-miles"]').length).toBe(0);
		expect(s.el.querySelectorAll('.lc-mbar').length).toBe(0);
		expect(s.text()).toContain('أُغلقت بالتسوية');
		expect(s.text()).toContain('تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج');
		s.c.setTab('overview'); s.f.detectChanges();
		expect(s.q('pd-settle-refund')!.textContent).toContain('10');
		expect(s.q('pd-settle-release')!.textContent).toContain('15');
		expect(s.q('pd-held-now')!.textContent).toContain('0');
		expect(s.text()).not.toContain('يوم متبقٍ');
		expect(s.text()).not.toContain('إجمالي محتجز');
	});

	it('active dispute: the freeze banner shows, approve stays visible but disabled, revision stays', async () => {
		const FREEZE = 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع';
		const s = await setup(DATA({ hasActiveDispute: true, disputeFreeze: { frozen: true, reason: FREEZE, activeDisputeCount: 1, disputeId: 'd' }, stages: [
			stage({ id: 's1', status: 'submitted', roundsCount: 1, lifecycle: { awaitingClientReview: true, closedBySettlement: false, eligibility: { approve: { allowed: false, reason: FREEZE, code: 'ACTIVE_DISPUTE_FREEZE' }, requestRevision: ok } } })] }));
		expect(s.q('pd-freeze-banner')!.textContent).toContain(FREEZE);
		expect((s.q('pd-approve-miles') as HTMLButtonElement).disabled).toBe(true);
		expect(s.q('pd-revise-miles')).not.toBeNull();
	});

	it('loading: skeleton only, no stages or buttons until the server answers', async () => {
		const subject = new Subject<any>();
		const s = await setup(subject);
		expect(s.el.querySelector('.skeleton-row')).not.toBeNull();
		expect(s.q('pd-approve-miles')).toBeNull();
		expect(s.q('pd-settled-banner')).toBeNull();
	});
});
