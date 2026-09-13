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

	private mockInvoices: ProviderInvoice[] = [
		{ id: 'INV-2026-0488', project: 'تصميم هوية بصرية · المرحلة 2', client: 'نورة التصميم', date: '2026-05-26', total: 2875, tax: 375, status: 'paid' },
		{ id: 'INV-2026-0471', project: 'تصميم هوية بصرية · المرحلة 1', client: 'نورة التصميم', date: '2026-05-18', total: 2300, tax: 300, status: 'paid' },
		{ id: 'INV-2026-0492', project: 'كتابة محتوى متجر · دفعة أولى', client: 'رشا الكاتبة', date: '2026-05-29', total: 1092, tax: 142, status: 'due' },
		{ id: 'INV-2026-0455', project: 'تطوير متجر إلكتروني · دفعة مقدمة', client: 'تقنية الرواد', date: '2026-05-12', total: 3450, tax: 450, status: 'due' },
		{ id: 'INV-2026-0399', project: 'استشارة تسويقية · مكتملة', client: 'مكتب أفق', date: '2026-04-30', total: 1725, tax: 225, status: 'paid' }
	];

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
		// No backend endpoint exists yet for provider invoices — using representative mock data
		// matching the design (P-PR-025) until the API is available.
		setTimeout(() => {
			this.invoices.set(this.mockInvoices);
			this.isLoading.set(false);
		}, 500);
	}

	setTab(tab: 'all' | 'paid' | 'due') {
		this.activeTab.set(tab);
	}

	formatDate(value: string): string {
		return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
	}

	downloadInvoice(inv: ProviderInvoice, event: Event): void {
		event.stopPropagation();
		this.showToast(`جارٍ تنزيل الفاتورة ${inv.id}`);
	}

	retry() {
		this.loadInvoices();
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}
}
