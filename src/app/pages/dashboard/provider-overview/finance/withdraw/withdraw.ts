import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

// Backend gap:
// No POST /api/provider/finance/withdraw in Swagger as of Module 4 audit.
// No GET /api/provider/finance/withdrawals in Swagger as of Module 4 audit.
// This page is kept as UI scaffold with submit disabled until backend endpoint is added.

@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './withdraw.html',
})
export class Withdraw implements OnInit {
  private http = inject(HttpClient);

  balance = signal<number | null>(null);
  balanceLoading = signal(true);
  balanceError = signal('');

  withdrawAmount = signal(1000);
  selectedMethod = signal('card');
  termsAccepted = signal(false);

  showUnavailableMsg = signal(false);

  amountString = computed(() => {
    return this.withdrawAmount().toLocaleString('en-US');
  });

  ngOnInit() {
    this.loadWalletBalance();
  }

  loadWalletBalance() {
    this.balanceLoading.set(true);
    this.balanceError.set('');
    this.http.get<{ success: boolean; data: { summary?: { availableBalance?: number } } }>(
      `${environment.url_api}/provider/finance/wallet`
    ).subscribe({
      next: (res) => {
        if (res.success && res.data?.summary) {
          this.balance.set(res.data.summary.availableBalance ?? 0);
        } else {
          this.balance.set(null);
        }
        this.balanceLoading.set(false);
      },
      error: (err) => {
        this.balanceError.set(err?.error?.message || 'تعذر تحميل رصيد المحفظة');
        this.balance.set(null);
        this.balanceLoading.set(false);
      },
    });
  }

  setAmount(val: number) {
    this.withdrawAmount.set(val);
  }

  setAmountStr(event: Event) {
    const target = event.target as HTMLInputElement;
    const v = parseInt(target.value.replace(/\D/g, ''), 10) || 0;
    this.withdrawAmount.set(v);
  }

  setMethod(method: string) {
    this.selectedMethod.set(method);
  }

  toggleTerms() {
    this.termsAccepted.update(v => !v);
  }

  // No backend endpoint — do not call API, show unavailable message.
  attemptWithdraw() {
    this.showUnavailableMsg.set(true);
  }

  dismissUnavailableMsg() {
    this.showUnavailableMsg.set(false);
  }
}
