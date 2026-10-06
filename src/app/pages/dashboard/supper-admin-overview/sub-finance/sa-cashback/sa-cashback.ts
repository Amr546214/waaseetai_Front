import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type AccountType = 'requester' | 'provider' | 'broker';
type CbStatus = 'distributed' | 'pending';
type TabKey = 'all' | 'distributed' | 'pending' | 'requester' | 'provider';

interface CashbackEntry {
  user: string;
  accountType: AccountType;
  amount: number;
  reason: string;
  date: string;
  status: CbStatus;
}

@Component({
  selector: 'app-sa-cashback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-cashback.html',
  styleUrl: './sa-cashback.css',
})
export class SaCashback {
  toast = signal<string | null>(null);
  activeTab = signal<TabKey>('all');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'distributed', label: 'موزَّع' },
    { key: 'pending', label: 'معلق' },
    { key: 'requester', label: 'طالب الخدمة' },
    { key: 'provider', label: 'مقدم الخدمة' },
  ];

  readonly accountTypeLabels: Record<AccountType, string> = {
    requester: 'طالب',
    provider: 'مقدم',
    broker: 'وسيط',
  };

  readonly accountTypeClasses: Record<AccountType, string> = {
    requester: 'tag-teal',
    provider: 'tag-blue',
    broker: 'tag-green',
  };

  readonly entries: CashbackEntry[] = [
    { user: 'هيثم القرني', accountType: 'requester', amount: 124, reason: 'إتمام مشروع PR-4521', date: 'اليوم', status: 'distributed' },
    { user: 'نورة السهلي', accountType: 'provider', amount: 248, reason: '5 مشاريع مكتملة', date: 'أمس', status: 'distributed' },
    { user: 'خالد المطيري', accountType: 'requester', amount: 86, reason: 'ولاء شهري', date: '12 يوليو', status: 'pending' },
    { user: 'ريم الحربي', accountType: 'provider', amount: 312, reason: 'تقييم ممتاز', date: '11 يوليو', status: 'pending' },
    { user: 'سعد الغامدي', accountType: 'broker', amount: 164, reason: 'إحالات شهرية', date: '10 يوليو', status: 'distributed' },
    { user: 'لمى العتيبي', accountType: 'requester', amount: 92, reason: 'إتمام مشروع PR-4487', date: '9 يوليو', status: 'distributed' },
    { user: 'عبدالله الزهراني', accountType: 'provider', amount: 176, reason: '3 مشاريع مكتملة', date: '7 يوليو', status: 'pending' },
  ];

  readonly filteredEntries = computed(() => {
    const tab = this.activeTab();
    return this.entries.filter((e) => {
      if (tab === 'all') return true;
      if (tab === 'distributed' || tab === 'pending') return e.status === tab;
      return e.accountType === tab;
    });
  });

  setTab(tab: TabKey) {
    this.activeTab.set(tab);
  }

  formatAmount(v: number): string {
    return `+${v} $`;
  }

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportList() {
    this.showToast('تم تصدير قائمة الكاش باك');
  }

  distributeBatch() {
    this.showToast('توزيع دفعة الكاش باك المعلقة — قيد التنفيذ');
  }
}
