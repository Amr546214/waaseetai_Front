import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type EInvoiceKind = 'B2B' | 'B2C';
type EInvoiceStatus = 'issued' | 'processing';

interface EInvoice {
  uuid: string;
  kind: EInvoiceKind;
  party: string;
  taxNumber: string;
  amount: string;
  hasQr: boolean;
  status: EInvoiceStatus;
}

interface StatusCard {
  title: string;
  color: string;
  value: string;
  valueColor: string;
  desc: string;
  icon: 'check' | 'shield';
}

@Component({
  selector: 'app-sa-future-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-future-billing.html',
  styleUrl: './sa-future-billing.css',
})
export class SaFutureBilling {
  toast = signal<string | null>(null);

  readonly statusCards: StatusCard[] = [
    { title: 'تكامل مستقبلي', color: '#2BD4C7', value: 'متصل', valueColor: '#0FA99A', desc: 'API نشط — استجابة 120ms', icon: 'check' },
    { title: 'الشهادة الرقمية', color: '#5DA0FF', value: 'صالحة', valueColor: '#5DA0FF', desc: 'تنتهي في 15 يناير 2027', icon: 'shield' },
    { title: 'آخر مزامنة', color: '#0FA99A', value: 'منذ 2 دقيقة', valueColor: '#2BD4C7', desc: '8,201 فاتورة مُزامَنة', icon: 'check' },
  ];

  readonly invoices: EInvoice[] = [
    { uuid: 'f82a-9c1e', kind: 'B2B', party: 'شركة الخليج', taxNumber: '310000000001233', amount: '6,670 $', hasQr: true, status: 'issued' },
    { uuid: 'a41d-77b3', kind: 'B2C', party: 'هيثم القرني', taxNumber: '—', amount: '343.85 $', hasQr: true, status: 'issued' },
    { uuid: 'c99e-3f2a', kind: 'B2B', party: 'مؤسسة النور', taxNumber: '310000000007841', amount: '14,260 $', hasQr: true, status: 'processing' },
    { uuid: 'b17f-5d09', kind: 'B2C', party: 'سارة القحطاني', taxNumber: '—', amount: '899.00 $', hasQr: true, status: 'issued' },
  ];

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  connectionStatus() {
    this.showToast('حالة الاتصال: متصل — API نشط (استجابة 120ms)');
  }

  syncNow() {
    this.showToast('مزامنة الفواتير الإلكترونية — تجهيز مستقبلي غير مفعّل في V1');
  }
}
