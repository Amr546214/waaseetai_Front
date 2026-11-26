import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize, Observable } from 'rxjs';
import { PaymentMethodsApi, PaymentMethodsState, PaymentRole, SavedPaymentMethod } from '../../core/services/payment-methods-api.service';

export const PAYPAL_PENDING_KEY = 'waseet.paypal.connect.pending';

@Component({
  selector: 'app-payment-methods', standalone: true, imports: [ReactiveFormsModule],
  templateUrl: './payment-methods.html', styleUrl: './payment-methods.scss',
})
export class PaymentMethods implements OnInit {
  private readonly api = inject(PaymentMethodsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly platform = inject(PLATFORM_ID);
  private readonly fb = inject(FormBuilder);
  readonly role = this.route.snapshot.data['paymentRole'] as PaymentRole;
  readonly state = signal<PaymentMethodsState | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly bankOpen = signal(false);
  readonly removeTarget = signal<SavedPaymentMethod | null>(null);
  readonly otpMethod = signal<SavedPaymentMethod | null>(null);
  readonly otpHint = signal('');
  readonly resendAt = signal(0);
  readonly bankForm = this.fb.nonNullable.group({
    accountHolder: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(160)]],
    iban: ['', [Validators.required, Validators.maxLength(64)]],
    label: ['', Validators.maxLength(60)],
  });
  readonly otpForm = this.fb.nonNullable.group({ code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });

  ngOnInit() { if (isPlatformBrowser(this.platform)) this.load(); }
  private message(error: any): string { return typeof error?.error?.message === 'string' ? error.error.message : 'تعذر إتمام العملية، يرجى المحاولة مجددًا'; }
  private run<T>(request: Observable<T>, done: (value: T) => void) {
    if (this.busy()) return;
    this.busy.set(true); this.error.set(''); this.notice.set(''); this.fieldErrors.set({});
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.busy.set(false))).subscribe({ next: done, error: e => {
      this.error.set(this.message(e));
      const fields: Record<string, string> = {};
      for (const item of Array.isArray(e?.error?.errors) ? e.error.errors : []) {
        if (['accountHolder', 'iban', 'label', 'code'].includes(item?.field) && typeof item?.message === 'string') fields[item.field] = item.message;
      }
      this.fieldErrors.set(fields);
    } });
  }
  load() {
    if (this.busy()) return;
    this.loading.set(true); this.error.set(''); this.state.set(null);
    this.api.list(this.role).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({ next: value => this.state.set(value), error: e => this.error.set(this.message(e)) });
  }
  status(method: SavedPaymentMethod) {
    return ({ UNVERIFIED: 'محفوظ — لم تُتحقق الملكية', EMAIL_UNCONFIRMED: 'الحساب مرتبط — البريد غير مؤكَّد', CONNECTED: 'تم ربط حساب PayPal', NEEDS_ACTIVATION: 'مرتبط — أكمل تأكيد بريد السحب' })[method.status];
  }
  connectPaypal() {
    const origin = this.state()?.capabilities.paypalConnectOrigin;
    if (origin && origin !== location.origin) {
      try {
        const target = new URL(origin);
        if (target.protocol !== 'https:' || !['dev.waseetai.com', 'waseetai.com', 'www.waseetai.com'].includes(target.hostname) || target.origin !== origin) throw new Error();
        // Canonicalize BEFORE creating an attempt: the return page needs the same sessionStorage origin.
        location.assign(`${target.origin}${this.role === 'CLIENT' ? '/client-overview' : this.role === 'PROVIDER' ? '/provider-overview' : '/marketer-overview'}/finance/payment-methods`);
      } catch { this.error.set('تعذر فتح صفحة ربط PayPal، أعد المحاولة'); }
      return;
    }
    this.run(this.api.start(this.role), value => {
      try {
        const url = new URL(value.url);
        if (url.protocol !== 'https:' || !['www.paypal.com', 'www.sandbox.paypal.com'].includes(url.hostname) || url.pathname !== '/connect' || !url.searchParams.get('state') || new URL(url.searchParams.get('redirect_uri') || '').origin !== location.origin) throw new Error();
        sessionStorage.setItem(PAYPAL_PENDING_KEY, JSON.stringify({ role: this.role, state: url.searchParams.get('state'), at: Date.now() }));
        location.assign(url.toString());
      } catch { this.error.set('تعذر فتح صفحة PayPal، أعد المحاولة'); }
    });
  }
  newBank() { this.bankForm.reset(); this.bankOpen.set(true); this.error.set(''); this.notice.set(''); this.fieldErrors.set({}); }
  editBank(method: SavedPaymentMethod) {
    this.run(this.api.detail(this.role, method.id), value => { this.bankForm.reset({ accountHolder: value.accountHolder, iban: value.iban, label: value.label || '' }); this.bankOpen.set(true); });
  }
  saveBank() {
    if (this.bankForm.invalid) { this.bankForm.markAllAsTouched(); return; }
    this.run(this.api.bank(this.role, this.bankForm.getRawValue()), value => { this.state.set(value); this.bankOpen.set(false); this.bankForm.reset(); this.notice.set('تم حفظ حساب الراجحي. لم يتم التحقق من الملكية، والتحويل البنكي غير متاح حاليًا.'); });
  }
  activate(method: SavedPaymentMethod) {
    this.run(this.api.activate(this.role, method.id), value => {
      if (value.otpRequired) { this.otpMethod.set(method); this.otpHint.set(value.emailHint || 'بريد حسابك'); this.resendAt.set(Date.parse(value.resendAvailableAt || '') || 0); this.otpForm.reset(); }
      else { this.state.set(value); this.notice.set('تم تأكيد بريد السحب من حساب PayPal المرتبط'); }
    });
  }
  confirmOtp() {
    const method = this.otpMethod();
    if (!method || this.otpForm.invalid) { this.otpForm.markAllAsTouched(); return; }
    this.run(this.api.confirm(this.role, method.id, this.otpForm.getRawValue().code), value => { this.state.set(value); this.otpMethod.set(null); this.notice.set('تم تأكيد بريد PayPal. يظل تجميد السحب لمدة 24 ساعة مطبقًا حسب سياسة الحساب.'); });
  }
  canResend() { return Date.now() >= this.resendAt(); }
  setDefault(method: SavedPaymentMethod) { this.run(this.api.makeDefault(this.role, method.id), value => { this.state.set(value); this.notice.set('تم تعيين الطريقة الافتراضية'); }); }
  remove() {
    const method = this.removeTarget(); if (!method) return;
    this.run(this.api.remove(this.role, method.id), value => { this.state.set(value); this.removeTarget.set(null); this.notice.set(method.kind === 'PAYPAL' ? 'تم فصل الربط. بريد السحب المحفوظ ظاهر الآن كغير مرتبط.' : 'تمت إزالة الحساب البنكي'); });
  }
}
