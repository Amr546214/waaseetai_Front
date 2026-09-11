import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

interface Project {
	id: string;
	title: string;
	status: 'wait' | 'run' | 'late' | 'review';
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
}

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

	activeFilter = signal<'all' | 'run' | 'wait' | 'late' | 'review'>('all');
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
				this.error.set(err.error?.message || 'تعذر تحميل المشاريع النشطة');
				this.isLoading.set(false);
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
		const totalEscrow = projs.reduce((sum, p) => {
			const price = p.rawPrice ?? (parseFloat((p.escrowAmount || '').replace(/[^0-9.]/g, '')) || 0);
			return sum + price;
		}, 0);
		const lateCount = projs.filter(p => p.status === 'late').length;

		return {
			all: projs.length,
			run: projs.filter(p => p.status === 'run').length,
			wait: projs.filter(p => p.status === 'wait').length,
			review: projs.filter(p => p.status === 'review').length,
			late: lateCount,
			totalEscrowFormatted: totalEscrow.toLocaleString('en-US'),
			healthStatus: lateCount > 0 ? 'تحتاج انتباه' : (projs.length > 0 ? 'ممتاز' : 'جيد')
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

	setFilter(filter: 'all' | 'run' | 'wait' | 'late' | 'review') {
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
