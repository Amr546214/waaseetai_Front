import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Withdraw } from './withdraw';
import { WithdrawalApiService } from '../../../../../core/services/withdrawal-api.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { expectFocused, httpFail, settleForm } from '../../../../../shared/forms/form-spec-utils';

describe('provider withdraw: form wiring and no ready-made amounts', () => {
	let fixture: ComponentFixture<Withdraw>;
	let submit: ReturnType<typeof vi.fn>;
	const el = () => fixture.nativeElement as HTMLElement;
	const amt = () => el().querySelector('#wdAmt') as HTMLInputElement;
	const typeAmt = (v: string) => { amt().value = v; amt().dispatchEvent(new Event('input')); fixture.detectChanges(); };
	const btn = () => el().querySelector('.wd-btn-pri') as HTMLButtonElement;

	async function setup(email: string | null, balance: number, submitImpl: () => any = () => of({ success: true })) {
		submit = vi.fn(submitImpl);
		(Element.prototype as any).scrollIntoView = vi.fn();
		await TestBed.configureTestingModule({
			imports: [Withdraw],
			providers: [
				provideRouter([]),
				{ provide: AuthStore, useValue: { currentUser: () => ({ accountType: 'PROVIDER_INDIVIDUAL' }) } },
				{ provide: ProviderProfileService, useValue: { getProfile: () => of({ paypalPayoutEmail: email }) } },
				{ provide: WithdrawalApiService, useValue: {
					getProviderWallet: () => of({ data: { summary: { availableBalance: balance, totalEarnings: balance, escrowBalance: 0, currency: 'USD' } } }),
					getProviderWithdrawals: () => of({ data: { withdrawals: [], pagination: { total: 0, totalPages: 1 } } }),
					submitProviderWithdrawal: submit,
				} },
			],
		}).compileComponents();
		fixture = TestBed.createComponent(Withdraw);
		fixture.detectChanges(); await fixture.whenStable(); fixture.detectChanges();
	}
	afterEach(() => TestBed.resetTestingModule());

	it('numeric default: the amount starts EMPTY with guidance text, and no fixed 500/1,000/2,500/5,000 chips exist', async () => {
		await setup('me@example.com', 4000);
		expect(amt().value).toBe('');
		expect(fixture.componentInstance.amount()).toBeNull();
		expect(amt().getAttribute('placeholder')).toBe('أدخل المبلغ (USD)');
		const chips = Array.from(el().querySelectorAll('.wd-quick-btn')).map(b => b.textContent!.trim());
		expect(chips).toEqual(['25%', '50%', '75%', 'الحد الأقصى']);
		(el().querySelectorAll('.wd-quick-btn')[1] as HTMLButtonElement).click();
		expect(fixture.componentInstance.amount()).toBe(2000);
	});

	it('with no available balance there are no share chips (only the max button)', async () => {
		await setup('me@example.com', 0);
		expect(Array.from(el().querySelectorAll('.wd-quick-btn')).map(b => b.textContent!.trim())).toEqual(['الحد الأقصى']);
	});

	it('empty submit: aria-invalid + describedby -> role=alert message, focus on the amount, no request', async () => {
		await setup('me@example.com', 500);
		btn().click(); fixture.detectChanges(); await settleForm(); fixture.detectChanges();
		expect(submit).not.toHaveBeenCalled();
		expectFocused(amt());
		expect(amt().getAttribute('aria-invalid')).toBe('true');
		const msg = document.getElementById(amt().getAttribute('aria-describedby')!)!;
		expect(msg.getAttribute('role')).toBe('alert');
		expect(msg.textContent).toContain('المبلغ مطلوب');
		typeAmt('100');
		expect(amt().getAttribute('aria-invalid')).toBeNull();
	});

	it('no PayPal email: the message sits at the PayPal field, which gets focus when the amount is fine', async () => {
		await setup(null, 500);
		typeAmt('100');
		btn().click(); fixture.detectChanges(); await settleForm(); fixture.detectChanges();
		expect(submit).not.toHaveBeenCalled();
		const target = el().querySelector('#wdPaypal') as HTMLElement;
		expectFocused(target);
		expect(el().querySelector('.wd-field-err[role=alert]')!.textContent).toContain('أضف بريد PayPal');
	});

	it('backend 422 naming the amount lands at the amount field and keeps what was typed', async () => {
		await setup('me@example.com', 500, () => throwError(() => httpFail(422, { errors: [{ field: 'amount', message: 'المبلغ أقل من الحد الأدنى للسحب' }] })));
		typeAmt('5');
		btn().click(); fixture.detectChanges(); await settleForm(); fixture.detectChanges();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(el().querySelector('[data-testid=wd-amount-error]')!.textContent).toContain('أقل من الحد الأدنى');
		expect(amt().getAttribute('aria-invalid')).toBe('true');
		expectFocused(amt());
		expect(amt().value).toBe('5');
		expect(fixture.componentInstance.submitting()).toBe(false);
	});

	it('429 / network / 500 stay the generic banner and never mark the amount', async () => {
		for (const status of [429, 0, 500]) {
			await setup('me@example.com', 500, () => throwError(() => httpFail(status, { message: 'Too many requests, try again after 15 minutes' })));
			typeAmt('100');
			btn().click(); fixture.detectChanges(); await settleForm(); fixture.detectChanges();
			expect(el().querySelector('[data-testid=wd-submit-error]')!.textContent!.trim().length).toBeGreaterThan(5);
			expect(el().querySelector('[data-testid=wd-amount-error]')).toBeNull();
			expect(amt().getAttribute('aria-invalid')).toBeNull();
			TestBed.resetTestingModule();
		}
	});

	it('double click while the request is in flight sends ONE request and disables the button', async () => {
		const pending = new Subject<any>();
		await setup('me@example.com', 500, () => pending);
		typeAmt('100');
		btn().click(); fixture.detectChanges(); btn().click(); fixture.componentInstance.submit();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(btn().disabled).toBe(true);
		pending.next({ success: true }); pending.complete();
	});
});
