import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { ProviderDepositModal } from './deposit-modal/deposit-modal';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  category: string;
  amount: number;
  currency: string; // backend sends 'USD' (escrow-derived, USD-canonical)
  title: string;
  description: string;
  projectId?: string;
  projectTitle?: string;
  stageId?: string | null;
  status: 'COMPLETED' | 'HELD' | 'PENDING';
  createdAt: string;
  // Company-mode only (P-CO-FN-001/006 "المقدم" column): which team provider
  // this transaction is attributed to. Optional because the backend does not
  // populate it yet — the UI falls back to "—" when it's absent.
  providerName?: string;
}

// Company-mode only (P-CO-FN-001/002 "أداء مقدمي الخدمة"): per-provider
// revenue breakdown row. No backend field exists for this yet on
// GET /provider/finance/wallet — this stays an empty array (and the whole
// panel stays hidden) until the endpoint starts returning `providerSpending`
// for PROVIDER_COMPANY accounts. See BACKEND_BLOCKED_ISSUES.md.
export interface ProviderWalletProviderSpend {
  providerName: string;
  specialty?: string;
  projectsCount?: number;
  revenue: number;
}

export interface WalletData {
  summary: {
    availableBalance: number;
    totalEarnings: number;
    escrowBalance: number;
    releasedThisMonth: number;
    releasedTransactionsCount: number;
    fundedProjectsCount: number;
    completedProjectsCount: number;
    currency: string; // backend sends 'USD'
  };
  transactions: WalletTransaction[];
  escrows: Array<{ id: string; projectId: string; projectTitle: string; total: number; released: number; held: number; status: string; updatedAt: string }>;
  // Company-mode only — see ProviderWalletProviderSpend above.
  providerSpending?: ProviderWalletProviderSpend[];
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [RouterLink, CommonModule, ProviderDepositModal],
  templateUrl: './wallet.html',
  styleUrl: './wallet.css'
})
export class Wallet implements OnInit {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  data = signal<WalletData | null>(null);
  loading = signal(true);
  error = signal('');

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY;

  providerSpending = computed(() => this.data()?.providerSpending ?? []);

  providerSpendBarWidth(amount: number): number {
    const max = Math.max(...this.providerSpending().map(p => p.revenue), 1);
    return Math.max(4, Math.round((amount / max) * 100));
  }

  // Gap 3: deposit is UI-only — there is no provider deposit/top-up
  // endpoint in provider-api.service.ts (unlike withdraw, which is wired
  // to a real backend). The modal never issues an HTTP call; it only
  // emits the chosen amount so we can acknowledge it with a toast.
  showDepositModal = signal(false);
  depositToast = signal('');
  private depositToastTimer: ReturnType<typeof setTimeout> | null = null;

  openDepositModal() {
    this.showDepositModal.set(true);
  }

  closeDepositModal() {
    this.showDepositModal.set(false);
  }

  onDepositConfirmed(event: { amount: number; method: 'card' | 'bank' }) {
    this.showDepositModal.set(false);
    this.depositToast.set(`تم تسجيل طلب إيداع ${event.amount.toLocaleString('en-US')} $ — سيُفعَّل الدفع الإلكتروني قريباً`);
    if (this.depositToastTimer) clearTimeout(this.depositToastTimer);
    this.depositToastTimer = setTimeout(() => this.depositToast.set(''), 4000);
  }

  availableRatio = computed(() => {
    const d = this.data();
    if (!d) return 66;
    const avail = d.summary?.availableBalance || 0;
    const total = (d.summary?.availableBalance || 0) + (d.summary?.escrowBalance || 0);
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((avail / total) * 100)));
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ success: boolean; data: WalletData }>(`${environment.url_api}/provider/finance/wallet`).subscribe({
      next: response => {
        this.data.set(response.data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.error?.message || 'تعذر تحميل بيانات المحفظة');
        this.loading.set(false);
      }
    });
  }
}

