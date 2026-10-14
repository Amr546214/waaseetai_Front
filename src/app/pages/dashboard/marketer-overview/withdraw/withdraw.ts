import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerOverviewService, MarketerSummary, MarketerWallet } from '../../../../core/services/marketer-overview.service';
import { Withdrawal } from '../../../../core/models/withdrawal.model';

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
  imports: [MarketerLevelTagComponent, CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './withdraw.html',
  styleUrl: './withdraw.css',
})
export class Withdraw implements OnInit {
  private overviewService = inject(MarketerOverviewService);
  private fb = inject(FormBuilder);

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

  toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  withdrawForm!: FormGroup;

  withdrawableBalance = computed(() => this.wallet()?.withdrawableBalance ?? 0);
  reservedAmount = computed(() => this.wallet()?.reservedWithdrawals ?? 0);
  completedAmount = computed(() => this.wallet()?.paidWithdrawals ?? 0);
  minimumWithdrawal = computed(() => this.wallet()?.minimumWithdrawal ?? 300);

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

  submitWithdrawal() {
    if (this.submitting()) return;

    const blocked = this.blockedReason();
    if (!this.hasPaypal()) {
      this.showToast('أضف بريد PayPal لاستلام الأرباح', 'error');
      return;
    }
    if (blocked) {
      this.showToast(blocked, 'error');
      return;
    }
    if (this.withdrawForm.invalid) {
      this.withdrawForm.markAllAsTouched();
      this.showToast('أدخل مبلغ السحب', 'error');
      return;
    }
    const amount = Number(this.withdrawForm.value.amount);
    if (amount < this.minimumWithdrawal()) {
      this.showToast(`الحد الأدنى لطلب السحب ${this.minimumWithdrawal()} دولار`, 'error');
      return;
    }
    if (amount > this.withdrawableBalance()) {
      this.showToast('المبلغ المطلوب يتجاوز رصيدك القابل للسحب', 'error');
      return;
    }

    this.submitting.set(true);
    this.overviewService.submitWithdrawal(amount).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.withdrawForm.reset();
          this.showToast('تم تقديم طلب السحب بنجاح', 'success');
          this.loadData();
        } else {
          this.showToast(res.message || 'تعذر تقديم طلب السحب', 'error');
        }
      },
      error: (err: any) => {
        this.submitting.set(false);
        this.showToast(err?.error?.message || 'تعذر تقديم طلب السحب، حاول مرة أخرى', 'error');
      }
    });
  }

  private showToast(text: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set({ text, type });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), type === 'error' ? 5000 : 3000);
  }
}
