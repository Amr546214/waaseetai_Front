import { reportMoney } from '../../../../../core/reports/report-document';
import { ReportPrintService } from '../../../../../core/reports/report-print.service';
import { LoadRetryComponent } from '../../../../../sheards/load-retry/load-retry';
import { RateLimitNoteComponent } from '../../../../../sheards/load-retry/rate-limit-note';
import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderApiService, ProviderInvoice, ProviderInvoicesResponse } from '../../../../../core/services/provider-api.service';
import { handleLoadError } from '../../../../../core/utils/rate-limit.util';

@Component({
	selector: 'app-provider-invoices',
	standalone: true,
	imports: [CommonModule, RouterModule, LoadRetryComponent, RateLimitNoteComponent],
	templateUrl: './invoices.html',
	styleUrls: ['./invoices.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent implements OnInit {
  private readonly reportPrinter = inject(ReportPrintService);
	private providerApi = inject(ProviderApiService);
	summary = signal<ProviderInvoicesResponse['summary'] | null>(null);
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	/** the failed load was a 429 (nothing loaded) / a 429 while invoices are shown */
	rateLimited = signal(false);
	rateLimitKept = signal(false);

	activeTab = signal<'all' | 'paid' | 'due'>('all');

	invoices = signal<ProviderInvoice[]>([]);

	filteredInvoices = computed(() => {
		const tab = this.activeTab();
		if (tab === 'all') return this.invoices();
		return this.invoices().filter(inv => inv.status === tab);
	});

	totalInvoices = computed(() => this.invoices().length);
	paidInvoices = computed(() => this.invoices().filter(i => i.status === 'paid').length);
	dueInvoices = computed(() => this.invoices().filter(i => i.status === 'due').length);

	ngOnInit(): void {
		this.loadInvoices();
	}

	loadInvoices(): void {
		this.isLoading.set(true);
		this.hasError.set(false); this.rateLimited.set(false); this.rateLimitKept.set(false);
		// GET /provider/finance/invoices: one invoice per delivered stage, with the platform commission and the provider's net
		this.providerApi.getProviderInvoices().subscribe({
			next: res => { this.invoices.set(res?.data?.invoices ?? []); this.summary.set(res?.data?.summary ?? null); this.isLoading.set(false); },
			error: (err) => handleLoadError(err, {
				hasData: () => this.invoices().length > 0,
				onKeep: () => { this.rateLimitKept.set(true); this.isLoading.set(false); },
				onRateLimit: () => { this.hasError.set(true); this.rateLimited.set(true); this.isLoading.set(false); },
				onOtherError: () => { this.invoices.set([]); this.hasError.set(true); this.isLoading.set(false); },
			})
		});
	}

	setTab(tab: 'all' | 'paid' | 'due') {
		this.activeTab.set(tab);
	}

	formatDate(value: string): string {
		return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: providerTimeZone() }).format(new Date(value));
	}

	/** PDF = the browser's print dialog ("Save as PDF") until a server-generated document exists. */
	downloadInvoice(inv: ProviderInvoice, event: Event): void {
		event.stopPropagation();
		if(this.isLoading()||this.hasError())return;
    this.reportPrinter.print({title:'تفاصيل فاتورة مقدم الخدمة',metadata:[['رقم الفاتورة',inv.id],['تاريخ الفاتورة',this.formatDate(inv.date)]],sections:[{title:'بيانات الدفعة',facts:[['المشروع',inv.projectTitle||inv.project],['المرحلة',inv.stageTitle],['العميل',inv.clientName],['قيمة المرحلة',reportMoney(inv.stageValue,inv.currency)],['عمولة المنصة',reportMoney(inv.platformCommission,inv.currency)],['صافي المستحق',reportMoney(inv.net,inv.currency)],['الحالة',inv.status==='paid'?'مدفوعة':'مستحقة'],['تاريخ الدفع',inv.paymentDate?this.formatDate(inv.paymentDate):'—']]}],note:'تفاصيل دفعة مستخرجة من السجلات، وليست فاتورة ضريبية معتمدة.'});
	}

	retry() {
		this.loadInvoices();
	}
}
