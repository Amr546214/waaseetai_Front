import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { Progress } from './progress';

const stage = (o: Record<string, unknown> = {}) => ({
	id: 'st1',
	stageNumber: 1,
	title: 'تطوير الواجهة الأمامية',
	description: '',
	amount: 300,
	days: 4,
	status: 'in_progress',
	statusText: 'قيد التنفيذ',
	isDone: false,
	isWait: true,
	roundsCount: 0,
	threads: [],
	canUploadDelivery: true,
	canSubmitDelivery: true,
	uploadBlockedReason: null,
	amountHeld: true,
	revisionRequested: false,
	...o,
});

const editItem = (o: Record<string, unknown> = {}) => ({
	id: 'e1',
	stageId: 'st1',
	stageTitle: 'تطوير الواجهة الأمامية',
	title: 'ملاحظات تعديل',
	clientNotes: 'عدّل التصميم',
	createdAt: '2026-11-14T10:00:00Z',
	status: 'waiting',
	statusText: 'بانتظار إعادة التسليم',
	canUploadDelivery: true,
	uploadBlockedReason: null,
	...o,
});

const cancelReq = (status: 'PENDING_OTHER_PARTY' | 'AGREED_PENDING_SETTLEMENT' | 'REJECTED' | 'WITHDRAWN') => ({
	id: 'cr1',
	contractId: 'c1',
	contractRef: 'CT-1',
	projectId: 'p1',
	projectTitle: 'مشروع',
	contractStatus: 'ACTIVE',
	clientName: 'عميل',
	providerName: 'مزود',
	requestedByRole: 'PROVIDER',
	reason: 'طلب إلغاء بالتراضي',
	note: null,
	status,
	statusLabel: status === 'PENDING_OTHER_PARTY' ? 'بانتظار موافقة الطرف الآخر' : 'تم الاتفاق',
	settlementStatus: 'NOT_APPLICABLE',
	settlementLabel: null,
	respondedAt: null,
	responseNote: null,
	withdrawnAt: null,
	createdAt: '2026-11-14T10:00:00Z',
	updatedAt: '2026-11-14T10:00:00Z',
	myRole: 'PROVIDER',
	mine: true,
	canRespond: false,
	canWithdraw: status === 'PENDING_OTHER_PARTY',
	moneyNote: '',
	moneyMoved: false,
});

const workspaceData = (overrides: Record<string, unknown> = {}) => ({
	projectId: 'p1',
	conversationId: 'conv-1',
	title: 'مشروع',
	contractRef: 'CT-1',
	clientName: 'عميل',
	statusLabel: 'مشروع نشط',
	status: 'ACTIVE',
	contractStatus: 'ACTIVE',
	price: 300,
	daysLeft: 5,
	progress: 0,
	escrowTotal: 300,
	escrowHeld: 300,
	escrowReleased: 0,
	stages: [stage()],
	edits: [editItem()],
	messages: [],
	files: [],
	deliveries: [],
	...overrides,
});

describe('Progress — stop delivery on open dispute or mutual cancellation', () => {
	async function setup(dataOverrides: Record<string, unknown> = {}, cancelRequests: any[] = []) {
		const post = vi.fn(() => of({ success: true, data: {} }));
		const get = vi.fn((url: string) => {
			if (String(url).includes('cancellation-requests')) {
				return of({ success: true, data: { requests: cancelRequests, eligibility: { canRequest: true, reason: null } } });
			}
			if (String(url).includes('/amendments')) return of({ success: true, data: [] });
			return of({ success: true, data: workspaceData(dataOverrides) });
		});

		await TestBed.configureTestingModule({
			imports: [Progress],
			providers: [
				provideRouter([]),
				{ provide: HttpClient, useValue: { get, post } },
				{ provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})), snapshot: { paramMap: convertToParamMap({ id: 'proj-1' }) } } },
			],
		}).compileComponents();

		const f = TestBed.createComponent(Progress);
		f.detectChanges();
		await f.whenStable();
		f.detectChanges();
		return { f, c: f.componentInstance, el: f.nativeElement as HTMLElement, post };
	}

	afterEach(() => TestBed.resetTestingModule());

	const uploadButtons = (el: HTMLElement) =>
		Array.from(el.querySelectorAll('button')).filter(b =>
			/^(رفع تسليم المرحلة|إعادة التسليم|إعادة رفع التسليم|رفع جديد|رفع النسخة المعدلة)$/.test((b.textContent || '').trim())
		);

	it('disputeFreeze (client or provider open dispute): hides all upload buttons across overview, miles, and edits while keeping chat available', async () => {
		const s = await setup({
			disputeFreeze: { frozen: true, reason: 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح.', disputeId: 'dp-1' },
			stages: [stage(), stage({ id: 'st2', stageNumber: 2, status: 'submitted', canUploadDelivery: true })],
		});

		const banner = s.el.querySelector('[data-testid="provider-freeze-banner"]');
		expect(banner?.textContent).toContain('التسليم واعتماد المراحل وصرف الدفعات موقوفة');
		expect(banner?.textContent).not.toContain('يمكنك متابعة التسليم');
		expect(s.el.querySelector('[data-testid="provider-freeze-link"]')?.getAttribute('href')).toContain('/provider-overview/disputes/dp-1');
		expect(uploadButtons(s.el)).toHaveLength(0);
		expect(s.el.querySelector('[data-testid="upload-blocked-reason"]')?.textContent).toContain('نزاع مفتوح');
		expect(s.el.textContent).toContain('مراسلة العميل');

		s.c.setTab('miles');
		s.f.detectChanges();
		expect(uploadButtons(s.el)).toHaveLength(0);
		expect(s.el.textContent).toContain('مراسلة العميل');

		s.c.setTab('edits');
		s.f.detectChanges();
		expect(uploadButtons(s.el)).toHaveLength(0);
		expect(s.el.querySelector('[data-testid="upload-blocked-reason"]')?.textContent).toContain('نزاع مفتوح');
		expect(s.el.textContent).toContain('فتح المحادثة');
	});

	it('hasActiveDispute / OPEN disputeStatus / local disputeSubmitted block openDelivery and submitDelivery without posting', async () => {
		const s = await setup({ hasActiveDispute: true, disputeStatus: 'OPEN' });
		const st = s.c.projectData().stages[0];

		expect(uploadButtons(s.el)).toHaveLength(0);
		s.c.openDelivery(st);
		expect(s.c.deliveryStage()).toBeNull();
		expect(s.c.error()).toContain('نزاع مفتوح');

		// Guard also prevents submitting if delivery modal was already open before dispute triggered
		s.c.deliveryStage.set(st);
		s.c.deliveryStep.set(2);
		s.c.deliveryNote = 'وصف التسليم المكتمل للمرحلة الأولى';
		s.c.deliveryLinks = 'https://example.com/delivery';
		s.f.detectChanges();

		const submitBtn = s.el.querySelector('[data-testid="submit-delivery-btn"]') as HTMLButtonElement | null;
		expect(submitBtn?.disabled).toBe(true);
		s.c.submitDelivery();
		expect(s.post).not.toHaveBeenCalled();
	});

	it('disputeSubmitted set locally immediately after provider opens a dispute stops delivery before reload', async () => {
		const s = await setup();
		expect(uploadButtons(s.el).length).toBeGreaterThan(0);

		s.c.disputeSubmitted.set(true);
		s.f.detectChanges();

		expect(uploadButtons(s.el)).toHaveLength(0);
		expect(s.el.querySelector('[data-testid="provider-freeze-banner"]')).not.toBeNull();
	});

	it('mutual cancellation stops delivery immediately when request is sent (PENDING_OTHER_PARTY) and when agreed (AGREED_PENDING_SETTLEMENT)', async () => {
		const pending = await setup({}, [cancelReq('PENDING_OTHER_PARTY')]);
		expect(uploadButtons(pending.el)).toHaveLength(0);
		expect(pending.el.querySelector('[data-testid="provider-freeze-banner"]')?.textContent).toContain('إلغاء بالتراضي');
		pending.c.openDelivery(pending.c.projectData().stages[0]);
		expect(pending.c.deliveryStage()).toBeNull();
		expect(pending.post).not.toHaveBeenCalled();

		TestBed.resetTestingModule();
		const agreed = await setup({}, [cancelReq('AGREED_PENDING_SETTLEMENT')]);
		expect(uploadButtons(agreed.el)).toHaveLength(0);
		expect(agreed.el.querySelector('[data-testid="provider-freeze-banner"]')?.textContent).toContain('إلغاء المشروع بالتراضي');
	});

	it('resumes allowing delivery if mutual cancellation is rejected/withdrawn and ignores closed RESOLVED/REJECTED disputeStatus', async () => {
		const s = await setup({ disputeStatus: 'RESOLVED' }, [cancelReq('REJECTED')]);
		expect(s.c.deliveryFreezeReason(s.c.projectData())).toBeNull();
		expect(uploadButtons(s.el).length).toBeGreaterThan(0);

		s.c.onCancelRequestChange(cancelReq('WITHDRAWN') as any);
		s.f.detectChanges();
		expect(uploadButtons(s.el).length).toBeGreaterThan(0);
	});
});
