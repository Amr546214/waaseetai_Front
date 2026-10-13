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

	// The backend has no company approval workflow yet: the list stays empty (the page says so) instead of showing example requests.
	requests: ApprovalRequest[] = [];

	get filters() {
		const count = (st: ApprovalRequest['status']) => this.requests.filter(r => r.status === st).length;
		return [
			{ id: 'pending', label: 'بانتظار الاعتماد', count: count('pending') },
			{ id: 'approved', label: 'معتمد', count: count('approved') },
			{ id: 'rejected', label: 'مرفوض', count: count('rejected') }
		];
	}

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
