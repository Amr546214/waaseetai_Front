import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ClientFinanceService, ClientInvoice } from '../../../../../core/services/client-finance.service';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoices.html',
  styleUrl: './invoices.css',
})
export class Invoices implements OnInit {
  private router = inject(Router);
  private financeService = inject(ClientFinanceService);
  
  activeTab = signal<'all' | 'paid' | 'due'>('all');

  invoices = signal<ClientInvoice[]>([]);
  loading = signal(true);
  error = signal('');

  filteredInvoices = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.invoices();
    return this.invoices().filter(inv => inv.status === tab);
  });

  totalInvoices = computed(() => this.invoices().length);
  paidInvoices = computed(() => this.invoices().filter(i => i.status === 'paid').length);
  dueInvoices = computed(() => this.invoices().filter(i => i.status === 'due').length);
  totalTax = computed(() => Number(this.invoices().reduce((sum, invoice) => sum + invoice.tax, 0).toFixed(2)));
  verificationScore = computed(() => this.invoices().length
    ? Math.round(this.invoices().reduce((sum, invoice) => sum + invoice.verificationScore, 0) / this.invoices().length)
    : 0);

  ngOnInit(): void { this.loadInvoices(); }

  loadInvoices(): void {
    this.loading.set(true);
    this.error.set('');
    this.financeService.getInvoices().subscribe({
      next: response => {
        this.invoices.set(response?.success && Array.isArray(response.data?.invoices) ? response.data.invoices : []);
        this.loading.set(false);
      },
      error: event => {
        this.error.set(event.error?.message || 'تعذر تحميل الفواتير');
        this.loading.set(false);
      }
    });
  }

  setTab(tab: 'all' | 'paid' | 'due') {
    this.activeTab.set(tab);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }

  openInvoice(inv: ClientInvoice) {
    this.router.navigate(['/client-overview/finance/invoices', inv.sourceId]);
  }

  downloadInvoice(inv: ClientInvoice, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/client-overview/finance/invoices', inv.sourceId], { queryParams: { print: 1 } });
  }
}
