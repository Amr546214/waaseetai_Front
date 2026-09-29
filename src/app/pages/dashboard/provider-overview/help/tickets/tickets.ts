import { Component, ChangeDetectionStrategy, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService, SupportTicket } from '../../../../../core/services/ticket-api.service';

interface Ticket {
	id: string;
	code: string;
	title: string;
	category: string;
	timestamp: string;
	status: 'review' | 'wait' | 'open' | 'solved' | 'closed';
	statusLabel: string;
	icon: 'check' | 'doc' | 'list';
}

function formatRelative(iso: string): string {
	const diffMs = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diffMs / 60000);
	if (mins < 1) return 'الآن';
	if (mins < 60) return `قبل ${mins} دقيقة`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `قبل ${hours} ساعة`;
	const days = Math.floor(hours / 24);
	if (days === 1) return 'أمس';
	if (days < 7) return `قبل ${days} أيام`;
	return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function mapTicket(t: SupportTicket): Ticket {
	const map: Record<SupportTicket['status'], { status: Ticket['status']; label: string; icon: Ticket['icon'] }> = {
		OPEN: { status: 'open', label: 'مفتوحة', icon: 'list' },
		IN_PROGRESS: { status: 'review', label: 'قيد المراجعة', icon: 'list' },
		AWAITING_CUSTOMER: { status: 'wait', label: 'بانتظار ردّك', icon: 'list' },
		RESOLVED: { status: 'solved', label: 'محلولة', icon: 'check' },
		CLOSED: { status: 'closed', label: 'مغلقة', icon: 'doc' },
	};
	const m = map[t.status];
	return {
		id: t.id,
		code: t.ticketNumber,
		title: t.subject,
		category: t.category,
		timestamp: formatRelative(t.createdAt),
		status: m.status,
		statusLabel: m.label,
		icon: m.icon,
	};
}

@Component({
	selector: 'app-provider-tickets',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './tickets.html',
	styleUrls: ['./tickets.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketsComponent implements OnInit {
	private authStore = inject(AuthStore);
	private ticketApi = inject(TicketApiService);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	filter = signal<string>('all');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);

	tickets = signal<Ticket[]>([]);

	ngOnInit() {
		this.loadTickets();
	}

	loadTickets() {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.ticketApi.listTickets('provider').subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success) {
					this.tickets.set((res.data?.items || []).map(mapTicket));
				} else {
					this.hasError.set(true);
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	filters = computed(() => {
		const t = this.tickets();
		const count = (pred: (t: Ticket) => boolean) => t.filter(pred).length;
		return [
			{ key: 'all', label: 'الكل', count: t.length },
			{ key: 'open', label: 'مفتوحة', count: count(x => x.status === 'open') },
			{ key: 'review', label: 'قيد المراجعة', count: count(x => x.status === 'review') },
			{ key: 'wait', label: 'بانتظار ردّك', count: count(x => x.status === 'wait') },
			{ key: 'solved', label: 'محلولة', count: count(x => x.status === 'solved') },
			{ key: 'closed', label: 'مغلقة', count: count(x => x.status === 'closed') }
		];
	});

	stats = computed(() => {
		const t = this.tickets();
		return {
			openCount: t.filter(x => x.status === 'open' || x.status === 'review').length,
			waitCount: t.filter(x => x.status === 'wait').length,
			solvedCount: t.filter(x => x.status === 'solved').length,
		};
	});

	filteredTickets = computed(() => {
		const f = this.filter();
		const t = this.tickets();
		if (f === 'all') return t;
		return t.filter(x => x.status === f);
	});

	setFilter(key: string) {
		this.filter.set(key);
	}

	statusClass(status: string): string {
		return `tks-${status}`;
	}

	routeId(id: string): string {
		return id;
	}
}
