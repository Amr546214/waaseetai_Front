import { TestBed } from '@angular/core/testing';
import { ProviderDepositModal } from './deposit-modal';

// Provider wallet deposit dialog: no provider deposit exists yet and only PayPal is supported, so every
// method is disabled and the confirm button cannot be used.
describe('ProviderDepositModal (all methods disabled for now)', () => {
  it('card, bank transfer and PayPal are disabled, with "غير متاح حاليًا" / "قريبًا" labels', () => {
    const fixture = TestBed.createComponent(ProviderDepositModal);
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.dpm-method'));
    expect(buttons.map((b) => b.dataset['method'])).toEqual(['card', 'bank', 'paypal']);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons[0].textContent).toContain('غير متاح حاليًا');
    expect(buttons[1].textContent).toContain('غير متاح حاليًا');
    expect(buttons[2].textContent).toContain('قريبًا');
  });

  it('confirming does nothing', () => {
    const fixture = TestBed.createComponent(ProviderDepositModal);
    const confirmed = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.detectChanges();
    const btn = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.dpm-btn-pri')!;
    expect(btn.disabled).toBe(true);
    fixture.componentInstance.onConfirm();
    fixture.componentInstance.selectMethod('bank');
    expect(confirmed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.selectedMethod()).toBe('paypal');
  });
});
