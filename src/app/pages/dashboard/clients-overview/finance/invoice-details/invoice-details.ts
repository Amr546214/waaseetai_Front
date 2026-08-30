import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientFinanceService, ClientInvoice } from '../../../../../core/services/client-finance.service';

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-details.html',
  styleUrl: './invoice-details.css',
})
export class InvoiceDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private financeService = inject(ClientFinanceService);

  invoice = signal<ClientInvoice | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.financeService.getInvoice(id).subscribe({
        next: response => {
          this.invoice.set(response.data);
          this.loading.set(false);
          if (this.route.snapshot.queryParamMap.get('print') === '1') setTimeout(() => window.print(), 100);
        },
        error: event => {
          this.error.set(event.error?.message || 'تعذر تحميل الفاتورة');
          this.loading.set(false);
        }
      });
    } else { this.error.set('رقم الفاتورة غير صالح'); this.loading.set(false); }
  }

  goBack() {
    this.router.navigate(['/client-overview/finance/invoices']);
  }

  downloadPdf() {
    window.print();
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }
}
