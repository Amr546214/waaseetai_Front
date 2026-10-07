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

	requests: CustomerRequest[] = [];

	/** Counts come from the real list (no invented numbers). */
	get filters() {
		const n = (st: string) => this.requests.filter(r => r.status === st).length;
		return [
			{ id: 'all', label: 'الكل', count: this.requests.length },
			{ id: 'new', label: 'جديد', count: n('new') },
			{ id: 'negotiating', label: 'قيد التفاوض', count: n('negotiating') },
			{ id: 'accepted', label: 'مقبول', count: n('accepted') },
			{ id: 'declined', label: 'مرفوض', count: n('declined') }
		];
	}

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
