import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderApiService, ProviderInvoice, ProviderInvoicesResponse } from '../../../../../core/services/provider-api.service';
import { handleLoadError } from '../../../../../core/utils/rate-limit.util';

@Component({
	selector: 'app-provider-invoices',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './invoices.html',
	styleUrls: ['./invoices.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent implements OnInit {
	private providerApi = inject(ProviderApiService);
	summary = signal<ProviderInvoicesResponse['summary'] | null>(null);
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	toast = signal<string | null>(null);

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
		this.hasError.set(false);
		// GET /provider/finance/invoices: one invoice per delivered stage, with the platform commission and the provider's net
		this.providerApi.getProviderInvoices().subscribe({
			next: res => { this.invoices.set(res?.data?.invoices ?? []); this.summary.set(res?.data?.summary ?? null); this.isLoading.set(false); },
			error: (err) => handleLoadError(err, {
				hasData: () => this.invoices().length > 0,
				onKeep: () => this.isLoading.set(false),
				onRateLimit: () => { this.hasError.set(true); this.isLoading.set(false); },
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
	downloadInvoice(_inv: ProviderInvoice, event: Event): void {
		event.stopPropagation();
		window.print();
	}

	retry() {
		this.loadInvoices();
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
