import { CommonModule } from '@angular/common';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { ProviderDepositModal } from './deposit-modal/deposit-modal';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType, UserRole } from '../../../../../core/models/auth.model';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { handleLoadError, rateLimitToastMessage } from '../../../../../core/utils/rate-limit.util';
import { WalletBreakdown, WalletCard } from '../../../../../core/models/wallet-unify.model';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../../shared/wallet/wallet-breakdown.component';
import { WalletCardItem, WalletExtraCardsComponent } from '../../../../../shared/wallet/wallet-cards.component';

export const PROVIDER_ONLY_FINANCE_MESSAGE = 'هذه الصفحة متاحة لحساب مقدم الخدمة فقط. بدّل إلى دورك كمقدم خدمة لعرض المحفظة.';

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
  /** Wallet unification: the stored deduction details of this operation */
  breakdown?: WalletBreakdown;
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
    pendingWithdrawals?: number;
    withdrawableBalance?: number;
    totalEarnings: number;
    escrowBalance: number;
    releasedThisMonth: number;
    releasedTransactionsCount: number;
    fundedProjectsCount: number;
    completedProjectsCount: number;
    currency: string; // backend sends 'USD'
    /** Wallet unification (absent on an older server) */
    cards?: { availableToWithdraw?: WalletCard; pendingWithdrawals?: WalletCard; grossBeforeDeductions?: WalletCard; heldInEscrow?: WalletCard; cashback?: WalletCard };
    minimumWithdrawal?: number;
    canWithdraw?: boolean;
  };
  transactions: WalletTransaction[];
  escrows: Array<{ id: string; projectId: string; projectTitle: string; total: number; released: number; held: number; status: string; updatedAt: string }>;
  // Company-mode only — see ProviderWalletProviderSpend above.
  providerSpending?: ProviderWalletProviderSpend[];
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [WsDatePipe, RouterLink, CommonModule, ProviderDepositModal, WalletBreakdownComponent, WalletExtraCardsComponent],
  templateUrl: './wallet.html',
  styleUrl: './wallet.css'
})
export class Wallet implements OnInit {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);
  private notify = inject(UiNotificationService);
  data = signal<WalletData | null>(null);
  readonly providerOnlyMessage = PROVIDER_ONLY_FINANCE_MESSAGE;
  loading = signal(true);
  error = signal('');

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY;

  /** the withdraw button exists only where the server says the role withdraws */
  canWithdraw = computed(() => this.data()?.summary?.canWithdraw !== false);
  minimumWithdrawal = computed(() => this.data()?.summary?.minimumWithdrawal ?? 0);

  extraCards = computed<WalletCardItem[]>(() => {
    const c = this.data()?.summary?.cards;
    return [
      { key: 'gross', title: 'المبلغ قبل الخصومات (الإفراجات)', card: c?.grossBeforeDeductions, tone: 'teal' },
      { key: 'pending', title: 'سحوبات قيد المعالجة', card: c?.pendingWithdrawals, tone: 'blue', sub: 'مخصومة من المتاح للسحب' },
    ];
  });

  /** the latest operations in «تفصيل المبالغ والخصومات»; the full list is the history page */
  breakdownRows = computed<WalletBreakdownRow[]>(() => (this.data()?.transactions ?? []).slice(0, 8).map(t => ({
    id: t.id,
    title: [t.projectTitle || t.title, this.isCompany() ? t.providerName : ''].filter(Boolean).join(' · '),
    date: t.createdAt ? t.createdAt.slice(0, 10) : undefined,
    link: ['/provider-overview/finance/transactions', t.id],
    breakdown: t.breakdown ?? null,
    storedAmount: t.amount,
    storedCurrency: t.currency,
  })));

  providerSpending = computed(() => this.data()?.providerSpending ?? []);

  providerSpendBarWidth(amount: number): number {
    const max = Math.max(...this.providerSpending().map(p => p.revenue), 1);
    return Math.max(4, Math.round((amount / max) * 100));
  }

  // Gap 3: deposit is UI-only — there is no provider deposit/top-up
  // endpoint in provider-api.service.ts (unlike withdraw, which is wired
  // to a real backend). The modal never issues an HTTP call; it only
  // emits the chosen amount so we can acknowledge it with a notification.
  showDepositModal = signal(false);

  openDepositModal() {
    this.showDepositModal.set(true);
  }

  closeDepositModal() {
    this.showDepositModal.set(false);
  }

  onDepositConfirmed(event: { amount: number; method: 'card' | 'bank' | 'paypal' }) {
    this.showDepositModal.set(false);
    this.notify.warning('لم يُنفَّذ أي إيداع — الدفع الإلكتروني غير متاح حاليًا');
  }

  /** available + held in escrow: the ring is drawn only when there is something to show */
  ringTotal = computed(() => {
    const d = this.data();
    return (d?.summary?.availableBalance || 0) + (d?.summary?.escrowBalance || 0);
  });
  /** the available share of the ring: arc length / remainder, out of the circumference of r=36 */
  ringDash = computed(() => {
    const circumference = 2 * Math.PI * 36;
    const arc = (this.availableRatio() / 100) * circumference;
    return `${arc.toFixed(1)} ${(circumference - arc).toFixed(1)}`;
  });

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
    // The provider wallet is provider-only (the server answers 403 to any other role): never ask for it while acting as a client.
    if (this.authStore.actingRole?.() === UserRole.CLIENT) { this.error.set(PROVIDER_ONLY_FINANCE_MESSAGE); this.loading.set(false); return; }
    this.loading.set(true);
    this.error.set('');
    this.http.get<{ success: boolean; data: WalletData }>(`${environment.url_api}/provider/finance/wallet`).subscribe({
      next: response => {
        this.data.set(response.data);
        this.loading.set(false);
      },
      error: err => {
        if (err?.status === 403) { this.error.set(PROVIDER_ONLY_FINANCE_MESSAGE); this.loading.set(false); return; }
        handleLoadError(err, {
          hasData: () => this.data() != null,
          onKeep: () => this.loading.set(false),
          onRateLimit: (e) => { this.error.set(rateLimitToastMessage(e)); this.loading.set(false); },
          onOtherError: () => { this.error.set(err.error?.message || 'تعذر تحميل بيانات المحفظة'); this.loading.set(false); },
        });
      }
    });
  }
}

