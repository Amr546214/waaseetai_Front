import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type InvoiceStatus = 'official' | 'processing' | 'auto-renew';
type TabKey = 'all' | InvoiceStatus;

interface SubInvoice {
  id: string;
  subscriber: string;
  plan: string;
  planColor: string;
  amount: string;
  amountColor: string;
  issueDate: string;
  status: InvoiceStatus;
}

@Component({
  selector: 'app-sa-sub-invoices',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-sub-invoices.html',
  styleUrl: './sa-sub-invoices.css',
})
export class SaSubInvoices {
  activeTab = signal<TabKey>('all');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'official', label: 'فاتورة رسمية داخلية' },
    { key: 'processing', label: 'قيد التجهيز' },
    { key: 'auto-renew', label: 'تجديد تلقائي' },
  ];

  readonly statusLabels: Record<InvoiceStatus, string> = {
    official: 'فاتورة رسمية داخلية',
    processing: 'قيد التجهيز',
    'auto-renew': 'تجديد تلقائي',
  };

  readonly statusColors: Record<InvoiceStatus, string> = {
    official: '#0FA99A',
    processing: '#D98A0B',
    'auto-renew': '#5DA0FF',
  };

  readonly kpis = [
    { label: 'إجمالي فواتير الاشتراك', value: '4,821', unit: 'فاتورة هذا الشهر', sub: '+124 عن الشهر الماضي', color: '#2BD4C7', subColor: '#0FA99A' },
    { label: 'فواتير رسمية داخلية', value: '4,812', unit: 'فاتورة', sub: 'تجهيز مستقبلي غير مفعّل في V1', color: '#0FA99A', subColor: '#6B7699' },
    { label: 'إجمالي القيمة', value: '2.96M', unit: 'دولار أمريكي', sub: 'هذا الشهر', color: '#2BD4C7', subColor: '#6B7699' },
    { label: 'قيد التجهيز', value: '9', unit: 'فاتورة', sub: 'تحتاج مراجعة', color: '#FFB400', subColor: '#D98A0B' },
  ];

  readonly invoices: SubInvoice[] = [
    { id: 'SINV-4821', subscriber: 'هيثم القرني', plan: 'Pro', planColor: '#2BD4C7', amount: '299 $', amountColor: '#0FA99A', issueDate: '1 يوليو', status: 'official' },
    { id: 'SINV-4820', subscriber: 'نورة السهلي', plan: 'Business', planColor: '#59C1F5', amount: '699 $', amountColor: '#0FA99A', issueDate: '1 يوليو', status: 'official' },
    { id: 'SINV-4815', subscriber: 'خالد المطيري', plan: 'أساسي', planColor: '#5DA0FF', amount: '99 $', amountColor: '#FFB400', issueDate: '1 يوليو', status: 'processing' },
    { id: 'SINV-4810', subscriber: 'شركة الأفق', plan: 'Enterprise', planColor: '#FF8C69', amount: '5,750 $', amountColor: '#0FA99A', issueDate: '1 يناير', status: 'official' },
    { id: 'SINV-4804', subscriber: 'فاطمة العتيبي', plan: 'أساسي', planColor: '#5DA0FF', amount: '99 $', amountColor: '#5DA0FF', issueDate: '1 يوليو', status: 'auto-renew' },
    { id: 'SINV-4799', subscriber: 'علي الشمري', plan: 'Pro', planColor: '#2BD4C7', amount: '299 $', amountColor: '#0FA99A', issueDate: '30 يونيو', status: 'official' },
  ];

  filteredInvoices = computed(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.invoices;
    return this.invoices.filter((i) => i.status === tab);
  });

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
  }
}
