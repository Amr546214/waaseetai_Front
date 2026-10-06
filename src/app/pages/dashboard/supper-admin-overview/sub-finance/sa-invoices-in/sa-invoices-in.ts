import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type InStatus = 'paid' | 'pending' | 'overdue';
type TabKey = 'all' | 'pending' | 'paid' | 'overdue';

interface InInvoice {
  id: string;
  supplier: string;
  service: string;
  amount: number;
  dueDate: string;
  status: InStatus;
}

@Component({
  selector: 'app-sa-invoices-in',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-invoices-in.html',
  styleUrl: './sa-invoices-in.css',
})
export class SaInvoicesIn {
  toast = signal<string | null>(null);
  activeTab = signal<TabKey>('all');
  searchTerm = signal('');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'معلقة' },
    { key: 'paid', label: 'مدفوعة' },
    { key: 'overdue', label: 'متأخرة' },
  ];

  readonly statusLabels: Record<InStatus, string> = {
    paid: 'مدفوعة',
    pending: 'معلقة',
    overdue: 'متأخرة',
  };

  readonly invoices: InInvoice[] = [
    { id: 'EXT-2026-0312', supplier: 'Amazon Web Services', service: 'Cloud Hosting', amount: 48200, dueDate: '31 يوليو', status: 'pending' },
    { id: 'EXT-2026-0311', supplier: 'Twilio', service: 'SMS & WhatsApp', amount: 8400, dueDate: '25 يوليو', status: 'paid' },
    { id: 'EXT-2026-0308', supplier: 'Stripe', service: 'Payment Processing', amount: 12800, dueDate: '20 يوليو', status: 'paid' },
    { id: 'EXT-2026-0299', supplier: 'Firebase', service: 'Database & Auth', amount: 3200, dueDate: '10 يوليو', status: 'overdue' },
    { id: 'EXT-2026-0290', supplier: 'SendGrid', service: 'Email Service', amount: 1840, dueDate: '5 يوليو', status: 'paid' },
    { id: 'EXT-2026-0281', supplier: 'DigitalOcean', service: 'Backup Servers', amount: 2650, dueDate: '2 يوليو', status: 'paid' },
    { id: 'EXT-2026-0270', supplier: 'Google Maps API', service: 'Geolocation Services', amount: 940, dueDate: '28 يونيو', status: 'overdue' },
  ];

  readonly kpis = {
    total: this.invoices.length,
    paid: this.invoices.filter((i) => i.status === 'paid').length,
    pending: this.invoices.filter((i) => i.status === 'pending').length,
    overdue: this.invoices.filter((i) => i.status === 'overdue').length,
  };

  readonly filteredInvoices = computed(() => {
    const tab = this.activeTab();
    const term = this.searchTerm().trim().toLowerCase();
    return this.invoices.filter((inv) => {
      const matchesTab = tab === 'all' || inv.status === tab;
      const matchesTerm =
        !term || inv.id.toLowerCase().includes(term) || inv.supplier.toLowerCase().includes(term);
      return matchesTab && matchesTerm;
    });
  });

  setTab(tab: TabKey) {
    this.activeTab.set(tab);
  }

  formatAmount(v: number): string {
    return v.toLocaleString('ar-SA') + ' $';
  }

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportList() {
    this.showToast('تم تصدير القائمة بنجاح');
  }

  uploadInvoice() {
    this.showToast('رفع فاتورة جديدة — سيتم استخراج البيانات تلقائياً عبر OCR');
  }

  payInvoice(inv: InInvoice) {
    this.showToast(`إجراء دفع ${inv.id} — تجهيز مستقبلي غير مفعّل في V1`);
  }
}
