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

  // Mock data — no team-performance / payouts / dispute-resolution-rate endpoint exists yet.
  // Placeholder Arabic provider names, styled after the design reference (P-CO-TM-003).
  teamPerformance: Array<{
    name: string;
    role: string;
    level: string;
    projects: number;
    rating: number;
    onTime: number;
    revenue: string;
    status: 'active' | 'delay';
  }> = [
    { name: 'ريم الدوسري', role: 'مطورة تطبيقات', level: 'مستوى 8 · خبير', projects: 8, rating: 4.9, onTime: 97, revenue: '42,800', status: 'active' },
    { name: 'سارة الزهراني', role: 'مصممة UI/UX', level: 'مستوى 7 · خبير', projects: 6, rating: 4.8, onTime: 95, revenue: '35,200', status: 'active' },
    { name: 'فهد العتيبي', role: 'مطور ويب', level: 'مستوى 6 · متقن', projects: 5, rating: 4.7, onTime: 92, revenue: '28,500', status: 'active' },
    { name: 'خالد القحطاني', role: 'مطور Full-Stack', level: 'مستوى 5 · متقن', projects: 3, rating: 4.6, onTime: 88, revenue: '19,400', status: 'active' },
    { name: 'نواف الحربي', role: 'كاتب محتوى', level: 'مستوى 4 · متقن', projects: 4, rating: 4.3, onTime: 68, revenue: '12,100', status: 'delay' }
  ];

  providerPayoutsTotal = '69,920';
  providerPayoutsTrend = '8 مقدمين هذا الشهر';
  disputeResolutionProviderRate = 30;

  tabs = computed(() => {
    const list = [
      { id: 'orders', label: 'طلبات العملاء', icon: 'list', count: 12 }
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
