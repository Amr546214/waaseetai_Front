import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { handleLoadError, rateLimitToastMessage } from '../../../../../core/utils/rate-limit.util';
import { formatMoney } from '../../../../../core/utils/money.util';

interface Project {
	id: string;
	title: string;
	status: 'wait' | 'run' | 'late' | 'review' | 'pending';
	statusLabel: string;
	progress: number;
	providerName: string;
	providerInitial: string;
	providerAvatarColor: string;
	currentStage: string;
	escrowAmount: string;
	rawPrice?: number;
	escrowLabel: string;
	meta: string;
	contractRef?: string;
	approvedStagesCount?: number;
	stagesCount?: number;
	daysLeft?: number;
	memberSpec?: string;
	clientName?: string;
	// Server-derived states (GET /provider/projects/active): rendered as they are, never guessed here.
	contractStatus?: string;
	escrowFunded?: boolean;
	heldAmount?: number;
	canUploadDelivery?: boolean;
	uploadBlockedReason?: string | null;
	awaitingClientReview?: boolean;
	revisionRequested?: boolean;
	revisionResubmitted?: boolean;
	disputeStatus?: string | null;
}

type ActiveFilter = 'all' | 'run' | 'wait' | 'late' | 'review' | 'pending';

@Component({
	selector: 'app-active',
	standalone: true,
	imports: [RouterLink],
	templateUrl: './active.html',
	styleUrl: './active.css',
})
export class Active implements OnInit {
	private activeProjectsService = inject(ActiveProjectsService);
	private authStore = inject(AuthStore);
	private route = inject(ActivatedRoute);

	activeFilter = signal<ActiveFilter>('all');
	memberFilter = signal<string>('all');
	sortBy = signal<'attn' | 'prog' | 'deadline'>('attn');
	searchQuery = signal('');

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	projects = signal<Project[]>([]);
	isLoading = signal(true);
	error = signal('');

	ngOnInit() {
		this.loadProjects();

		const requestedFilter = this.route.snapshot.queryParamMap.get('filter');
		if (this.isValidFilter(requestedFilter)) {
			this.setFilter(requestedFilter);
		}
	}

	private isValidFilter(value: string | null): value is ActiveFilter {
		return value === 'pending' || value === 'all' || value === 'run' || value === 'wait' || value === 'late' || value === 'review';
	}

	loadProjects() {
		this.isLoading.set(true);
		this.error.set('');
		this.activeProjectsService.getActiveProjects().subscribe({
			next: (res) => {
				if (res && res.data) {
					this.projects.set(res.data);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error fetching active projects', err);
				handleLoadError(err, {
					hasData: () => this.projects().length > 0,
					onKeep: () => this.isLoading.set(false),
					onRateLimit: (e) => { this.error.set(rateLimitToastMessage(e)); this.isLoading.set(false); },
					onOtherError: () => { this.error.set(err.error?.message || 'تعذر تحميل المشاريع النشطة'); this.isLoading.set(false); },
				});
			}
		});
	}

	filteredProjects = computed(() => {
		const f = this.activeFilter();
		const m = this.memberFilter();
		const q = this.searchQuery().toLowerCase();
		let list = this.projects();
		if (f !== 'all') list = list.filter(p => p.status === f);
		if (m !== 'all') list = list.filter(p => (p.providerName || '').toLowerCase().includes(m.toLowerCase()) || (p.providerInitial || '').toLowerCase() === m.toLowerCase());
		if (q) list = list.filter(p => (p.title || '').toLowerCase().includes(q));
		return list;
	});

	counts = computed(() => {
		const projs = this.projects();
		// Only funded escrows hold money: the server sends heldAmount = 0 for a contract without one.
		const totalEscrow = projs.reduce((sum, p) => sum + (p.heldAmount ?? 0), 0);
		const lateCount = projs.filter(p => p.status === 'late').length;

		return {
			all: projs.length,
			run: projs.filter(p => p.status === 'run').length,
			wait: projs.filter(p => p.status === 'wait').length,
			review: projs.filter(p => p.status === 'review').length,
			pending: projs.filter(p => p.status === 'pending').length,
			// Projects where the next move is the provider's (a delivery or a requested revision can be sent now).
			needsAction: projs.filter(p => p.canUploadDelivery).length,
			late: lateCount,
			totalEscrowFormatted: formatMoney(totalEscrow)
		};
	});

	teamMembers = computed(() => {
		const members = new Map<string, { name: string; initial: string; color: string }>();
		this.projects().forEach(p => {
			const key = p.providerName || 'unknown';
			if (!members.has(key)) {
				members.set(key, {
					name: p.providerName || 'مقدم خدمة',
					initial: p.providerInitial || 'مق',
					color: p.providerAvatarColor || '#2BD4C7'
				});
			}
		});
		return Array.from(members.values());
	});

	setFilter(filter: ActiveFilter) {
		this.activeFilter.set(filter);
	}

	setMemberFilter(member: string) {
		this.memberFilter.set(member);
	}

	setSortBy(sort: 'attn' | 'prog' | 'deadline') {
		this.sortBy.set(sort);
	}

	updateSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		this.searchQuery.set(input.value);
	}
}
