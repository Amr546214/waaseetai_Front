import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SaProjects } from './sa-projects';
import { SaProjectDetail } from './sa-project-detail/sa-project-detail';
import { AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';

// Admin project pages for a project closed by a dispute settlement: the escrow status RELEASED is shown as the settlement's result (never «مُفرَج» = all paid),
// the settlement figures come from the server's financial summary, and the stage-approval releases are a separate figure. Not checked with a live admin session.
const party = (id: string) => ({ id, name: id, email: `${id}@x.test` });
const ESCROW = { status: 'RELEASED', amount: 25, releasedAmount: 15, heldAmount: 0, fundedAt: null, platformCommissionAmount: 1.86, providerNetReleasedAmount: 13.14, feePolicyVersion: 2 };
const FIN = { contractValue: 25, contractValueNote: 'قيمة العقد التعاقدية قبل التسوية، وليست مبلغًا ينتظر الإفراج', heldNow: 0, releasedByStageApprovals: 0, settlement: { refundToClient: 10, releaseToProvider: 15, platformCommission: 1.86, providerNet: 13.14 } };

describe('admin project pages: settled project', () => {
	async function setup(list: any, detail: any) {
		const api = { listProjects: vi.fn(() => of({ success: true, data: list })), getProject: vi.fn(() => of({ success: true, data: detail })) };
		TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'projects', component: SaProjects }, { path: 'projects/:id', component: SaProjectDetail }]), { provide: AdminOpsApiService, useValue: api }] });
		return RouterTestingHarness.create();
	}
	const row = { id: 'p-1', title: 'مشروع مُسوّى', status: 'COMPLETED', statusLabel: 'أُغلق بتسوية نزاع', adminSettled: { disputeId: 'd', outcome: 'SPLIT', label: 'أُغلق بتسوية نزاع' }, lifecycle: { closedBySettlement: true }, createdAt: '2026-01-01T00:00:00Z', deliveryDays: 14, client: party('c'), provider: party('v'), contract: { id: 'ct', price: 25, status: 'COMPLETED' }, escrow: ESCROW, progress: { totalStages: 3, approvedStages: 0, percent: 0 } };

	it('list: «أُفرج جزء بقرار تسوية نزاع» instead of «مُفرَج», and a separate settled counter', async () => {
		const h = await setup({ items: [row], counts: { COMPLETED: 0, CLOSED_BY_SETTLEMENT: 1 }, kpis: { escrowHeldCount: 0, escrowHeldTotal: 0, currency: 'USD' }, pagination: { page: 1, limit: 20, total: 1, pages: 1, totalPages: 1 } }, {});
		await h.navigateByUrl('/projects', SaProjects); h.detectChanges();
		const el = h.routeNativeElement as HTMLElement;
		expect(el.querySelector('[data-testid="pj-escrow-settled"]')!.textContent).toContain('أُفرج جزء بقرار تسوية نزاع');
		expect(el.textContent).not.toMatch(/مُفرَج(?!\s*جزء)/);
		expect(el.querySelector('[data-testid="pj-kpi-settled"] .pj-kpi-val')!.textContent!.trim()).toBe('1');
	});

	it('detail: the settlement figures are shown apart from the stage-approval releases, with the historical-value note', async () => {
		const detail = { ...row, description: 'x', createdAt: '2026-01-01T00:00:00Z', specialty: 's', contract: { id: 'ct', price: 25, status: 'COMPLETED', durationDays: 14, signedAt: null, clientSignedAt: null, providerSignedAt: null }, stages: [], amendments: [], disputes: [], openDisputes: 0, currency: 'USD', progress: { totalStages: 3, approvedStages: 0, percent: 0 }, financial: FIN };
		const h = await setup({ items: [], counts: {}, kpis: { escrowHeldCount: 0, escrowHeldTotal: 0, currency: 'USD' }, pagination: { page: 1, limit: 20, total: 0, pages: 0, totalPages: 0 } }, detail);
		await h.navigateByUrl('/projects/p-1', SaProjectDetail); h.detectChanges();
		const box = (h.routeNativeElement as HTMLElement).querySelector('[data-testid="pj-settlement"]')!;
		expect(box.textContent).toContain('10');
		expect(box.textContent).toContain('15');
		expect(box.textContent).toContain('1.86');
		expect(box.textContent).toContain('13.14');
		expect((h.routeNativeElement as HTMLElement).textContent).toContain('وليست مبلغًا ينتظر الإفراج');
		expect((h.routeNativeElement as HTMLElement).textContent).toContain('إجمالي المحرَّر من الضمان (مراحل + تسوية)');
	});
});
