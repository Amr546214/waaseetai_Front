import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type UserType = 'client' | 'provider' | 'broker';
type SubStatus = 'active' | 'expiring' | 'cancelled';
type TabKey = 'all' | UserType | 'expiring';

interface Subscription {
  id: string;
  user: string;
  type: UserType;
  plan: string;
  planColor: string;
  startDate: string;
  renewDate: string;
  autoRenew: boolean;
  status: SubStatus;
}

@Component({
  selector: 'app-sa-active-subs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-active-subs.html',
  styleUrl: './sa-active-subs.css',
})
export class SaActiveSubs {
  activeTab = signal<TabKey>('all');
  search = signal('');
  planFilter = signal('all');
  statusFilter = signal('all');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'client', label: 'طالب الخدمة' },
    { key: 'provider', label: 'مقدم الخدمة' },
    { key: 'broker', label: 'الوسيط' },
    { key: 'expiring', label: 'تنتهي قريباً' },
  ];

  readonly typeLabels: Record<UserType, string> = {
    client: 'طالب',
    provider: 'مقدم',
    broker: 'وسيط',
  };

  readonly typeColors: Record<UserType, string> = {
    client: '#2BD4C7',
    provider: '#5DA0FF',
    broker: '#59C1F5',
  };

  readonly statusLabels: Record<SubStatus, string> = {
    active: 'نشط',
    expiring: 'ينتهي قريباً',
    cancelled: 'مُلغى',
  };

  readonly statusColors: Record<SubStatus, string> = {
    active: '#0FA99A',
    expiring: '#FFB400',
    cancelled: '#FF8C69',
  };

  readonly kpis = [
    { label: 'اشتراكات نشطة', value: '4,821', unit: 'مشترك', sub: '+124 هذا الشهر', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'تنتهي هذا الشهر', value: '312', unit: 'اشتراك', sub: '87% تجديد متوقع', color: '#FFB400', subColor: '#D98A0B' },
    { label: 'مُلغاة', value: '47', unit: 'هذا الشهر', sub: '0.97% معدل الإلغاء', color: '#FF8C69', subColor: '#FF8C69' },
    { label: 'تجديد تلقائي', value: '3,891', unit: 'اشتراك', sub: '80.7% من الكل', color: '#0FA99A', subColor: '#6B7699' },
  ];

  readonly subscriptions: Subscription[] = [
    { id: 'SUB-4821', user: 'هيثم القرني', type: 'client', plan: 'Pro', planColor: '#2BD4C7', startDate: '1 يناير 2026', renewDate: '1 أغسطس 2026', autoRenew: true, status: 'active' },
    { id: 'SUB-4820', user: 'نورة السهلي', type: 'provider', plan: 'Business', planColor: '#59C1F5', startDate: '15 مارس 2026', renewDate: '15 أغسطس 2026', autoRenew: true, status: 'active' },
    { id: 'SUB-4815', user: 'خالد المطيري', type: 'client', plan: 'أساسي', planColor: '#5DA0FF', startDate: '1 يوليو 2026', renewDate: '31 يوليو 2026', autoRenew: false, status: 'expiring' },
    { id: 'SUB-4810', user: 'شركة الأفق', type: 'provider', plan: 'Enterprise', planColor: '#FF8C69', startDate: '1 يناير 2026', renewDate: '1 يناير 2027', autoRenew: true, status: 'active' },
    { id: 'SUB-4803', user: 'مؤسسة الوساطة الذهبية', type: 'broker', plan: 'Pro', planColor: '#2BD4C7', startDate: '10 فبراير 2026', renewDate: '10 أغسطس 2026', autoRenew: true, status: 'active' },
    { id: 'SUB-4796', user: 'فاطمة العتيبي', type: 'client', plan: 'أساسي', planColor: '#5DA0FF', startDate: '5 يونيو 2026', renewDate: '5 يوليو 2026', autoRenew: false, status: 'cancelled' },
    { id: 'SUB-4788', user: 'علي الشمري', type: 'provider', plan: 'Pro', planColor: '#2BD4C7', startDate: '20 يوليو 2025', renewDate: '20 أغسطس 2026', autoRenew: true, status: 'expiring' },
  ];

  readonly planOptions = ['كل الباقات', 'مجاني', 'أساسي', 'Pro', 'Business', 'Enterprise'];
  readonly statusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'كل الحالات' },
    { value: 'active', label: 'نشط' },
    { value: 'expiring', label: 'ينتهي قريباً' },
    { value: 'cancelled', label: 'مُلغى' },
  ];

  filtered = computed(() => {
    const tab = this.activeTab();
    const q = this.search().trim().toLowerCase();
    const plan = this.planFilter();
    const status = this.statusFilter();

    return this.subscriptions.filter((s) => {
      if (tab === 'expiring' && s.status !== 'expiring') return false;
      if (tab !== 'all' && tab !== 'expiring' && s.type !== tab) return false;
      if (plan !== 'all' && plan !== 'كل الباقات' && s.plan !== plan) return false;
      if (status !== 'all' && s.status !== status) return false;
      if (q && !s.user.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
