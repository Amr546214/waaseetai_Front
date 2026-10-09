import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WithdrawalApiService } from '../../../../../core/services/withdrawal-api.service';
import {
  ProviderWalletData,
  Withdrawal,
  WithdrawalStatus,
} from '../../../../../core/models/withdrawal.model';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';


@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './withdraw.html',
  styleUrl: './withdraw.css',
})
export class Withdraw implements OnInit {
  private withdrawalApi = inject(WithdrawalApiService);
  private authStore = inject(AuthStore);
  private providerProfileService = inject(ProviderProfileService);

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY;

  // ── Wallet ──────────────────────────────────────────────────────────
  wallet = signal<ProviderWalletData | null>(null);
  walletLoading = signal(true);
  walletError = signal('');

  availableBalance = computed(() => this.wallet()?.summary?.availableBalance ?? 0);
  totalEarnings = computed(() => this.wallet()?.summary?.totalEarnings ?? 0);
  escrowBalance = computed(() => this.wallet()?.summary?.escrowBalance ?? 0);
  // Reads the real currency code from the wallet API (now USD-semantic for
  // new/active balances) and renders it as the app's established symbol —
  // never hardcodes the currency, it follows the actual stored value.
  currency = computed(() => this.currencySymbol(this.wallet()?.summary?.currency || 'USD'));

  private currencySymbol(code: string): string {
    if (code === 'USD') return '$';
    return code;
  }

  // ── Withdrawal history ──────────────────────────────────────────────
  withdrawals = signal<Withdrawal[]>([]);
  historyLoading = signal(false);
  historyError = signal('');
  readonly limit = 10;
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  // ── Submit form ─────────────────────────────────────────────────────
  amount = signal<number | null>(null);
  /** PayPal is the only supported payout method for now; the destination is the provider's saved PayPal email. */
  readonly method = 'paypal';
  paypalEmail = signal('');
  paypalLoading = signal(true);

  submitting = signal(false);
  submitError = signal('');
  submitSuccess = signal('');
  formErrors = signal<Record<string, string>>({});

  remainingBalance = computed(() => {
    const amt = this.amount();
    if (amt == null || amt <= 0) return this.availableBalance();
    return Math.max(0, this.availableBalance() - amt);
  });

  ngOnInit() {
    this.loadAll();
    this.loadPaypalEmail();
  }

  loadAll() {
    this.loadWallet();
    this.loadHistory();
  }

  /** The destination is resolved server-side from the saved profile; it is only read here to show it. */
  private loadPaypalEmail() {
    this.paypalLoading.set(true);
    this.providerProfileService.getProfile().subscribe({
      next: profile => {
        this.paypalEmail.set((profile?.paypalPayoutEmail || '').trim());
        this.paypalLoading.set(false);
      },
      error: () => this.paypalLoading.set(false),
    });
  }

  loadWallet() {
    this.walletLoading.set(true);
    this.walletError.set('');
    this.withdrawalApi.getProviderWallet().subscribe({
      next: res => {
        this.wallet.set(res?.data ?? null);
        this.walletLoading.set(false);
      },
      error: err => {
        this.walletError.set(err?.error?.message || err?.message || 'تعذر تحميل بيانات المحفظة');
        this.walletLoading.set(false);
      },
    });
  }

  loadHistory() {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.withdrawalApi.getProviderWithdrawals(this.currentPage(), this.limit).subscribe({
      next: res => {
        this.historyLoading.set(false);
        const data = res?.data;
        if (data) {
          const items = data.withdrawals ?? data.items ?? [];
          this.withdrawals.set(items);
          const pag = data.pagination;
          if (pag) {
            this.total.set(pag.total ?? 0);
            this.totalPages.set(pag.totalPages ?? pag.pages ?? 1);
          } else {
            this.total.set(data.total ?? items.length);
            this.totalPages.set(data.pages ?? 1);
          }
        } else {
          this.withdrawals.set([]);
          this.total.set(0);
          this.totalPages.set(1);
        }
      },
      error: err => {
        this.historyLoading.set(false);
        if (err?.status === 204) {
          this.withdrawals.set([]);
          this.total.set(0);
          this.totalPages.set(1);
          this.historyError.set('');
        } else {
          this.historyError.set(err?.error?.message || err?.message || 'تعذر تحميل سجل طلبات السحب');
        }
      },
    });
  }

  // ── Form input handlers ─────────────────────────────────────────────
  setAmount(val: number) {
    this.amount.set(val);
    this.clearFieldError('amount');
  }

  setAmountStr(event: Event) {
    const target = event.target as HTMLInputElement;
    const v = parseFloat(target.value.replace(/[^\d.]/g, ''));
    this.amount.set(isNaN(v) ? null : v);
    this.clearFieldError('amount');
  }

  private clearFieldError(field: string) {
    const errs = this.formErrors();
    if (errs[field]) {
      const next = { ...errs };
      delete next[field];
      this.formErrors.set(next);
    }
  }

  // ── Validation ──────────────────────────────────────────────────────
  validate(): boolean {
    const errors: Record<string, string> = {};
    const amt = this.amount();
    const avail = this.availableBalance();

    if (amt == null) {
      errors['amount'] = 'المبلغ مطلوب';
    } else if (amt <= 0) {
      errors['amount'] = 'المبلغ يجب أن يكون أكبر من صفر';
    } else if (amt > avail) {
      errors['amount'] = `المبلغ يتجاوز رصيدك المتاح (${avail.toLocaleString('en-US')} ${this.currency()})`;
    }

    if (!this.paypalEmail()) {
      errors['paypal'] = 'أضف بريد PayPal لاستلام الأرباح';
    }

    this.formErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Submit ──────────────────────────────────────────────────────────
  submit() {
    this.submitError.set('');
    this.submitSuccess.set('');
    if (!this.validate()) return;

    // Every withdrawal goes to the admin review queue; there is no client-side (fake) OTP step.
    this.performSubmit();
  }

  private performSubmit() {
    const amt = this.amount()!;
    this.submitting.set(true);

    // PayPal withdrawal: the destination is NOT sent; the server reads the provider's saved PayPal email.
    const payload = { amount: amt, method: this.method };

    this.withdrawalApi.submitProviderWithdrawal(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitSuccess.set('تم إرسال طلب السحب بنجاح. الطلب الآن قيد المراجعة من قبل الإدارة.');
        this.resetForm();
        // Refresh history + wallet. Wallet balance is NOT reduced on submit per backend.
        this.loadAll();
      },
      error: err => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.message || err?.message || 'تعذر إرسال طلب السحب');
      },
    });
  }

  private resetForm() {
    this.amount.set(null);
    this.formErrors.set({});
  }

  dismissSuccess() {
    this.submitSuccess.set('');
  }

  // ── Pagination ──────────────────────────────────────────────────────
  goToPage(page: number) {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) return;
    this.currentPage.set(page);
    this.loadHistory();
  }

  getPagesArray(): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= this.totalPages(); i++) pages.push(i);
    return pages;
  }

  // ── Display helpers ─────────────────────────────────────────────────
  getStatusLabel(status?: WithdrawalStatus): string {
    const map: Record<string, string> = {
      PENDING: 'قيد المراجعة',
      APPROVED: 'تمت الموافقة',
      REJECTED: 'مرفوض',
      COMPLETED: 'مكتمل',
    };
    return map[status as string] || status || 'غير محدد';
  }

  getStatusClass(status?: WithdrawalStatus): string {
    const map: Record<string, string> = {
      PENDING: 'st-pending',
      APPROVED: 'st-approved',
      REJECTED: 'st-rejected',
      COMPLETED: 'st-completed',
    };
    return map[status as string] || 'st-pending';
  }

  getMethodLabel(method?: string): string {
    const map: Record<string, string> = {
      paypal: 'PayPal',
    };
    // PayPal is the only withdrawal method: an older row of another method is shown generically, never as a bank transfer.
    return map[method || ''] || 'طلب سحب سابق';
  }


  formatAmount(amount?: number, currency?: string): string {
    if (amount == null) return '—';
    const formatted = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    // currency here is the withdrawal record's OWN stored currency code
    // (a row shows its own stored currency code) —
    // never relabeled, only rendered as the app's symbol.
    return `${formatted} ${currency ? this.currencySymbol(currency) : this.currency()}`;
  }

  formatDate(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  }

  getShortId(id: string): string {
    return id?.length > 8 ? id.substring(0, 8) : id;
  }
}
