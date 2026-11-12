import { reportMoney } from '../../../../../core/reports/report-document';
import { ReportPrintService } from '../../../../../core/reports/report-print.service';
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientFinanceService, ClientInvoice } from '../../../../../core/services/client-finance.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
  selector: 'app-invoice-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './invoice-details.html',
  styleUrl: './invoice-details.css',
})
export class InvoiceDetails implements OnInit {
  private readonly reportPrinter = inject(ReportPrintService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private financeService = inject(ClientFinanceService);
  private authStore = inject(AuthStore);
  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

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
          if (this.route.snapshot.queryParamMap.get('print') === '1') this.printInvoice();
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

  /** Opens the browser's print dialog (the user can save it as PDF). There is no server-generated PDF. */
  printInvoice() {
    const inv=this.invoice();if(!inv||this.loading()||this.error())return;
    this.reportPrinter.print({title:'تفاصيل فاتورة العميل',metadata:[['رقم الفاتورة',inv.id],['التاريخ',this.formatDate(inv.date)]],sections:[{title:'المشروع والدفعة',facts:[['المشروع',inv.projectTitle||inv.project],['المرحلة',inv.stageTitle],['مقدم الخدمة',inv.providerName],['القيمة قبل الخصم',reportMoney(inv.subtotal,'USD')],['الخصم',reportMoney(inv.discount??0,'USD')],['كود الخصم',inv.couponCode],['الإجمالي الفعلي',reportMoney(inv.total,'USD')],['الحالة',inv.status==='paid'?'مدفوعة':'مستحقة'],['تاريخ الدفع',this.formatDate(inv.paymentDate)]]}],note:'تفاصيل الدفعة المسجلة، وليست فاتورة ضريبية معتمدة.'});
  }

  formatDate(value: string | null): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  }
}
