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
	stats = [
		{ lbl: 'إجمالي المبيعات', val: '145,000 دولار', color: 'teal', ico: 'wallet' },
		{ lbl: 'هذا الشهر', val: '32,500 دولار', color: 'blue', ico: 'chart' },
		{ lbl: 'عدد المبيعات', val: '24', color: 'green', ico: 'check' },
		{ lbl: 'متوسط قيمة الطلب', val: '6,041 دولار', color: 'amber', ico: 'tag' }
	];

	topModels = [
		{ name: 'تطوير تطبيق جوال', sales: 8, revenue: 58000, pct: 40 },
		{ name: 'تصميم هوية بصرية', sales: 6, revenue: 24000, pct: 17 },
		{ name: 'تصميم موقع', sales: 5, revenue: 35000, pct: 24 },
		{ name: 'كتابة محتوى', sales: 5, revenue: 12000, pct: 8 },
		{ name: 'استشارة تقنية', sales: 0, revenue: 16000, pct: 11 }
	];

	sales: Sale[] = [
		{ id: 'S-2026-024', model: 'تطوير تطبيق جوال', client: 'شركة التجارة', amount: 12000, date: '2026-09-10', status: 'completed' },
		{ id: 'S-2026-023', model: 'تصميم هوية بصرية', client: 'مؤسسة التقنية', amount: 8000, date: '2026-09-08', status: 'completed' },
		{ id: 'S-2026-022', model: 'تصميم موقع', client: 'شركة الإبداع', amount: 18000, date: '2026-09-05', status: 'pending' },
		{ id: 'S-2026-021', model: 'كتابة محتوى', client: 'أحمد العتيبي', amount: 3500, date: '2026-09-03', status: 'completed' },
		{ id: 'S-2026-020', model: 'استشارة تقنية', client: 'سارة القحطاني', amount: 2500, date: '2026-09-01', status: 'completed' },
		{ id: 'S-2026-019', model: 'تطوير تطبيق جوال', client: 'شركة الأفق', amount: 35000, date: '2026-08-28', status: 'refunded' },
		{ id: 'S-2026-018', model: 'تصميم موقع', client: 'مؤسسة النور', amount: 15000, date: '2026-08-25', status: 'completed' }
	];

	statusLabel(s: string): string {
		return s === 'completed' ? 'مكتمل' : s === 'pending' ? 'قيد المعالجة' : 'مسترد';
	}
}
