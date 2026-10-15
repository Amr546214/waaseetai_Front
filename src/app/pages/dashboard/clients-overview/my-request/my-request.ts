import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectApiService } from '../../../../core/services/project-api.service';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { isRateLimitError, rateLimitToastMessage } from '../../../../core/utils/rate-limit.util';
import { formatMoney } from '../../../../core/utils/money.util';

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
	/** Tab ids are the server's stage groups (stageGroup) - one request is in exactly one of them. */
	tabs = signal<FilterTab[]>([
		{ id: 'all', label: 'الكل', count: 0 },
		{ id: 'open', label: 'مفتوحة للعروض', count: 0 },
		{ id: 'pending', label: 'بانتظار التعاقد', count: 0 },
		{ id: 'active', label: 'قيد التنفيذ', count: 0 },
		{ id: 'closed', label: 'مغلقة', count: 0 },
		{ id: 'draft', label: 'مسودات', count: 0 },
	]);

	currentFilter = signal<string>('all');
	isLoading = signal<boolean>(true);
	loadError = signal<string>('');

	searchText = signal<string>('');
	sortBy = signal<'newest' | 'oldest' | 'budget' | 'offers'>('newest');
	specialtyFilter = signal<string>('');
	showFilters = signal<boolean>(false);

	// Pagination state
	currentPage = signal<number>(1);
	itemsPerPage = 5;

	async ngOnInit() {
		try {
			this.isLoading.set(true);
			this.loadError.set('');
			const response = await firstValueFrom(this.projectApi.getMyRequests());
			if (response && (response.success || Array.isArray(response.data) || Array.isArray(response))) {
				const rawData = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : (response.data?.projects || []));
				const filters = response.filters || {};

				// Map backend projects. The state shown is the server's derived stage (request + contract + offers), never a guess from the raw status.
				const mappedRequests = rawData.map((p: any) => {
					const stage = String(p.stage || '');
					return {
						id: p.id,
						displayId: `#${p.id ? p.id.substring(0, 8).toUpperCase() : 'REQ'}`,
						name: p.title || p.name || 'طلب بدون عنوان',
						specialty: typeof p.specialty === 'string' ? p.specialty : (p.specialty?.nameAr || p.specialty?.name || 'عام'),
						createdAt: p.createdAt,
						budget: this.formatBudget(p),
						budgetValue: Number(p.budgetMax ?? p.budgetMin ?? 0) || 0,
						stage,
						stageLabel: p.stageLabel || this.getStatusLabel(stage),
						group: String(p.stageGroup || this.groupOfStage(stage)),
						offers: p.proposalsCount || p.proposals?.length || p._count?.proposals || 0
					};
				});
				this.requests.set(mappedRequests);

				const countOf = (group: string, key: string) => filters[key] ?? mappedRequests.filter((r: any) => r.group === group).length;
				const activeCount = countOf('active', 'activeCount');

				this.tabs.set([
					{ id: 'all', label: 'الكل', count: filters.allCount ?? mappedRequests.length },
					{ id: 'open', label: 'مفتوحة للعروض', count: countOf('open', 'openCount') },
					{ id: 'pending', label: 'بانتظار التعاقد', count: countOf('pending', 'pendingCount') },
					{ id: 'active', label: 'قيد التنفيذ', count: activeCount },
					{ id: 'closed', label: 'مغلقة', count: countOf('closed', 'closedCount') },
					{ id: 'draft', label: 'مسودات', count: countOf('draft', 'draftCount') },
				]);

				// Update global active count badge safely
				if (this.dashboardStore && typeof this.dashboardStore.setTotalActiveRequestsCount === 'function') {
					this.dashboardStore.setTotalActiveRequestsCount(activeCount);
				}
			}
		} catch (error: any) {
			console.error('Failed to load my requests', error);
			// a 429 keeps what was loaded; it only shows the temporary-error text (the page's existing error state with its retry)
			this.loadError.set(isRateLimitError(error) ? rateLimitToastMessage(error) : (error?.error?.message || 'تعذر تحميل طلباتك حاليًا، حاول مرة أخرى'));
		} finally {
			this.isLoading.set(false);
		}
	}

	/** Only used when an older server answers without stageGroup. */
	private groupOfStage(stage: string): string {
		if (stage === 'DRAFT') return 'draft';
		if (['OPEN', 'OFFERS_RECEIVED', 'UNDER_NEGOTIATION'].includes(stage)) return 'open';
		if (stage.startsWith('AWAITING')) return 'pending';
		if (['ACTIVE', 'DISPUTED'].includes(stage)) return 'active';
		return 'closed';
	}

	setFilter(filter: string) {
		this.currentFilter.set(filter);
		this.currentPage.set(1); // Reset to first page on filter change
	}

	specialties = computed(() => Array.from(new Set(this.requests().map((r: any) => r.specialty as string))).sort());
	activeFilterCount = computed(() => (this.specialtyFilter() ? 1 : 0));

	filteredRequests = computed(() => {
		const filter = this.currentFilter();
		const q = this.searchText().trim().toLowerCase();
		const spec = this.specialtyFilter();
		const list = this.requests().filter((r: any) =>
			(filter === 'all' || r.group === filter)
			&& (!spec || r.specialty === spec)
			&& (!q || `${r.name} ${r.displayId} ${r.specialty} ${r.stageLabel}`.toLowerCase().includes(q)));
		const time = (r: any) => new Date(r.createdAt).getTime() || 0;
		switch (this.sortBy()) {
			case 'oldest': return [...list].sort((a, b) => time(a) - time(b));
			case 'budget': return [...list].sort((a, b) => b.budgetValue - a.budgetValue);
			case 'offers': return [...list].sort((a, b) => b.offers - a.offers);
			default: return [...list].sort((a, b) => time(b) - time(a));
		}
	});

	onSearch(event: Event) {
		this.searchText.set((event.target as HTMLInputElement).value);
		this.currentPage.set(1);
	}
	onSort(event: Event) {
		this.sortBy.set((event.target as HTMLSelectElement).value as any);
		this.currentPage.set(1);
	}
	onSpecialty(event: Event) {
		this.specialtyFilter.set((event.target as HTMLSelectElement).value);
		this.currentPage.set(1);
	}
	toggleFilters() {
		this.showFilters.set(!this.showFilters());
	}

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

		if (fixedB) return `${formatMoney(fixedB)} $`;
		if (minB && maxB) return `${formatMoney(minB)} - ${formatMoney(maxB)} $`;
		if (minB) return `${formatMoney(minB)} $`;
		if (hourlyB) return `${formatMoney(hourlyB)} $/ساعة`;
		return 'غير محدد';
	}

	getStatusLabel(stage: string): string {
		switch (stage) {
			case 'DRAFT': return 'مسودة';
			case 'OPEN': return 'مفتوح لاستقبال العروض';
			case 'OFFERS_RECEIVED': return 'وصلتك عروض';
			case 'UNDER_NEGOTIATION': return 'قيد التفاوض';
			case 'AWAITING_CLIENT_SIGNATURE': return 'تم اختيار العرض، بانتظار توقيعك وتمويل الضمان';
			case 'AWAITING_FUNDING': return 'بانتظار تمويل الضمان';
			case 'AWAITING_PROVIDER_SIGNATURE': return 'بانتظار توقيع مقدم الخدمة';
			case 'ACTIVE': return 'قيد التنفيذ';
			case 'COMPLETED': return 'مكتمل';
			case 'CANCELLED': return 'ملغي';
			case 'DISPUTED': return 'نزاع مفتوح';
			default: return 'غير محدد';
		}
	}

	/** Status pill style per stage group (the wording comes from the server's stage label). */
	pillClass(req: any): string {
		if (req.stage === 'DISPUTED') return 'op-dispute';
		if (req.stage === 'CANCELLED') return 'op-cancel';
		return { open: 'op-active', pending: 'op-pending', active: 'op-active', closed: 'op-done', draft: 'op-draft' }[req.group as string] || 'op-pending';
	}

	/** The row's action link text; every link opens the request details page, which shows the real next step. */
	actionLabel(req: any): string {
		if (req.stage === 'OFFERS_RECEIVED' || req.stage === 'UNDER_NEGOTIATION') return 'عرض العروض';
		if (req.group === 'pending' || req.stage === 'DISPUTED') return 'متابعة';
		return 'التفاصيل';
	}
}
