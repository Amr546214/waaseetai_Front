import { Component, ElementRef, inject, OnInit, signal, computed } from '@angular/core';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { MarketerOverviewService, MarketerSummary, MarketerWallet } from '../../../../core/services/marketer-overview.service';
import { Withdrawal } from '../../../../core/models/withdrawal.model';
import { mapHttpError } from '../../../../core/forms/http-error';
import { reportBackendError, reportProblems, FieldProblem, SubmitGuard } from '../../../../shared/forms/form-error-focus';
import { genericBanner } from '../../../../shared/forms/submit-feedback';
import { WaitTimerService, waitScope } from '../../../../core/wait/wait-timer.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { isRateLimitError, RATE_LIMIT_MESSAGE } from '../../../../core/utils/rate-limit.util';
import { rateLimitSentence } from '../../../../core/wait/wait-format';

/** The Arabic label and tone of every state a marketer's withdrawal can be in (the server has no separate "failed" state: a failed transfer stays "approved"). */
export const WITHDRAWAL_STATE: Record<string, { label: string; tone: 'blue' | 'green' | 'coral' | 'amber' }> = {
  PENDING: { label: 'بانتظار مراجعة الإدارة', tone: 'blue' },
  APPROVED: { label: 'معتمد', tone: 'blue' },
  PROCESSING: { label: 'قيد التحويل', tone: 'amber' },
  COMPLETED: { label: 'مدفوع', tone: 'green' },
  REJECTED: { label: 'مرفوض', tone: 'coral' },
  REVERSED: { label: 'أُعيد من PayPal', tone: 'coral' },
};

@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [WsDatePipe, MarketerLevelTagComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './withdraw.html',
  styleUrl: './withdraw.css',
})
export class Withdraw implements OnInit {
  private overviewService = inject(MarketerOverviewService);
  private fb = inject(FormBuilder);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();
  /** The server's wait after a 429 on a withdrawal request (money out). End timestamp, survives a refresh; disables ONLY the confirm button; nothing is re-sent at zero. */
  readonly withdrawWait = inject(WaitTimerService).track(waitScope('marketer-withdraw', inject(AuthStore).currentUser()?.id ?? ''));
  private readonly rateLimitedNoTime = signal(false);
  /** «طلبات كثيرة، يمكنك إعادة المحاولة بعد 1:23» (ticking) or the honest sentence without a number; '' when nothing waits. */
  readonly rateLimitText = computed(() => this.withdrawWait.active() ? rateLimitSentence(this.withdrawWait.remainingSeconds(), true) : this.rateLimitedNoTime() ? RATE_LIMIT_MESSAGE : '');

  summary = signal<MarketerSummary | null>(null);
  /** The server's own figures (available, reserved, paid, minimum, PayPal): nothing is recomputed here. */
  wallet = signal<MarketerWallet | null>(null);
  walletError = signal(false);
  isLoading = signal(true);

  withdrawals = signal<Withdrawal[]>([]);
  loadingWithdrawals = signal(false);
  submitting = signal(false);
  /** The withdrawal whose details are open. */
  openId = signal<string | null>(null);
  detail = signal<Withdrawal | null>(null);
  detailError = signal(false);


  withdrawForm!: FormGroup;

  withdrawableBalance = computed(() => this.wallet()?.withdrawableBalance ?? 0);
  reservedAmount = computed(() => this.wallet()?.reservedWithdrawals ?? 0);
  completedAmount = computed(() => this.wallet()?.paidWithdrawals ?? 0);
  minimumWithdrawal = computed(() => this.wallet()?.minimumWithdrawal ?? 0);

  /** PayPal is the only payout destination: withdrawing needs the saved PayPal email. */
  paypalEmail = computed(() => this.wallet()?.paypalEmail || '');
  hasPaypal = computed(() => !!this.wallet()?.hasPaypal);

  /** Shown next to the disabled button; null = a request can be sent. */
  blockedReason = computed(() => this.wallet()?.withdrawBlockedReason ?? null);

  /** "الرصيد بعد السحب" for the amount typed: the real balance minus the amount, never below zero. */
  balanceAfter = computed(() => {
    const amount = Number(this.amountValue());
    return Number.isFinite(amount) && amount > 0 ? Math.max(0, Math.round((this.withdrawableBalance() - amount) * 100) / 100) : this.withdrawableBalance();
  });
  private amountValue = signal<number | null>(null);

  stateOf(status: unknown) { return WITHDRAWAL_STATE[String(status)] ?? { label: String(status ?? '—'), tone: 'blue' as const }; }

  ngOnInit() {
    this.withdrawForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(1)]]
    });
    this.withdrawForm.get('amount')!.valueChanges.subscribe(v => this.amountValue.set(v));
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);

    this.overviewService.getSummary().subscribe({
      next: (res) => { if (res.success) this.summary.set(res.data); },
      error: () => {}
    });

    this.overviewService.getWallet().subscribe({
      next: (res) => {
        if (res.success && res.data) { this.wallet.set(res.data); this.walletError.set(false); } else this.walletError.set(true);
        this.isLoading.set(false);
      },
      error: () => { this.walletError.set(true); this.isLoading.set(false); }
    });

    this.loadWithdrawals();
  }

  loadWithdrawals() {
    this.loadingWithdrawals.set(true);
    this.overviewService.getWithdrawals(1, 50).subscribe({
      next: (res) => {
        this.loadingWithdrawals.set(false);
        if (res.success) this.withdrawals.set(res.data?.items || []);
      },
      error: () => this.loadingWithdrawals.set(false)
    });
  }

  /** Fills the amount with everything that can be withdrawn right now. */
  useMax() {
    if (this.withdrawableBalance() > 0) this.withdrawForm.patchValue({ amount: this.withdrawableBalance() });
  }

  toggleDetails(w: Withdrawal) {
    if (this.openId() === w.id) { this.openId.set(null); this.detail.set(null); return; }
    this.openId.set(w.id);
    this.detail.set(w);
    this.detailError.set(false);
    this.overviewService.getWithdrawal(w.id).subscribe({
      next: (res) => { if (res.success && res.data && this.openId() === w.id) this.detail.set(res.data); },
      error: () => this.detailError.set(true)
    });
  }

  /** A field error is always shown under the amount input (red, aria-invalid, role=alert) and the input gets focus; the toast only repeats it. */
  private amountProblem(message: string) {
    const problems: FieldProblem[] = [{ field: 'withdraw-amount', message }];
    void reportProblems(this.host.nativeElement, problems);
    this.notify.error(message);
  }

  submitWithdrawal() {
    if (this.submitting() || this.guard.busy) return;

    const blocked = this.blockedReason();
    if (!this.hasPaypal()) {
      this.notify.error('أضف بريد PayPal لاستلام الأرباح');
      return;
    }
    if (blocked) {
      this.notify.error(blocked);
      return;
    }
    if (this.withdrawForm.invalid) {
      this.withdrawForm.markAllAsTouched();
      this.amountProblem('أدخل مبلغ السحب بالدولار');
      return;
    }
    const amount = Number(this.withdrawForm.value.amount);
    if (amount < this.minimumWithdrawal()) {
      this.amountProblem(`الحد الأدنى لطلب السحب ${this.minimumWithdrawal()} دولار`);
      return;
    }
    if (amount > this.withdrawableBalance()) {
      this.amountProblem('المبلغ المطلوب يتجاوز رصيدك القابل للسحب');
      return;
    }

    if (this.withdrawWait.active()) return;
    if (!this.guard.enter()) return;
    this.rateLimitedNoTime.set(false);
    this.submitting.set(true);
    this.overviewService.submitWithdrawal(amount).subscribe({
      next: (res) => {
        this.guard.release();
        this.submitting.set(false);
        if (res.success) {
          this.withdrawForm.reset();
          this.notify.success('تم تقديم طلب السحب بنجاح');
          this.loadData();
        } else {
          this.notify.error(res.message || 'تعذر تقديم طلب السحب');
        }
      },
      error: async (err: any) => {
        this.guard.release();
        this.submitting.set(false);
        // 429: a wait from the server; the typed amount stays. No generic error is added.
        if (isRateLimitError(err)) {
          const end = this.withdrawWait.startFromResponse(err);
          this.rateLimitedNoTime.set(end == null || !this.withdrawWait.active());
          return;
        }
        const mapped = mapHttpError(err, { fallback: 'تعذر تقديم طلب السحب، حاول مرة أخرى' });
        const gen = genericBanner(mapped);
        if (gen !== null) { this.notify.error(gen); return; }
        const res = await reportBackendError(this.host.nativeElement, mapped, { resolve: { amount: 'withdraw-amount' } });
        // Only a 400/422 that names the amount lands on the field; everything else stays an honest generic message.
        if (!res.handled) this.notify.error(mapped.message);
      }
    });
  }
}
