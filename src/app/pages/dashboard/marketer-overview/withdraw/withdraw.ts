import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { MarketerProfileService, MarketerProfile } from '../../../../core/services/marketer-profile.service';
import { Withdrawal } from '../../../../core/models/withdrawal.model';

const MINIMUM_WITHDRAWAL = 300;
const RESERVED_STATUSES = new Set(['PENDING', 'APPROVED', 'PROCESSING']);

@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './withdraw.html',
  styleUrl: './withdraw.css',
})
export class Withdraw implements OnInit {
  private overviewService = inject(MarketerOverviewService);
  private profileService = inject(MarketerProfileService);
  private fb = inject(FormBuilder);

  summary = signal<MarketerSummary | null>(null);
  profile = signal<MarketerProfile | null>(null);
  isLoading = signal(true);

  withdrawals = signal<Withdrawal[]>([]);
  loadingWithdrawals = signal(false);
  submitting = signal(false);

  toastMessage = signal<{ text: string; type: 'success' | 'error' } | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  withdrawForm!: FormGroup;

  // "محجوز" — requests already submitted but not yet paid out or rejected.
  reservedAmount = computed(() =>
    this.withdrawals()
      .filter(w => RESERVED_STATUSES.has(String(w.status)))
      .reduce((sum, w) => sum + (w.amount || 0), 0)
  );

  // "إجمالي السحوبات" — requests already paid out.
  completedAmount = computed(() =>
    this.withdrawals()
      .filter(w => w.status === 'COMPLETED')
      .reduce((sum, w) => sum + (w.amount || 0), 0)
  );

  // Mirrors the backend's own withdrawable-balance check
  // (WithdrawalService.createForMarketer): approved commissions minus
  // every non-releasing (i.e. not REJECTED) withdrawal already on record.
  withdrawableBalance = computed(() => {
    const total = this.summary()?.totalCommissions || 0;
    return Math.max(0, total - this.reservedAmount() - this.completedAmount());
  });

  /** Bank data state from the backend: approved / pending review / not added. */
  bankStatus = computed(() => this.profile()?.bankStatus ?? (this.profile()?.iban ? 'approved' : 'none'));
  hasBankInfo = computed(() => this.bankStatus() === 'approved');
  bankPendingReview = computed(() => this.bankStatus() === 'pending_review');

  ngOnInit() {
    this.withdrawForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(MINIMUM_WITHDRAWAL)]]
    });
    this.loadData();
  }

  loadData() {
    this.isLoading.set(true);

    this.overviewService.getSummary().subscribe({
      next: (res) => {
        if (res.success) this.summary.set(res.data);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false)
    });

    this.profileService.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) this.profile.set(res.data);
      },
      error: () => {}
    });

    this.loadWithdrawals();
  }

  loadWithdrawals() {
    this.loadingWithdrawals.set(true);
    this.overviewService.getWithdrawals(1, 20).subscribe({
      next: (res) => {
        this.loadingWithdrawals.set(false);
        if (res.success) this.withdrawals.set(res.data?.items || []);
      },
      error: () => this.loadingWithdrawals.set(false)
    });
  }

  submitWithdrawal() {
    if (this.submitting()) return;

    if (this.withdrawForm.invalid) {
      this.withdrawForm.markAllAsTouched();
      this.showToast(`الحد الأدنى لطلب السحب ${MINIMUM_WITHDRAWAL} ريال`, 'error');
      return;
    }
    if (!this.hasBankInfo()) {
      this.showToast(this.bankPendingReview()
        ? 'بياناتك البنكية قيد المراجعة، يمكنك طلب السحب بعد اعتمادها'
        : 'أضف رقم الحساب البنكي (IBAN) من الملف الشخصي أولاً', 'error');
      return;
    }
    const amount = Number(this.withdrawForm.value.amount);
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
