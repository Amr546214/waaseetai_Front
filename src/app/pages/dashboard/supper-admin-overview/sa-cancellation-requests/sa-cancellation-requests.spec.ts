import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaCancellationRequests } from './sa-cancellation-requests';

const ITEM = (o: Record<string, unknown> = {}) => ({ id: 'r1', contractRef: 'CT-ABC', projectTitle: 'مشروع', clientName: 'عميل', providerName: 'مزود', requestedByRole: 'CLIENT', reason: 'سبب', note: null, status: 'AGREED_PENDING_SETTLEMENT', statusLabel: 'تم الاتفاق — بانتظار التسوية', contractStatus: 'ACTIVE', createdAt: '2026-11-05T10:00:00Z', respondedAt: null, responseNote: null, settlementLabel: 'التسوية المالية بانتظار قرار الإدارة ولم يُنقل أي مبلغ', moneyNote: 'لا يُنقل أي مبلغ', ...o });

const PREVIEW = (o: Record<string, unknown> = {}) => ({ stages: [{ id: 's1', stepOrder: 1, title: 'المرحلة 1', amount: 10, status: 'APPROVED', paid: true }, { id: 's2', stepOrder: 2, title: 'المرحلة 2', amount: 10, status: 'PENDING', paid: false }], paidStagesTotal: 10, unapprovedStagesTotal: 10, contractPrice: 20, escrowAmount: 20, escrowReleased: 10, heldAmount: 10, commissionRatePercent: 12.75, canSettle: true, blockedReason: null, viewerHoldsFinancialPermission: true, ...o });

describe('SaCancellationRequests (admin, read-only)', () => {
	async function setup(list: any, id: string | null = null, getRes: any = of({ data: ITEM({ settlementPreview: PREVIEW() }) })) {
		const http = { get: vi.fn((url: string) => (String(url).endsWith('/r1') ? getRes : list)), post: vi.fn() };
		await TestBed.configureTestingModule({ imports: [SaCancellationRequests], providers: [provideRouter([]), { provide: HttpClient, useValue: http }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }] }).compileComponents();
		const f = TestBed.createComponent(SaCancellationRequests); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, http, el: f.nativeElement as HTMLElement, q: (t: string) => (f.nativeElement as HTMLElement).querySelector(`[data-testid="${t}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('lists the real requests, says approval and money are not active, and has no settle control until an item is opened', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: { ACCEPTED: 1 }, pagination: {} } }));
		expect(s.el.querySelectorAll('[data-testid="cr-item"]')).toHaveLength(1); expect(s.q('cr-admin-note')!.textContent).toContain('الاتفاق وحده لا ينقل أي مبلغ');
		expect(s.el.querySelectorAll('button').length).toBe(6 + 1); // 6 filter tabs + the one list card; no settle control until an item is opened
		expect(s.q('cr-settle-form')).toBeNull();
		expect(s.http.post).not.toHaveBeenCalled();
	});
	it('opening an item (also by direct URL id) shows the escrow facts and the settlement-pending line', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: {}, pagination: {} } }), 'r1');
		expect(s.q('cr-detail')).not.toBeNull(); expect(s.q('cr-financial')).not.toBeNull(); expect(s.q('cr-settlement')!.textContent).toContain('لم يُنقل أي مبلغ');
	});
	it('empty and error states are explicit', async () => {
		expect((await setup(of({ data: { items: [], counts: {}, pagination: {} } }))).q('cr-empty')).not.toBeNull();
		TestBed.resetTestingModule();
		const e = await setup(throwError(() => ({ error: { message: 'ممنوع' } }))); expect(e.el.textContent).toContain('ممنوع');
	});

	it('settlement screen: shows paid / unapproved stages and the REAL remaining escrow; refund is shown before confirming; confirm posts explicit amounts once', async () => {
		const post = vi.fn(() => of({ data: ITEM({ status: 'SETTLED' }) }));
		const s = await setup(of({ data: { items: [ITEM()], counts: {}, pagination: {} } }), 'r1'); (s.http as any).post = post;
		expect(s.el.querySelectorAll('[data-testid="cr-stage"]').length).toBe(2); expect(s.q('cr-paid')!.textContent).toContain('10'); expect(s.q('cr-unapproved')!.textContent).toContain('10'); expect(s.q('cr-held')!.textContent).toContain('10 $');
		const inp = s.q('cr-share') as HTMLInputElement; inp.value = '4'; inp.dispatchEvent(new Event('input')); s.f.detectChanges(); expect(s.q('cr-refund')!.textContent).toContain('6 $');
		(s.q('cr-review') as HTMLButtonElement).click(); s.f.detectChanges(); expect(s.q('cr-form-error')!.textContent).toContain('10 أحرف'); expect(post).not.toHaveBeenCalled();
		const rs = s.q('cr-reason') as HTMLTextAreaElement; rs.value = 'قرار الإدارة بعد مراجعة المراحل'; rs.dispatchEvent(new Event('input')); (s.q('cr-review') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('cr-confirm-text')!.textContent).toContain('4 $'); expect(post).not.toHaveBeenCalled();
		(s.q('cr-confirm') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(post).toHaveBeenCalledTimes(1); expect(post.mock.calls[0]).toEqual([expect.stringContaining('/admin/cancellation-requests/r1/settle'), { releaseToProvider: 4, expectedHeldAmount: 10, reason: 'قرار الإدارة بعد مراجعة المراحل' }]);
	});
	it('without the financial permission the form is disabled and says why; an amount above the remainder is refused client-side', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: {}, pagination: {} } }), 'r1', of({ data: ITEM({ settlementPreview: PREVIEW({ canSettle: false, viewerHoldsFinancialPermission: false, blockedReason: 'تنفيذ التسوية يتطلب صلاحيتي «حل النزاعات» و«إرسال الصرف» معًا' }) }) }));
		expect(s.q('cr-blocked')!.textContent).toContain('صلاحيتي'); expect((s.q('cr-review') as HTMLButtonElement).disabled).toBe(true); expect((s.q('cr-share') as HTMLInputElement).disabled).toBe(true);
		(s.f.componentInstance as any).share.set('11'); (s.f.componentInstance as any).reason.set('سبب كاف للقرار'); (s.f.componentInstance as any).review({ heldAmount: 10 }); expect((s.f.componentInstance as any).formError()).toContain('بين 0 و10'); expect((s.f.componentInstance as any).confirming()).toBe(false);
	});
	it('a refused settlement shows the server message and no success', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: {}, pagination: {} } }), 'r1'); (s.http as any).post = vi.fn(() => throwError(() => ({ status: 423, error: { message: 'يوجد نزاع مفتوح' } })));
		(s.f.componentInstance as any).share.set('1'); (s.f.componentInstance as any).reason.set('سبب كاف للقرار'); (s.f.componentInstance as any).review({ heldAmount: 10 }); s.f.detectChanges(); (s.q('cr-confirm') as HTMLButtonElement).click(); s.f.detectChanges();
		expect(s.q('cr-form-error')!.textContent).toContain('يوجد نزاع مفتوح');
	});
});
