import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type UpgradeStatus = 'completed' | 'pending' | 'ai';
type UpgradeFilter = 'all' | UpgradeStatus;

interface PlanBadge {
  name: string;
  color: string;
}

interface UpgradeRequest {
  user: string;
  from: PlanBadge;
  to: PlanBadge;
  diff: string;
  probability: number;
  probColor: string;
  date: string;
  status: UpgradeStatus;
}

@Component({
  selector: 'app-sa-upgrade',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-upgrade.html',
  styleUrl: './sa-upgrade.css',
})
export class SaUpgrade {
  activeFilter = signal<UpgradeFilter>('all');

  readonly filters: { key: UpgradeFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'completed', label: 'مكتملة' },
    { key: 'pending', label: 'معلقة' },
    { key: 'ai', label: 'توصيات AI' },
  ];

  readonly statusLabels: Record<UpgradeStatus, string> = {
    completed: 'مكتملة',
    pending: 'معلقة',
    ai: 'توصية AI',
  };

  readonly statusColors: Record<UpgradeStatus, string> = {
    completed: '#0FA99A',
    pending: '#FFB400',
    ai: '#A56BE0',
  };

  readonly kpis = [
    { label: 'طلبات الترقية', value: '247', unit: 'هذا الشهر', sub: '+34% عن الشهر الماضي', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'مكتملة', value: '218', unit: 'ترقية', sub: '88.3% معدل الإتمام', color: '#0FA99A', subColor: '#6B7699' },
    { label: 'معلقة', value: '29', unit: 'طلب', sub: 'بانتظار الدفع', color: '#FFB400', subColor: '#D98A0B' },
    { label: 'توصيات AI', value: '482', unit: 'مستخدم مرشح', sub: 'احتمالية ترقية >70%', color: '#A56BE0', subColor: '#6B7699' },
  ];

  readonly requests: UpgradeRequest[] = [
    { user: 'هيثم القرني', from: { name: 'أساسي', color: '#5DA0FF' }, to: { name: 'Pro', color: '#2BD4C7' }, diff: '+200 ر.س', probability: 89, probColor: '#0FA99A', date: 'اليوم', status: 'completed' },
    { user: 'نورة السهلي', from: { name: 'مجاني', color: '#6B7699' }, to: { name: 'أساسي', color: '#5DA0FF' }, diff: '+99 ر.س', probability: 76, probColor: '#2BD4C7', date: 'أمس', status: 'completed' },
    { user: 'شركة الأفق', from: { name: 'Pro', color: '#2BD4C7' }, to: { name: 'Business', color: '#A56BE0' }, diff: '+400 ر.س', probability: 92, probColor: '#A56BE0', date: '12 يوليو', status: 'pending' },
    { user: 'خالد المطيري', from: { name: 'مجاني', color: '#6B7699' }, to: { name: 'Pro', color: '#2BD4C7' }, diff: '+299 ر.س', probability: 71, probColor: '#FFB400', date: '11 يوليو', status: 'ai' },
    { user: 'فاطمة العتيبي', from: { name: 'أساسي', color: '#5DA0FF' }, to: { name: 'Pro', color: '#2BD4C7' }, diff: '+200 ر.س', probability: 84, probColor: '#0FA99A', date: '9 يوليو', status: 'completed' },
    { user: 'مؤسسة البناء الحديث', from: { name: 'مجاني', color: '#6B7699' }, to: { name: 'أساسي', color: '#5DA0FF' }, diff: '+129 ر.س', probability: 74, probColor: '#2BD4C7', date: '6 يوليو', status: 'ai' },
  ];

  filteredRequests = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.requests;
    return this.requests.filter((r) => r.status === f);
  });

  setFilter(f: UpgradeFilter): void {
    this.activeFilter.set(f);
  }
}
