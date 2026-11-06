import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TransactionDetails } from './transaction-details';
import { CLIENT_OVERVIEW_ROUTES } from '../../client.routes';

const base = { id: 'tx-1', type: 'DEPOSIT', amount: 50, currency: 'USD', status: 'COMPLETED', paymentMethod: 'PAYPAL', referenceId: 'CAP-1', description: 'إيداع', createdAt: '2026-02-01T10:00:00Z', project: null, escrow: null };

function setup(id = 'tx-1') {
	TestBed.configureTestingModule({
		imports: [TransactionDetails],
		providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', id]]) } } }]
	});
	const fixture = TestBed.createComponent(TransactionDetails);
	const http = TestBed.inject(HttpTestingController);
	fixture.detectChanges();
	return { fixture, http, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
}

describe('Client transaction details', () => {
	it('is routed at finance/wallet/:id and the old finance/transactions/:id redirects to it', () => {
		const routes: any[] = (CLIENT_OVERVIEW_ROUTES as any[]).flatMap(r => [r, ...(r.children ?? [])]);
		expect(routes.some(r => r.path === 'finance/wallet/:id' && r.loadComponent)).toBe(true);
		expect(routes.find(r => r.path === 'finance/transactions/:id')?.redirectTo).toBe('finance/wallet/:id');
	});

	it('reads the transaction by id from the server and shows amount, currency, status and reference', () => {
		const { fixture, http, el } = setup();
		http.expectOne(r => r.url.endsWith('/client/finance/wallet/transactions/tx-1')).flush({ success: true, data: base });
		fixture.detectChanges();
		const text = el.textContent!;
		expect(text).toContain('CAP-1'); expect(text).toContain('50'); expect(text).toContain('$'); expect(text).toContain('مكتمل'); expect(text).toContain('PayPal');
		expect(el.querySelector('[data-testid="txn-receipt"]')).toBeTruthy();
		expect(el.querySelector('[data-testid="txn-inquiry"]')).toBeTruthy();
		expect(el.querySelector('[data-testid="txn-escrow-note"]')).toBeNull();
	});

	it('a 404 (another account or unknown id) shows the not-found state, with no data', () => {
		const { fixture, http, el } = setup('other');
		http.expectOne(r => r.url.includes('/wallet/transactions/other')).flush({ success: false }, { status: 404, statusText: 'Not Found' });
		fixture.detectChanges();
		expect(el.textContent).toContain('تعذر العثور على هذه المعاملة');
		expect(el.querySelector('[data-testid="txn-receipt"]')).toBeNull();
	});

	it('a failed attempt has no receipt button; an escrow row shows the real held / released / remaining', () => {
		const a = setup();
		a.http.expectOne(() => true).flush({ success: true, data: { ...base, status: 'FAILED' } });
		a.fixture.detectChanges();
		expect(a.el.querySelector('[data-testid="txn-receipt"]')).toBeNull();
		expect(a.el.querySelector('[data-testid="txn-inquiry"]')).toBeTruthy();
		TestBed.resetTestingModule();
		const b = setup('escrow-e1');
		b.http.expectOne(() => true).flush({ success: true, data: { ...base, id: 'escrow-e1', type: 'ESCROW_LOCK', status: 'HELD', project: { id: "p1", title: "مشروع", providerName: "سارة م" }, escrow: { amount: 300, releasedAmount: 100, status: 'HELD' } } });
		b.fixture.detectChanges();
		const note = b.el.querySelector('[data-testid="txn-escrow-note"]')!.textContent!;
		expect(note).toContain('300'); expect(note).toContain('100'); expect(note).toContain('200');
		expect(b.el.querySelector('[data-testid="txn-project-link"]')?.textContent).toContain('مشروع');
	});

	it('inquiry opens the project messages for a project transaction and the support tickets for a wallet-only one', () => {
		const a = setup();
		const nav = vi.spyOn(a.router, 'navigate').mockResolvedValue(true);
		a.http.expectOne(() => true).flush({ success: true, data: { ...base, project: { id: 'p1', title: 'مشروع' } } });
		a.fixture.detectChanges();
		(a.el.querySelector('[data-testid="txn-inquiry"]') as HTMLElement).click();
		expect(nav.mock.lastCall![0]).toEqual(['/client-overview/messages']);
		TestBed.resetTestingModule();
		const b = setup();
		const nav2 = vi.spyOn(b.router, 'navigate').mockResolvedValue(true);
		b.http.expectOne(() => true).flush({ success: true, data: base });
		b.fixture.detectChanges();
		(b.el.querySelector('[data-testid="txn-inquiry"]') as HTMLElement).click();
		expect(nav2.mock.lastCall![0]).toEqual(['/client-overview/help/tickets/new']);
	});
});
