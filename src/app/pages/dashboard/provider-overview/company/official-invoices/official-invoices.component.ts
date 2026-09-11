import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Invoice {
	id: string;
	client: string;
	date: string;
	project: string;
	amount: number;
	tax: number;
	status: 'paid' | 'due';
}

@Component({
	selector: 'app-official-invoices',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './official-invoices.component.html',
	styleUrls: ['./official-invoices.component.css']
})
export class OfficialInvoicesComponent {
	activeFilter = signal<string>('all');
	toastMsg = signal<string>('');

	filters = [
		{ id: 'all', label: 'الكل', count: 5 },
		{ id: 'paid', label: 'مدفوعة', count: 3 },
		{ id: 'due', label: 'بانتظار الدفع', count: 2 },
	];

	invoices: Invoice[] = [
		{ id: 'INV-2026-0488', client: 'نورة التصميم', date: '2026-05-26', project: 'تصميم هوية بصرية · المرحلة 2', amount: 2875, tax: 375, status: 'paid' },
		{ id: 'INV-2026-0471', client: 'نورة التصميم', date: '2026-05-18', project: 'تصميم هوية بصرية · المرحلة 1', amount: 2300, tax: 300, status: 'paid' },
		{ id: 'INV-2026-0492', client: 'رشا الكاتبة', date: '2026-05-29', project: 'كتابة محتوى متجر · دفعة أولى', amount: 1092, tax: 142, status: 'due' },
		{ id: 'INV-2026-0455', client: 'تقنية الرواد', date: '2026-05-12', project: 'تطوير متجر · دفعة مقدمة', amount: 3450, tax: 450, status: 'due' },
		{ id: 'INV-2026-0399', client: 'مكتب أفق', date: '2026-04-30', project: 'استشارة تسويقية · مكتملة', amount: 1725, tax: 225, status: 'paid' },
	];

	filteredInvoices = computed(() => {
		if (this.activeFilter() === 'all') return this.invoices;
		return this.invoices.filter(i => i.status === this.activeFilter());
	});

	kpis = computed(() => ({
		total: this.invoices.length,
		paid: this.invoices.filter(i => i.status === 'paid').length,
		due: this.invoices.filter(i => i.status === 'due').length,
	}));

	setFilter(filter: string) {
		this.activeFilter.set(filter);
	}

	showToast(msg: string) {
		this.toastMsg.set(msg);
		setTimeout(() => this.toastMsg.set(''), 3000);
	}

	statusLabel(s: string): string {
		return s === 'paid' ? 'مدفوعة' : 'بانتظار الدفع';
	}
}
