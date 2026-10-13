import { Component, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ProviderInvoice {
	id: string;
	project: string;
	client: string;
	date: string;
	total: number;
	tax: number;
	status: 'paid' | 'due';
}

@Component({
	selector: 'app-provider-invoices',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './invoices.html',
	styleUrls: ['./invoices.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent implements OnInit {
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
		// No provider-invoices endpoint exists yet (client invoices come from GET /client/finance/invoices, derived from released stage deliveries).
		// Until a provider-side endpoint ships (proposal: GET /provider/finance/invoices) the list stays empty and the page says so honestly — no sample rows.
		this.invoices.set([]);
		this.isLoading.set(false);
	}

	setTab(tab: 'all' | 'paid' | 'due') {
		this.activeTab.set(tab);
	}

	formatDate(value: string): string {
		return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
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
