import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ProviderDepositModal } from './deposit-modal';

describe('ProviderDepositModal: no ready-made amount', () => {
	function mount() {
		(Element.prototype as any).scrollIntoView = vi.fn();
		const f = TestBed.createComponent(ProviderDepositModal);
		f.componentInstance.currentBalance = 120;
		f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement, c: f.componentInstance };
	}
	afterEach(() => TestBed.resetTestingModule());

	it('the amount starts empty with guidance text, there are no fixed amount chips, and the summary shows no invented deposit', () => {
		const { el, c } = mount();
		const input = el.querySelector('#dpmAmt') as HTMLInputElement;
		expect(c.amount()).toBeNull();
		expect(input.value).toBe('');
		expect(input.getAttribute('placeholder')).toBe('أدخل المبلغ بالدولار');
		expect(el.querySelectorAll('.dpm-chip').length).toBe(0);
		expect(el.querySelector('.dpm-summary-row:nth-child(2)')!.textContent).toContain('—');
		expect(c.balanceAfter()).toBe(120);
		expect(el.querySelector('[data-testid=dpm-amount-error]')).toBeNull();
	});

	it('an amount below the real minimum shows its message at the field (aria-invalid + role=alert); empty is not treated as 0', () => {
		const { f, el, c } = mount();
		const input = el.querySelector('#dpmAmt') as HTMLInputElement;
		input.value = '10'; input.dispatchEvent(new Event('input')); f.detectChanges();
		expect(input.getAttribute('aria-invalid')).toBe('true');
		const msg = document.getElementById(input.getAttribute('aria-describedby')!)!;
		expect(msg.getAttribute('role')).toBe('alert');
		expect(msg.textContent).toContain('50');
		input.value = ''; input.dispatchEvent(new Event('input')); f.detectChanges();
		expect(c.amount()).toBeNull();
		expect(input.getAttribute('aria-invalid')).toBeNull();
	});

	it('confirm with an empty amount asks for it at the field and emits nothing', () => {
		const { f, el, c } = mount();
		const confirmed = vi.fn(); c.confirmed.subscribe(confirmed);
		c.onConfirm(); f.detectChanges();
		expect(confirmed).not.toHaveBeenCalled();
		expect(el.querySelector('[data-testid=dpm-amount-error]')!.textContent).toContain('أدخل مبلغ الإيداع');
		expect((el.querySelector('#dpmAmt') as HTMLInputElement).getAttribute('aria-invalid')).toBe('true');
	});
});
