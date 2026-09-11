import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface IncomingRequest {
	id: string;
	title: string;
	client: string;
	budget: number;
	date: string;
	status: 'new' | 'reviewing' | 'accepted' | 'declined';
}

@Component({
	selector: 'app-incoming-requests',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './incoming-requests.component.html',
	styleUrls: ['./incoming-requests.component.css']
})
export class IncomingRequestsComponent {
	activeFilter = 'all';

	filters = [
		{ id: 'all', label: 'الكل', count: 6 },
		{ id: 'new', label: 'جديد', count: 2 },
		{ id: 'reviewing', label: 'قيد المراجعة', count: 2 },
		{ id: 'accepted', label: 'مقبول', count: 1 },
		{ id: 'declined', label: 'مرفوض', count: 1 }
	];

	stats = [
		{ label: 'إجمالي الطلبات', value: 6, icon: 'total', color: 'blue' },
		{ label: 'قيد المراجعة', value: 2, icon: 'review', color: 'amber' },
		{ label: 'مقبول', value: 1, icon: 'accept', color: 'teal' },
		{ label: 'مرفوض', value: 1, icon: 'decline', color: 'red' }
	];

	requests: IncomingRequest[] = [
		{ id: 'REQ-2026-001', title: 'تطوير منصة تجارة إلكترونية متكاملة', client: 'شركة التجارة الرقمية', budget: 85000, date: '2026-09-12', status: 'new' },
		{ id: 'REQ-2026-002', title: 'تصميم هوية بصرية لعلامة تجارية', client: 'مؤسسة الإبداع', budget: 15000, date: '2026-09-11', status: 'new' },
		{ id: 'REQ-2026-003', title: 'بناء تطبيق جوال لإدارة المخزون', client: 'شركة الأفق للتقنية', budget: 60000, date: '2026-09-09', status: 'reviewing' },
		{ id: 'REQ-2026-004', title: 'تطوير نظام إدارة علاقات العملاء', client: 'مؤسسة النور', budget: 45000, date: '2026-09-07', status: 'reviewing' },
		{ id: 'REQ-2026-005', title: 'تصميم واجهة مستخدم للوحة تحكم', client: 'أحمد العتيبي', budget: 12000, date: '2026-09-05', status: 'accepted' },
		{ id: 'REQ-2026-006', title: 'موقع تعريفي لشركة عقارية', client: 'سارة القحطاني', budget: 8000, date: '2026-09-03', status: 'declined' }
	];

	get filteredRequests(): IncomingRequest[] {
		if (this.activeFilter === 'all') return this.requests;
		return this.requests.filter(r => r.status === this.activeFilter);
	}

	setFilter(filter: string): void {
		this.activeFilter = filter;
	}

	statusLabel(status: string): string {
		const map: Record<string, string> = {
			new: 'جديد',
			reviewing: 'قيد المراجعة',
			accepted: 'مقبول',
			declined: 'مرفوض'
		};
		return map[status] || status;
	}

	previewRequest(req: IncomingRequest): void {
		console.log('Preview:', req.id);
	}

	acceptRequest(req: IncomingRequest): void {
		req.status = 'accepted';
	}

	declineRequest(req: IncomingRequest): void {
		req.status = 'declined';
	}
}
