import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class Reports {
  private authStore = inject(AuthStore);

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

  tabs = computed(() => {
    const list = [
      // Kept in sync with the actual number of mock rows rendered below
      // (the now-removed page-2/3 pagination controls previously implied a
      // 12-item total that doesn't exist).
      { id: 'orders', label: 'طلبات العملاء', icon: 'list', count: 4 }
    ];
    if (this.isCompanyMode()) {
      list.push({ id: 'team', label: 'أداء الفريق', icon: 'team', count: this.teamPerformance.length });
    }
    list.push(
      { id: 'projects', label: 'مشاريعي', icon: 'doc', count: 8 },
      { id: 'finance', label: 'إيراداتي', icon: 'wallet', count: 24 },
      { id: 'disputes', label: 'النزاعات', icon: 'dispute', count: 2 }
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
