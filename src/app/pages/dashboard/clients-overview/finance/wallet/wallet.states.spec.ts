import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Wallet } from './wallet';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';

// Every wallet row has a clear state: completed, held in escrow, processing, or FAILED (a PayPal deposit that did not complete — no money moved).
const tx = (o: any) => ({ id: 'x', type: 'DEPOSIT', amount: 10, currency: 'USD', status: 'COMPLETED', paymentMethod: 'PAYPAL', referenceId: null, description: 'd', createdAt: '2026-10-01T10:00:00Z', ...o });

function setup(transactions: any[]) {
	TestBed.configureTestingModule({
		imports: [Wallet],
		providers: [provideRouter([]), { provide: ClientFinanceService, useValue: { getWallet: () => of({ success: true, data: { summary: { availableBalance: 40, escrowBalance: 0, activeProjectsCount: 0 }, transactions } }) } }]
	});
	const fixture = TestBed.createComponent(Wallet);
	fixture.detectChanges();
	return fixture.componentInstance;
}

describe('client wallet — row states', () => {
	it('shows the real balance from the server', () => {
		const c = setup([]);
		expect(c.balance()).toBe(40);
	});

	it('a FAILED deposit says "فشلت", has no sign and is styled as failed', () => {
		const c = setup([tx({ id: 'paypal-failed-1', status: 'FAILED', amount: 100, description: 'محاولة إيداع عبر PayPal لم تكتمل' })]);
		const row = c.transactions()[0];
		expect(row.status).toBe('فشلت');
		expect(row.statusType).toBe('failed');
		expect(row.amount).toBe('100 $');
	});

	it('a wallet payment stored negative shows ONE minus sign', () => {
		const row = setup([tx({ type: 'ORDER_PAYMENT', amount: -18, paymentMethod: 'WALLET' })]).transactions()[0];
		expect(row.direction).toBe('out');
		expect(row.amount).toBe('-18 $');
	});

	it('a refund is money coming back (+), a held escrow is "محجوز", anything else is "قيد المعالجة"', () => {
		const rows = setup([
			tx({ id: 'r', type: 'REFUND', amount: 25 }),
			tx({ id: 'h', type: 'ESCROW_LOCK', status: 'HELD', amount: 50 }),
			tx({ id: 'p', status: 'PENDING' })
		]).transactions();
		expect(rows[0].direction).toBe('in');
		expect(rows[0].amount).toBe('+25 $');
		expect(rows[1].status).toBe('محجوز');
		expect(rows[2].status).toBe('قيد المعالجة');
	});
});
