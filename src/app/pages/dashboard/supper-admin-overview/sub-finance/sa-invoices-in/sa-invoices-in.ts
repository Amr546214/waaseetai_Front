import { WsCurrencyPipe } from '../../../../../shared/money/money.pipe';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminInvoice, AdminInvoicesData, AdminOpsApiService, saveBlob } from '../../../../../core/services/admin-ops-api.service';
import { errMsg, fmtDate, fmtAmount } from '../finance-ui';

type TabKey = 'all' | 'paid' | 'due';

@Component({
  selector: 'app-sa-invoices-in',
  standalone: true,
  imports: [WsCurrencyPipe, CommonModule, FormsModule],
  templateUrl: './sa-invoices-in.html',
  styleUrl: './sa-invoices-in.css',
})
export class SaInvoicesIn implements OnInit {
  private api = inject(AdminOpsApiService);

  readonly fmtAmount = fmtAmount;
  readonly fmtDate = fmtDate;
  readonly newInvoiceReason = 'الفواتير الواردة تُشتق من تسليمات المراحل ولا تُرفع يدويًا';

  activeTab = signal<TabKey>('all');
  searchTerm = signal('');
  page = signal(1);
  data = signal<AdminInvoicesData | null>(null);
  loading = signal(true);
  error = signal('');
  exporting = signal(false);
  exportError = signal('');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'paid', label: 'مدفوعة' },
    { key: 'due', label: 'مستحقة' },
  ];
  readonly statusLabels: Record<string, string> = { paid: 'مدفوعة', due: 'مستحقة' };
  readonly statusClasses: Record<string, string> = { paid: 'st-paid', due: 'st-pending' };

  filtered = computed<AdminInvoice[]>(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const items = this.data()?.items ?? [];
    if (!term) return items;
    return items.filter((i) => [i.projectTitle, i.stageTitle, i.clientName, i.providerName, i.sourceId].some((v) => (v ?? '').toLowerCase().includes(term)));
  });

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set('');
    const tab = this.activeTab();
    this.api.financeInvoices({ status: tab === 'all' ? undefined : tab, page: this.page(), limit: 20 }).subscribe({
      next: (res) => { this.data.set(res.data ?? null); this.loading.set(false); },
      error: (err) => { this.error.set(errMsg(err, 'تعذر تحميل الفواتير')); this.loading.set(false); },
    });
  }

  setTab(t: TabKey) {
    this.activeTab.set(t);
    this.page.set(1);
    this.load();
  }

  totalPages(): number {
    const p = this.data()?.pagination;
    return p?.totalPages ?? p?.pages ?? 1;
  }
  prevPage() { if (this.page() > 1) { this.page.update((v) => v - 1); this.load(); } }
  nextPage() { if (this.page() < this.totalPages()) { this.page.update((v) => v + 1); this.load(); } }

  exportCsv() {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set('');
    const tab = this.activeTab();
    this.api.downloadCsv('invoices', { status: tab === 'all' ? undefined : tab }).subscribe({
      next: (blob) => { saveBlob(blob, 'invoices.csv'); this.exporting.set(false); },
      error: (err) => { this.exportError.set(errMsg(err, 'تعذر تصدير الملف')); this.exporting.set(false); },
    });
  }
}
