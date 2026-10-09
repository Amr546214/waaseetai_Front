import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect } from 'vitest';
import { SaWithdrawals } from './sa-withdrawals';
import { SaWithdrawalDetail } from './sa-withdrawal-detail/sa-withdrawal-detail';
import { WithdrawalApiService } from '../../../../core/services/withdrawal-api.service';
import { LEGACY_WITHDRAWAL_LABEL } from '../../../../core/models/withdrawal.model';

// PayPal is the only money method: an old row (bank_transfer + bank data) must never show its destination.
const LEGACY_ROW: any = {
	id: 'wd-legacy-0001', userName: 'مقدم قديم', amount: 100, currency: 'USD', status: 'PENDING', method: 'bank_transfer',
	bankInfo: { bankName: 'بنك الاختبار', accountHolderName: 'صاحب حساب', iban: 'SA0380000000608010167519', swiftCode: 'TESTSWFT' },
	iban: 'SA0380000000608010167519', accountName: 'صاحب حساب',
};
const PAYPAL_ROW: any = { id: 'wd-paypal-0002', userName: 'مقدم جديد', amount: 50, currency: 'USD', status: 'PENDING', method: 'paypal', paypalEmail: 'seller@example.com' };

function expectNoBank(text: string) {
	expect(text).not.toContain('SA0380000000608010167519');
	expect(text).not.toContain('IBAN');
	expect(text).not.toContain('بنك الاختبار');
	expect(text).not.toContain('صاحب حساب');
	expect(text).not.toContain('SWIFT');
	expect(text).not.toContain('bank_transfer');
}

describe('SaWithdrawals — PayPal-only destination', () => {
	function setup(rows: any[]) {
		const api: Partial<WithdrawalApiService> = {
			getAdminWithdrawals: () => of({ success: true, data: { withdrawals: rows } } as any),
		};
		TestBed.configureTestingModule({
			imports: [SaWithdrawals],
			providers: [provideRouter([]), { provide: WithdrawalApiService, useValue: api }],
		});
		const fixture = TestBed.createComponent(SaWithdrawals);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('an old bank row shows the neutral label and none of its bank data', () => {
		const el = setup([LEGACY_ROW]);
		expect(el.querySelector('[data-testid="wd-legacy-destination"]')?.textContent).toContain(LEGACY_WITHDRAWAL_LABEL);
		expectNoBank(el.textContent || '');
	});

	it('a paypal row shows its PayPal email and no legacy label', () => {
		const el = setup([PAYPAL_ROW]);
		expect(el.querySelector('[data-testid="wd-paypal-destination"]')?.textContent).toContain('seller@example.com');
		expect(el.querySelector('[data-testid="wd-legacy-destination"]')).toBeNull();
	});
});

describe('SaWithdrawalDetail — PayPal-only destination', () => {
	function setup(row: any) {
		const api: Partial<WithdrawalApiService> = {
			getAdminWithdrawal: () => of({ success: true, data: row } as any),
		};
		const route = { paramMap: of(convertToParamMap({ id: row.id })), snapshot: { paramMap: convertToParamMap({ id: row.id }) } };
		TestBed.configureTestingModule({
			imports: [SaWithdrawalDetail],
			providers: [provideRouter([]), { provide: ActivatedRoute, useValue: route }, { provide: WithdrawalApiService, useValue: api }],
		});
		const fixture = TestBed.createComponent(SaWithdrawalDetail);
		fixture.detectChanges();
		return fixture.nativeElement as HTMLElement;
	}

	it('an old bank row shows the neutral label and none of its bank data', () => {
		const el = setup(LEGACY_ROW);
		expect(el.querySelector('[data-testid="wd-legacy-destination"]')?.textContent).toContain(LEGACY_WITHDRAWAL_LABEL);
		const text = el.textContent || '';
		expectNoBank(text);
		expect(text).not.toContain('تحويل بنكي');
	});

	it('a paypal row shows its PayPal email', () => {
		const el = setup(PAYPAL_ROW);
		expect(el.querySelector('[data-testid="wd-paypal-destination"]')?.textContent).toContain('seller@example.com');
		expect(el.querySelector('[data-testid="wd-legacy-destination"]')).toBeNull();
	});
});
