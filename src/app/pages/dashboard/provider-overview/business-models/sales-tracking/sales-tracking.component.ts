import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Sale {
	id: string; model: string; client: string; amount: number; date: string;
	status: 'completed' | 'pending' | 'refunded';
}

@Component({
	selector: 'app-sales-tracking',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './sales-tracking.component.html',
	styleUrls: ['./sales-tracking.component.css']
})
export class SalesTrackingComponent {
	// No sales data source exists for this page yet: nothing is invented, the figures show "—" and the lists are empty.
	stats = [
		{ lbl: 'إجمالي المبيعات', val: '—', color: 'teal', ico: 'wallet' },
		{ lbl: 'هذا الشهر', val: '—', color: 'blue', ico: 'chart' },
		{ lbl: 'عدد المبيعات', val: '—', color: 'green', ico: 'check' },
		{ lbl: 'متوسط قيمة الطلب', val: '—', color: 'amber', ico: 'tag' }
	];

	topModels: { name: string; sales: number; revenue: number; pct: number }[] = [];

	sales: Sale[] = [];

	statusLabel(s: string): string {
		return s === 'completed' ? 'مكتمل' : s === 'pending' ? 'قيد المعالجة' : 'مسترد';
	}
}
