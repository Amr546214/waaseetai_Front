import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/store/auth.store';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class Reports implements OnInit {
  private authStore = inject(AuthStore);
  private providerApi = inject(ProviderApiService);

  /** Real provider statistics (GET /provider/statistics) — the only source behind this page's KPI cards. */
  stats = signal<{ summary?: { monthlyEarnings?: number; humanRating?: number } } | null>(null);

  ngOnInit() {
    this.providerApi.getProviderStatistics().subscribe({
      next: (res: any) => this.stats.set(res?.success ? res.data : null),
      error: () => this.stats.set(null)
    });
  }

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // No team-performance / payouts / dispute-resolution-rate endpoint exists yet (the team tab shows "لا توجد بيانات بعد").
  teamPerformance: Array<{
    name: string;
    role: string;
    level: string;
    projects: number;
    rating: number;
    onTime: number;
    revenue: string;
    status: 'active' | 'delay';
  }> = [];  // no team-member model / team-performance endpoint exists, so no invented members are shown

  providerPayoutsTotal: string | null = null;
  providerPayoutsTrend: string | null = null;
  disputeResolutionProviderRate: number | null = null;

  // No endpoint backs these reports yet, so the tab badges show "—" instead of invented counts.
  tabs = computed(() => {
    const list: Array<{ id: string; label: string; icon: string; count: number | null }> = [
      { id: 'orders', label: 'طلبات العملاء', icon: 'list', count: null }
    ];
    if (this.isCompanyMode()) {
      list.push({ id: 'team', label: 'أداء الفريق', icon: 'team', count: null });
    }
    list.push(
      { id: 'projects', label: 'مشاريعي', icon: 'doc', count: null },
      { id: 'finance', label: 'إيراداتي', icon: 'wallet', count: null },
      { id: 'disputes', label: 'النزاعات', icon: 'dispute', count: null }
    );
    return list;
  });

  currentTab = signal<string>('orders');
  currentPeriod = signal<string>('month');
  showDatePicker = signal<boolean>(false);
  showToast = signal<string>('');
  
  // Filters
  orderStatus = signal<string>('all');
  projStatus = signal<string>('all');
  projRating = signal<string>('all');
  projDuration = signal<string>('all');
  finType = signal<string>('all');
  finStatus = signal<string>('all');
  dispStatus = signal<string>('all');
  dispReason = signal<string>('all');
  
  setTab(tab: string) {
    this.currentTab.set(tab);
  }
  
  setPeriod(period: string) {
    this.currentPeriod.set(period);
    if (period === 'custom') {
      this.showDatePicker.set(true);
    } else {
      this.showDatePicker.set(false);
    }
  }
  
  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }
}
