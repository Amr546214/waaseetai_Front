import { TestBed } from '@angular/core/testing';
import { ProviderDepositModal } from './deposit-modal';

// Provider wallet deposit dialog: no provider deposit exists yet and only PayPal is supported, so the
// method is disabled and the confirm button cannot be used.
describe('ProviderDepositModal (PayPal only, disabled for now)', () => {
  it('PayPal is the only method and it is disabled with the "غير متاح حاليًا" label', () => {
    const fixture = TestBed.createComponent(ProviderDepositModal);
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.dpm-method'));
    expect(buttons.map((b) => b.dataset['method'])).toEqual(['paypal']);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons[0].textContent).toContain('غير متاح حاليًا');
  });

  it('confirming does nothing', () => {
    const fixture = TestBed.createComponent(ProviderDepositModal);
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.dpm-btn-pri')!;
    expect(btn.disabled).toBe(true);
    fixture.componentInstance.onConfirm();
    fixture.componentInstance.selectMethod('paypal');
    expect(confirmed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedMethod()).toBe('paypal');
  });
});
