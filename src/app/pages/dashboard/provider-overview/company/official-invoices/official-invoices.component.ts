import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Invoice {
	id: string; client: string; amount: number; date: string; status: 'paid' | 'pending' | 'overdue'; taxNumber: string;
}

@Component({
	selector: 'app-official-invoices',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './official-invoices.component.html',
	styleUrls: ['./official-invoices.component.css']
})
export class OfficialInvoicesComponent {
	activeFilter = 'all';
	filters = [
		{ id: 'all', label: 'الكل', count: 12 },
		{ id: 'paid', label: 'مدفوعة', count: 8 },
		{ id: 'pending', label: 'معلقة', count: 3 },
		{ id: 'overdue', label: 'متأخرة', count: 1 }
	];

	invoices: Invoice[] = [
		{ id: 'INV-2026-042', client: 'شركة التجارة الرقمية', amount: 45000, date: '2026-09-10', status: 'paid', taxNumber: '300123456700003' },
		{ id: 'INV-2026-041', client: 'مؤسسة التقنية المتقدمة', amount: 12000, date: '2026-09-08', status: 'paid', taxNumber: '300123456700003' },
		{ id: 'INV-2026-040', client: 'شركة الإبداع', amount: 18000, date: '2026-09-05', status: 'pending', taxNumber: '300123456700003' },
		{ id: 'INV-2026-039', client: 'أحمد العتيبي', amount: 3500, date: '2026-09-03', status: 'paid', taxNumber: '300123456700003' },
		{ id: 'INV-2026-038', client: 'سارة القحطاني', amount: 2500, date: '2026-09-01', status: 'overdue', taxNumber: '300123456700003' },
		{ id: 'INV-2026-037', client: 'شركة الأفق', amount: 35000, date: '2026-08-28', status: 'paid', taxNumber: '300123456700003' },
		{ id: 'INV-2026-036', client: 'مؤسسة النور', amount: 15000, date: '2026-08-25', status: 'pending', taxNumber: '300123456700003' }
	];

	get filteredInvoices(): Invoice[] {
		if (this.activeFilter === 'all') return this.invoices;
		return this.invoices.filter(i => i.status === this.activeFilter);
	}

	setFilter(filter: string) {
		this.activeFilter = filter;
	}

	statusLabel(s: string): string {
		return s === 'paid' ? 'مدفوعة' : s === 'pending' ? 'معلقة' : 'متأخرة';
	}

	get totalAmount(): number {
		return this.invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
	}

	get pendingAmount(): number {
		return this.invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
	}
}
