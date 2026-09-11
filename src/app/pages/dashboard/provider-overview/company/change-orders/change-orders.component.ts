import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ChangeOrder {
	id: string;
	project: string;
	type: 'add-phase' | 'modify-scope' | 'change-date';
	description: string;
	requestedBy: string;
	date: string;
	impact: string;
	status: 'pending' | 'approved' | 'rejected';
}

@Component({
	selector: 'app-change-orders',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './change-orders.component.html',
	styleUrls: ['./change-orders.component.css']
})
export class ChangeOrdersComponent {
	activeFilter = 'all';

	filters = [
		{ id: 'all', label: 'الكل', count: 6 },
		{ id: 'pending', label: 'قيد الانتظار', count: 3 },
		{ id: 'approved', label: 'موافق عليه', count: 2 },
		{ id: 'rejected', label: 'مرفوض', count: 1 }
	];

	orders: ChangeOrder[] = [
		{ id: 'CO-2026-001', project: 'منصة التجارة الرقمية', type: 'add-phase', description: 'إضافة مرحلة تطوير تطبيق الجوال للمشروع', requestedBy: 'أحمد العتيبي', date: '2026-09-12', impact: 'زيادة الميزانية بـ 25,000 ريال', status: 'pending' },
		{ id: 'CO-2026-002', project: 'نظام إدارة المخزون', type: 'modify-scope', description: 'تعديل نطاق التكاملات ليشمل نظام المحاسبة', requestedBy: 'سارة القحطاني', date: '2026-09-10', impact: 'تأجيل التسليم بـ 5 أيام', status: 'pending' },
		{ id: 'CO-2026-003', project: 'تطبيق إدارة علاقات العملاء', type: 'change-date', description: 'تغيير موعد التسليم النهائي إلى 15 أكتوبر', requestedBy: 'محمد الزهراني', date: '2026-09-08', impact: 'تمديد الجدول الزمني', status: 'approved' },
		{ id: 'CO-2026-004', project: 'تصميم الهوية البصرية', type: 'add-phase', description: 'إضافة مرحلة تصميم المطبوعات', requestedBy: 'نورة الحربي', date: '2026-09-06', impact: 'زيادة الميزانية بـ 8,000 ريال', status: 'approved' },
		{ id: 'CO-2026-005', project: 'موقع الشركة التعريفي', type: 'modify-scope', description: 'إزالة قسم المدونة من النطاق الحالي', requestedBy: 'خالد الشمري', date: '2026-09-04', impact: 'تقليل الميزانية بـ 5,000 ريال', status: 'rejected' },
		{ id: 'CO-2026-006', project: 'لوحة التحكم التحليلية', type: 'change-date', description: 'تقديم موعد التسليم إلى 20 سبتمبر', requestedBy: 'فاطمة القحطاني', date: '2026-09-02', impact: 'تكثيف ساعات العمل', status: 'pending' }
	];

	get filteredOrders(): ChangeOrder[] {
		if (this.activeFilter === 'all') return this.orders;
		return this.orders.filter(o => o.status === this.activeFilter);
	}

	setFilter(filter: string): void {
		this.activeFilter = filter;
	}

	typeLabel(type: string): string {
		const map: Record<string, string> = {
			'add-phase': 'إضافة مرحلة',
			'modify-scope': 'تعديل نطاق',
			'change-date': 'تغيير موعد'
		};
		return map[type] || type;
	}

	statusLabel(status: string): string {
		const map: Record<string, string> = {
			pending: 'قيد الانتظار',
			approved: 'موافق عليه',
			rejected: 'مرفوض'
		};
		return map[status] || status;
	}

	approveOrder(order: ChangeOrder): void {
		order.status = 'approved';
	}

	rejectOrder(order: ChangeOrder): void {
		order.status = 'rejected';
	}

	previewOrder(order: ChangeOrder): void {
		console.log('Preview:', order.id);
	}
}
