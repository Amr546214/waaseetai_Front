import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SaCancellationRequests } from './sa-cancellation-requests';

const ITEM = (o: Record<string, unknown> = {}) => ({ id: 'r1', contractRef: 'CT-ABC', projectTitle: 'مشروع', clientName: 'عميل', providerName: 'مزود', requestedByRole: 'CLIENT', reason: 'سبب', note: null, status: 'ACCEPTED', statusLabel: 'وافق الطرفان على الإلغاء', contractStatus: 'ACTIVE', createdAt: '2026-11-05T10:00:00Z', respondedAt: null, responseNote: null, settlementLabel: 'التسوية المالية بانتظار قرار الإدارة ولم يُنقل أي مبلغ', moneyNote: 'لا يُنقل أي مبلغ', ...o });

describe('SaCancellationRequests (admin, read-only)', () => {
	async function setup(list: any, id: string | null = null, getRes: any = of({ data: ITEM({ financial: { contractPrice: 20, escrowAmount: 20, escrowReleased: 10, escrowHeld: 10 } }) })) {
		const http = { get: vi.fn((url: string) => (String(url).endsWith('/r1') ? getRes : list)), post: vi.fn() };
		await TestBed.configureTestingModule({ imports: [SaCancellationRequests], providers: [provideRouter([]), { provide: HttpClient, useValue: http }, { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } }] }).compileComponents();
		const f = TestBed.createComponent(SaCancellationRequests); f.detectChanges(); await f.whenStable(); f.detectChanges();
		return { f, http, el: f.nativeElement as HTMLElement, q: (t: string) => (f.nativeElement as HTMLElement).querySelector(`[data-testid="${t}"]`) as HTMLElement | null };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('lists the real requests, says approval and money are not active, and has no write control', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: { ACCEPTED: 1 }, pagination: {} } }));
		expect(s.el.querySelectorAll('[data-testid="cr-item"]')).toHaveLength(1); expect(s.q('cr-admin-note')!.textContent).toContain('غير مُفعَّلين');
		expect(s.el.querySelectorAll('button').length).toBe(5 + 1); // 5 filter tabs + the one list card; nothing else is clickable
		expect(s.http.post).not.toHaveBeenCalled();
	});
	it('opening an item (also by direct URL id) shows the escrow facts and the settlement-pending line', async () => {
		const s = await setup(of({ data: { items: [ITEM()], counts: {}, pagination: {} } }), 'r1');
		expect(s.q('cr-detail')).not.toBeNull(); expect(s.q('cr-financial')!.textContent).toContain('محتجز'); expect(s.q('cr-settlement')!.textContent).toContain('لم يُنقل أي مبلغ');
	});
	it('empty and error states are explicit', async () => {
		expect((await setup(of({ data: { items: [], counts: {}, pagination: {} } }))).q('cr-empty')).not.toBeNull();
		TestBed.resetTestingModule();
		const e = await setup(throwError(() => ({ error: { message: 'ممنوع' } }))); expect(e.el.textContent).toContain('ممنوع');
	});
});
