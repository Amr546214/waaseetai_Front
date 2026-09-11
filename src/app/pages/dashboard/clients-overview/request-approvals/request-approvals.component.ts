import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface ApprovalRequest {
	id: string; type: string; title: string; requestedBy: string;
	amount?: string; date: string; status: 'pending' | 'approved' | 'rejected';
	priority: 'high' | 'med' | 'low';
}

@Component({
	selector: 'app-request-approvals',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './request-approvals.component.html',
	styleUrls: ['./request-approvals.component.css']
})
export class RequestApprovalsComponent {
	activeFilter = 'pending';

	filters = [
		{ id: 'pending', label: 'بانتظار الاعتماد', count: 5 },
		{ id: 'approved', label: 'معتمد', count: 12 },
		{ id: 'rejected', label: 'مرفوض', count: 2 }
	];

	requests: ApprovalRequest[] = [
		{ id: 'APR-2026-042', type: 'إنشاء طلب', title: 'طلب تطوير تطبيق تجارة إلكترونية', requestedBy: 'سارة القحطاني', amount: '45,000 ريال', date: '2026-09-11', status: 'pending', priority: 'high' },
		{ id: 'APR-2026-041', type: 'توقيع عقد', title: 'عقد تصميم هوية بصرية', requestedBy: 'أحمد العتيبي', amount: '12,000 ريال', date: '2026-09-10', status: 'pending', priority: 'high' },
		{ id: 'APR-2026-040', type: 'إيداع ضمان', title: 'إيداع ضمان مشروع موقع', requestedBy: 'محمد الزهراني', amount: '8,500 ريال', date: '2026-09-09', status: 'pending', priority: 'med' },
		{ id: 'APR-2026-039', type: 'تعديل نطاق', title: 'إضافة مرحلة اختبار', requestedBy: 'نورة الحربي', amount: '3,200 ريال', date: '2026-09-08', status: 'pending', priority: 'med' },
		{ id: 'APR-2026-038', type: 'سحب رصيد', title: 'طلب سحب من المحفظة', requestedBy: 'فاطمة الغامدي', amount: '5,000 ريال', date: '2026-09-07', status: 'pending', priority: 'low' },
		{ id: 'APR-2026-037', type: 'إنشاء طلب', title: 'طلب استشارة تقنية', requestedBy: 'سارة القحطاني', amount: '2,500 ريال', date: '2026-09-05', status: 'approved', priority: 'low' },
		{ id: 'APR-2026-036', type: 'توقيع عقد', title: 'عقد كتابة محتوى', requestedBy: 'أحمد العتيبي', amount: '6,000 ريال', date: '2026-09-03', status: 'approved', priority: 'med' },
		{ id: 'APR-2026-035', type: 'تعديل نطاق', title: 'تعديل تصميم الواجهة', requestedBy: 'محمد الزهراني', date: '2026-09-01', status: 'rejected', priority: 'low' }
	];

	get filteredRequests(): ApprovalRequest[] {
		return this.requests.filter(r => r.status === this.activeFilter);
	}

	setFilter(filter: string) {
		this.activeFilter = filter;
	}

	priorityLabel(p: string): string {
		return p === 'high' ? 'عالية' : p === 'med' ? 'متوسطة' : 'منخفضة';
	}
}
