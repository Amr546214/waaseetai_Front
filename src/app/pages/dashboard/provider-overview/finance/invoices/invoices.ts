import { WsAmountPipe } from '../../../../../shared/money/money.pipe';
import { LoadRetryComponent } from '../../../../../sheards/load-retry/load-retry';
import { RateLimitNoteComponent } from '../../../../../sheards/load-retry/rate-limit-note';
import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderApiService, ProviderInvoice, ProviderInvoicesResponse } from '../../../../../core/services/provider-api.service';
import { handleLoadError } from '../../../../../core/utils/rate-limit.util';
import { formatWsDate } from '../../../../../shared/ws-date/ws-date.pipe';

@Component({
	selector: 'app-provider-invoices',
	standalone: true,
	imports: [WsAmountPipe, CommonModule, RouterModule, LoadRetryComponent, RateLimitNoteComponent],
	templateUrl: './invoices.html',
	styleUrls: ['./invoices.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent implements OnInit {
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
		return formatWsDate(value, 'date', 'yyyy/MM/dd');
	}

	/** PDF = the browser's print dialog ("Save as PDF") until a server-generated document exists. */
	downloadInvoice(_inv: ProviderInvoice, event: Event): void {
		event.stopPropagation();
		window.print();
	}

	retry() {
		this.loadInvoices();
	}
}
