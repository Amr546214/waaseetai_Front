import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface CustomerRequest {
	id: string; client: string; model: string; budget: number; days: number;
	status: 'new' | 'negotiating' | 'accepted' | 'declined'; date: string;
}

@Component({
	selector: 'app-customer-requests',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './customer-requests.component.html',
	styleUrls: ['./customer-requests.component.css']
})
export class CustomerRequestsComponent {
	activeFilter = 'all';

	filters = [
		{ id: 'all', label: 'الكل', count: 8 },
		{ id: 'new', label: 'جديد', count: 3 },
		{ id: 'negotiating', label: 'قيد التفاوض', count: 2 },
		{ id: 'accepted', label: 'مقبول', count: 2 },
		{ id: 'declined', label: 'مرفوض', count: 1 }
	];

	requests: CustomerRequest[] = [
		{ id: 'REQ-2026-042', client: 'شركة التجارة الرقمية', model: 'تطوير تطبيق تجارة', budget: 45000, days: 30, status: 'negotiating', date: '2026-09-10' },
		{ id: 'REQ-2026-041', client: 'مؤسسة التقنية المتقدمة', model: 'تصميم هوية بصرية', budget: 12000, days: 14, status: 'new', date: '2026-09-11' },
		{ id: 'REQ-2026-040', client: 'أحمد العتيبي', model: 'كتابة محتوى تسويقي', budget: 3500, days: 7, status: 'new', date: '2026-09-11' },
		{ id: 'REQ-2026-039', client: 'شركة الإبداع', model: 'تصميم موقع', budget: 18000, days: 21, status: 'accepted', date: '2026-09-08' },
		{ id: 'REQ-2026-038', client: 'سارة القحطاني', model: 'استشارة تقنية', budget: 2500, days: 3, status: 'new', date: '2026-09-09' },
		{ id: 'REQ-2026-037', client: 'مؤسسة النور', model: 'تطوير تطبيق جوال', budget: 35000, days: 25, status: 'negotiating', date: '2026-09-07' },
		{ id: 'REQ-2026-036', client: 'محمد الزهراني', model: 'تصميم واجهة', budget: 8000, days: 10, status: 'accepted', date: '2026-09-05' },
		{ id: 'REQ-2026-035', client: 'شركة الأفق', model: 'كتابة محتوى', budget: 5000, days: 7, status: 'declined', date: '2026-09-03' }
	];

	get filteredRequests(): CustomerRequest[] {
		if (this.activeFilter === 'all') return this.requests;
		return this.requests.filter(r => r.status === this.activeFilter);
	}

	setFilter(filter: string) {
		this.activeFilter = filter;
	}

	statusLabel(s: string): string {
		return s === 'new' ? 'جديد' : s === 'negotiating' ? 'قيد التفاوض' : s === 'accepted' ? 'مقبول' : 'مرفوض';
	}
}
