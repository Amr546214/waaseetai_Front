import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type InvoiceKind = 'B2B' | 'B2C';
type InvoiceStatus = 'issued' | 'processing' | 'rejected';
type TabKey = 'all' | 'B2B' | 'B2C' | 'processing' | 'rejected';

interface OutInvoice {
  id: string;
  kind: InvoiceKind;
  party: string;
  amount: number;
  date: string;
  status: InvoiceStatus;
}

@Component({
  selector: 'app-sa-invoices-out',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-invoices-out.html',
  styleUrl: './sa-invoices-out.css',
})
export class SaInvoicesOut {
  toast = signal<string | null>(null);
  activeTab = signal<TabKey>('all');
  searchTerm = signal('');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'B2B', label: 'B2B' },
    { key: 'B2C', label: 'B2C' },
    { key: 'processing', label: 'معلقة' },
    { key: 'rejected', label: 'مرفوضة' },
  ];

  readonly statusLabels: Record<InvoiceStatus, string> = {
    issued: 'فاتورة رسمية داخلية',
    processing: 'قيد التجهيز',
    rejected: '✗ مرفوضة',
  };

  readonly statusClasses: Record<InvoiceStatus, string> = {
    issued: 'st-ok',
    processing: 'st-pending',
    rejected: 'st-rejected',
  };

  readonly invoices: OutInvoice[] = [
    { id: 'INV-2026-8247', kind: 'B2B', party: 'شركة الخليج للتطوير', amount: 5800, date: 'اليوم', status: 'issued' },
    { id: 'INV-2026-8246', kind: 'B2C', party: 'هيثم القرني', amount: 299, date: 'اليوم', status: 'issued' },
    { id: 'INV-2026-8245', kind: 'B2B', party: 'مؤسسة النور التجارية', amount: 12400, date: 'أمس', status: 'processing' },
    { id: 'INV-2026-8244', kind: 'B2C', party: 'سارة القحطاني', amount: 899, date: 'أمس', status: 'issued' },
    { id: 'INV-2026-8241', kind: 'B2C', party: 'نورة السهلي', amount: 349, date: '13 يوليو', status: 'issued' },
    { id: 'INV-2026-8240', kind: 'B2B', party: 'شركة الأفق المتقدمة', amount: 28500, date: '12 يوليو', status: 'rejected' },
    { id: 'INV-2026-8236', kind: 'B2B', party: 'مجموعة الرياض القابضة', amount: 9600, date: '10 يوليو', status: 'processing' },
    { id: 'INV-2026-8229', kind: 'B2C', party: 'خالد المطيري', amount: 199, date: '8 يوليو', status: 'issued' },
  ];

  readonly kpis = {
    total: this.invoices.length,
    issued: this.invoices.filter((i) => i.status === 'issued').length,
    processing: this.invoices.filter((i) => i.status === 'processing').length,
    rejected: this.invoices.filter((i) => i.status === 'rejected').length,
  };

  readonly filteredInvoices = computed(() => {
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();
    return this.invoices.filter((inv) => {
      const matchesTab =
        tab === 'all' ||
        (tab === 'B2B' && inv.kind === 'B2B') ||
        (tab === 'B2C' && inv.kind === 'B2C') ||
        (tab === 'processing' && inv.status === 'processing') ||
        (tab === 'rejected' && inv.status === 'rejected');
      const matchesTerm =
        !term || inv.id.toLowerCase().includes(term) || inv.party.toLowerCase().includes(term);
      return matchesTab && matchesTerm;
    });
  });

  setTab(tab: TabKey) {
    this.activeTab.set(tab);
  }

  formatAmount(v: number): string {
    return v.toLocaleString('ar-SA') + ' ر.س';
  }

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportCsv() {
    this.showToast('تم تصدير القائمة بصيغة CSV');
  }

  newInvoice() {
    this.showToast('نموذج فاتورة جديدة — تجهيز مستقبلي غير مفعّل في V1');
  }
}
