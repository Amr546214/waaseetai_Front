import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

interface FilterTab {
	id: string;
	label: string;
	count: number;
}

@Component({
	selector: 'app-my-request',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './my-request.html',
	styleUrl: './my-request.css',
})
export class MyRequest implements OnInit {
	private projectApi = inject(ProjectApiService);
	private dashboardStore = inject(DashboardStore);
	private authStore = inject(AuthStore);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	requests = signal<any[]>([]);
	tabs = signal<FilterTab[]>([
		{ id: 'all', label: 'الكل', count: 0 },
		{ id: 'active', label: 'نشطة', count: 0 },
		{ id: 'pending', label: 'معلقة', count: 0 },
		{ id: 'closed', label: 'مغلقة', count: 0 },
		{ id: 'draft', label: 'مسودات', count: 0 },
	]);

	currentFilter = signal<string>('all');
	isLoading = signal<boolean>(true);

	// Pagination state
	currentPage = signal<number>(1);
	itemsPerPage = 5;

	async ngOnInit() {
		try {
			this.isLoading.set(true);
			const response = await firstValueFrom(this.projectApi.getMyRequests());
			if (response && (response.success || Array.isArray(response.data) || Array.isArray(response))) {
				const rawData = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : (response.data?.projects || []));
				const filters = response.filters || {};

				// Map backend projects
				const mappedRequests = rawData.map((p: any) => ({
					id: p.id,
					displayId: `#${p.id ? p.id.substring(0, 8).toUpperCase() : 'REQ'}`,
					name: p.title || p.name || 'طلب بدون عنوان',
					specialty: typeof p.specialty === 'string' ? p.specialty : (p.specialty?.nameAr || p.specialty?.name || 'عام'),
					createdAt: p.createdAt,
					budget: this.formatBudget(p),
					status: this.mapBackendStatus(p.status),
					offers: p.proposalsCount || p.proposals?.length || p._count?.proposals || 0
				}));
				this.requests.set(mappedRequests);

				// Safely extract counts or compute fallback counts from mapped requests
				const allCount = filters.allCount ?? mappedRequests.length;
				const activeCount = filters.activeCount ?? mappedRequests.filter((r: any) => r.status === 'active').length;
				const pendingCount = filters.pendingCount ?? mappedRequests.filter((r: any) => r.status === 'pending').length;
				const closedCount = filters.closedCount ?? mappedRequests.filter((r: any) => r.status === 'closed').length;
				const draftCount = filters.draftCount ?? mappedRequests.filter((r: any) => r.status === 'draft').length;

				// Map tabs
				this.tabs.set([
					{ id: 'all', label: 'الكل', count: allCount },
					{ id: 'active', label: 'نشطة', count: activeCount },
					{ id: 'pending', label: 'معلقة', count: pendingCount },
					{ id: 'closed', label: 'مغلقة', count: closedCount },
					{ id: 'draft', label: 'مسودات', count: draftCount },
				]);

				// Update global active count badge safely
				if (this.dashboardStore && typeof this.dashboardStore.setTotalActiveRequestsCount === 'function') {
					this.dashboardStore.setTotalActiveRequestsCount(activeCount);
				}
			}
		} catch (error) {
			console.error('Failed to load my requests', error);
		} finally {
			this.isLoading.set(false);
		}
	}

	setFilter(filter: string) {
		this.currentFilter.set(filter);
		this.currentPage.set(1); // Reset to first page on filter change
	}

	filteredRequests = computed(() => {
		const filter = this.currentFilter();
		if (filter === 'all') return this.requests();
		return this.requests().filter((r: any) => r.status === filter);
	});

	// Pagination computed properties
	paginatedRequests = computed(() => {
		const filtered = this.filteredRequests();
		const startIndex = (this.currentPage() - 1) * this.itemsPerPage;
		return filtered.slice(startIndex, startIndex + this.itemsPerPage);
	});

	totalPages = computed(() => {
		return Math.ceil(this.filteredRequests().length / this.itemsPerPage);
	});

	pagesArray = computed(() => {
		return Array.from({ length: this.totalPages() }, (_, i) => i + 1);
	});

	goToPage(page: number) {
		if (page >= 1 && page <= this.totalPages()) {
			this.currentPage.set(page);
		}
	}

	formatBudget(p: any): string {
		const minB = p.budgetMin || p.minBudget;
		const maxB = p.budgetMax || p.maxBudget;
		const fixedB = p.budgetFixed || p.fixedBudget;
		const hourlyB = p.budgetHourly || p.hourlyBudget;

		if (fixedB) return `${Number(fixedB).toLocaleString()} $`;
		if (minB && maxB) return `${Number(minB).toLocaleString()} - ${Number(maxB).toLocaleString()} $`;
		if (minB) return `${Number(minB).toLocaleString()} $`;
		if (hourlyB) return `${Number(hourlyB).toLocaleString()} $/ساعة`;
		return 'غير محدد';
	}

	mapBackendStatus(status: string): string {
		if (!status) return 'active';
		const st = String(status).toUpperCase();
		switch (st) {
			case 'OPEN':
			case 'PUBLISHED':
			case 'UNDER_BIDDING':
			case 'IN_PROGRESS':
			case 'ACTIVE': return 'active';
			case 'PENDING':
			case 'PENDING_REVIEW':
			case 'AWAITING_DELIVERY': return 'pending';
			case 'COMPLETED':
			case 'CLOSED': return 'closed';
			case 'DISPUTED': return 'dispute';
			case 'DRAFT': return 'draft';
			default: return 'active';
		}
	}

	getStatusLabel(status: string): string {
		switch (status) {
			case 'active': return 'نشطة';
			case 'pending': return 'بانتظار التسليم';
			case 'dispute': return 'نزاع مفتوح';
			case 'closed': return 'مكتمل';
			case 'cancel': return 'ملغي';
			case 'draft': return 'مسودة';
			default: return status;
		}
	}
}
