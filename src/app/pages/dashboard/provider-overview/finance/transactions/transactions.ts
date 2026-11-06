import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { WalletUnifyService } from '../../../../../core/services/wallet-unify.service';
import { MISSING_DETAILS_TEXT, WalletBreakdown, WalletPagination, currencySymbol } from '../../../../../core/models/wallet-unify.model';
import { WalletCardItem, WalletExtraCardsComponent } from '../../../../../shared/wallet/wallet-cards.component';

interface FinancialEvent {
  id: string; type: 'credit' | 'hold'; category: 'STAGE_RELEASE' | 'ESCROW_RELEASE' | 'ESCROW_FUNDED' | 'CANCELLATION_SETTLEMENT';
  breakdown?: WalletBreakdown;
  amount: number; currency: string; title: string; description: string; projectId: string;
  projectTitle: string; stageId: string | null; status: 'COMPLETED' | 'HELD' | 'RELEASED' | 'REFUNDED'; createdAt: string;
}

@Component({ selector: 'app-transactions', standalone: true, imports: [CommonModule, RouterModule, WalletExtraCardsComponent], templateUrl: './transactions.html' })
export class Transactions implements OnInit {
  private http = inject(HttpClient);
  private walletApi = inject(WalletUnifyService);
  private authStore = inject(AuthStore);
  private notify = inject(UiNotificationService);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  currentPeriod = signal('month'); currentType = signal('all'); searchQuery = signal('');
  loading = signal(true); error = signal('');
  summary = signal<any>(null); transactions = signal<FinancialEvent[]>([]);

  filteredTransactions = computed(() => {
    const now = new Date(); const period = this.currentPeriod(); const q = this.searchQuery();
    const from = new Date(now);
    if (period === 'today') from.setHours(0, 0, 0, 0);
    if (period === 'week') from.setDate(now.getDate() - 7);
    if (period === 'month') { from.setDate(1); from.setHours(0, 0, 0, 0); }
    if (period === '3m') from.setMonth(now.getMonth() - 3);
    return this.transactions().filter(item => {
      const periodMatch = period === 'all' || new Date(item.createdAt) >= from;
      const typeMatch = this.currentType() === 'all' || (this.currentType() === 'release' ? item.type === 'credit' : item.type === 'hold');
      const searchMatch = !q || `${item.id} ${item.title} ${item.projectTitle} ${item.description}`.toLowerCase().includes(q);
      return periodMatch && typeMatch && searchMatch;
    });
  });

  ngOnInit() { this.load(); }
  pagination = signal<WalletPagination | null>(null);
  loadingMore = signal(false);
  readonly missingText = MISSING_DETAILS_TEXT;
  readonly cur = currencySymbol;
  extraCards = computed<WalletCardItem[]>(() => {
    const c = this.summary()?.cards;
    return c ? [{ key: 'gross', title: 'المبلغ قبل الخصومات (الإفراجات)', card: c.grossBeforeDeductions, tone: 'teal' }, { key: 'pending', title: 'سحوبات قيد المعالجة', card: c.pendingWithdrawals, tone: 'blue' }] : [];
  });

  /** the full history, paged by the server (newest first); "more" appends the next page */
  load(page = 1) {
    if (page === 1) { this.loading.set(true); } else { this.loadingMore.set(true); }
    this.error.set('');
    this.walletApi.history('provider', page, 50).subscribe({
      next: res => {
        const d = res.data;
        this.summary.set(d.summary);
        this.pagination.set(d.pagination);
        this.transactions.set(page === 1 ? (d.items as any) : [...this.transactions(), ...(d.items as any)]);
        this.loading.set(false); this.loadingMore.set(false);
      },
      error: err => { this.error.set(err.error?.message || 'تعذر تحميل المعاملات'); this.loading.set(false); this.loadingMore.set(false); }
    });
  }
  loadMore() { const p = this.pagination(); if (p && p.page < p.totalPages) this.load(p.page + 1); }
  setPeriod(value: string) { this.currentPeriod.set(value); }
  setType(value: string) { this.currentType.set(value); }
  setSearch(event: Event) { this.searchQuery.set((event.target as HTMLInputElement).value.trim().toLowerCase()); }

  statusLabel(t: FinancialEvent) {
    if (t.category === 'CANCELLATION_SETTLEMENT') return 'تسوية إلغاء متبادل';
    if (t.type === 'credit') return 'مفرج ومكتمل';
    if (t.status === 'HELD') return 'محتجز في الضمان';
    if (t.status === 'REFUNDED') return 'مسترد';
    return 'تم الإفراج';
  }

  exportCSV() {
    const rows = [['رقم المعاملة','النوع','المشروع','الوصف','المبلغ','العملة','الحالة','التاريخ'], ...this.filteredTransactions().map(t => [t.id,t.title,t.projectTitle,t.description,String(t.amount),t.currency || 'USD',t.status,new Date(t.createdAt).toISOString()])];
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `provider-transactions-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    this.notify.success('تم تصدير السجل الظاهر بنجاح');
  }
}
