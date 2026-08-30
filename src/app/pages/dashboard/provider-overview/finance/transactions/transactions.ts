import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../../../environments/environment';

interface FinancialEvent {
  id: string; type: 'credit' | 'hold'; category: 'STAGE_RELEASE' | 'ESCROW_RELEASE' | 'ESCROW_FUNDED';
  amount: number; currency: 'SAR'; title: string; description: string; projectId: string;
  projectTitle: string; stageId: string | null; status: 'COMPLETED' | 'HELD' | 'RELEASED' | 'REFUNDED'; createdAt: string;
}

@Component({ selector: 'app-transactions', standalone: true, imports: [CommonModule, RouterModule], templateUrl: './transactions.html' })
export class Transactions implements OnInit {
  private http = inject(HttpClient);
  currentPeriod = signal('month'); currentType = signal('all'); searchQuery = signal('');
  loading = signal(true); error = signal(''); showToast = signal(false);
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
  load() { this.loading.set(true); this.error.set(''); this.http.get<any>(`${environment.url_api}/provider/finance/transactions`).subscribe({ next: res => { this.summary.set(res.data.summary); this.transactions.set(res.data.events); this.loading.set(false); }, error: err => { this.error.set(err.error?.message || 'تعذر تحميل المعاملات'); this.loading.set(false); } }); }
  setPeriod(value: string) { this.currentPeriod.set(value); }
  setType(value: string) { this.currentType.set(value); }
  setSearch(event: Event) { this.searchQuery.set((event.target as HTMLInputElement).value.trim().toLowerCase()); }
  exportCSV() {
    const rows = [['رقم المعاملة','النوع','المشروع','الوصف','المبلغ','العملة','الحالة','التاريخ'], ...this.filteredTransactions().map(t => [t.id,t.title,t.projectTitle,t.description,String(t.amount),'SAR',t.status,new Date(t.createdAt).toISOString()])];
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `provider-transactions-${new Date().toISOString().slice(0,10)}.csv`; anchor.click(); URL.revokeObjectURL(url);
    this.showToast.set(true); setTimeout(() => this.showToast.set(false), 2200);
  }
}
