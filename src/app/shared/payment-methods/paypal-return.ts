import { isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PaymentMethodsApi, paymentMethodsPath, PaymentRole } from '../../core/services/payment-methods-api.service';
import { PAYPAL_PENDING_KEY } from './payment-methods';

@Component({ selector: 'app-paypal-return', standalone: true, imports: [RouterLink],
  template: `<main class="payment-page" dir="rtl"><section class="form-panel"><h1>ربط حساب PayPal</h1><p role="status">{{ message() }}</p><a [routerLink]="back()">العودة إلى طرق الدفع</a></section></main>`, styleUrl: './payment-methods.scss' })
export class PaypalReturn implements OnInit {
  private readonly api = inject(PaymentMethodsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly platform = inject(PLATFORM_ID);
  private readonly destroy = inject(DestroyRef);
  readonly message = signal('جارٍ تأكيد الحساب لدى PayPal…');
  readonly back = signal('/');
  ngOnInit() {
    if (!isPlatformBrowser(this.platform)) return;
    const query = this.route.snapshot.queryParamMap;
    // Remove authorization material from the address/history before loading any further page.
    history.replaceState(history.state, '', location.pathname);
    let pending: { role: PaymentRole; state: string; at: number } | null = null;
    try { pending = JSON.parse(sessionStorage.getItem(PAYPAL_PENDING_KEY) || 'null'); sessionStorage.removeItem(PAYPAL_PENDING_KEY); } catch { /* storage unavailable: refuse */ }
    if (pending && ['CLIENT', 'PROVIDER', 'AFFILIATE'].includes(pending.role)) this.back.set(paymentMethodsPath(pending.role));
    if (query.has('error')) { this.message.set('لم يكتمل ربط الحساب. يمكنك البدء مجددًا من طرق الدفع.'); return; }
    const code = query.get('code'), state = query.get('state');
    if (!pending || !['CLIENT', 'PROVIDER', 'AFFILIATE'].includes(pending.role) || !state || pending.state !== state || !code || Date.now() - pending.at > 600_000 || pending.at > Date.now()) {
      this.message.set('محاولة الربط غير صالحة أو منتهية. ابدأ الربط مجددًا بنفس الحساب والدور.'); return;
    }
    this.api.complete(pending.role, code, state).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => this.message.set('تم حفظ ربط PayPal. ارجع إلى طرق الدفع لمراجعة حالة البريد وتأكيده للسحب إذا لزم.'),
      error: (e: any) => this.message.set(typeof e?.error?.message === 'string' ? e.error.message : 'تعذر تأكيد الربط. ارجع إلى طرق الدفع وابدأ محاولة جديدة.'),
    });
  }
}
