import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

type ProjectStatus = 'done' | 'cancel' | 'arch';
type FilterStatus = 'all' | ProjectStatus;

interface ArchivedProject {
	id: string;
	code: string;
	title: string;
	providerName: string;
	amount: string;
	dateStr: string;
	closedLabel: string;
	status: ProjectStatus;
	icon: 'check' | 'doc' | 'cart' | 'list' | 'warn';
	canRate?: boolean;
	hasRated?: boolean;
}

interface ArchivedKpi {
	icon: 'check' | 'warn' | 'doc' | 'list';
	value: string | number;
	label: string;
	color: 'teal' | 'amber' | 'blue' | 'ai';
}

@Component({
	selector: 'app-archived-projects',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './archived-projects.html',
	styleUrl: './archived-projects.css',
})
export class ArchivedProjects implements OnInit {
	private http = inject(HttpClient);
	private authStore = inject(AuthStore);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	searchQuery = signal<string>('');
	activeFilter = signal<FilterStatus>('all');
	isLoading = signal(true);
	hasError = signal(false);
	errorMessage = signal<string | null>(null);

	projects = signal<ArchivedProject[]>([]);

	kpis = computed<ArchivedKpi[]>(() => {
		const all = this.projects();
		const done = all.filter(p => p.status === 'done').length;
		const cancel = all.filter(p => p.status === 'cancel').length;
		const arch = all.filter(p => p.status === 'arch').length;
		return [
			{ icon: 'check', value: done, label: 'مكتملة', color: 'teal' },
			{ icon: 'warn', value: cancel, label: 'ملغاة', color: 'amber' },
			{ icon: 'doc', value: arch, label: 'مؤرشفة', color: 'blue' },
			{ icon: 'list', value: all.length, label: 'إجمالي المنتهية', color: 'ai' },
		];
	});

	tabs = computed(() => [
		{ id: 'all' as const, label: 'الكل', count: this.projects().length },
		{ id: 'done' as const, label: 'مكتملة', count: this.projects().filter(p => p.status === 'done').length },
		{ id: 'cancel' as const, label: 'ملغاة', count: this.projects().filter(p => p.status === 'cancel').length },
		{ id: 'arch' as const, label: 'مؤرشفة', count: this.projects().filter(p => p.status === 'arch').length },
	]);

	showRatingModal = signal(false);
	ratingTarget = signal<ArchivedProject | null>(null);
	ratingStars = signal(0);
	ratingComment = signal('');
	ratingSubmitting = signal(false);
	ratingError = signal<string | null>(null);

	private readonly page = 1;
	private readonly limit = 10;

	ngOnInit() {
		this.fetchCompletedProjects();
	}

	fetchCompletedProjects() {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.errorMessage.set(null);

		this.http.get<any>(
			`${environment.url_api}/client/my-requests/completed-projects?page=${this.page}&limit=${this.limit}`
		).subscribe({
			next: (response) => {
				this.isLoading.set(false);
				if (!response?.success && !response?.data) {
					this.hasError.set(true);
					this.errorMessage.set(response?.message || 'تعذر تحميل المشاريع');
					return;
				}
				const rawProjects = response.data?.projects || response.data?.items || [];
				const mapped: ArchivedProject[] = rawProjects.map((p: any) => this.normaliseProject(p));
				this.projects.set(mapped);
			},
			error: (err) => {
				this.isLoading.set(false);
				this.hasError.set(true);
				this.errorMessage.set(err?.error?.message || err?.message || 'تعذر تحميل المشاريع المنتهية');
			}
		});
	}

	filteredProjects = computed(() => {
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase();

		return this.projects().filter(p => {
			const matchesFilter = filter === 'all' || p.status === filter;
			const matchesSearch = p.id.toLowerCase().includes(query) || p.title.toLowerCase().includes(query) || p.providerName.toLowerCase().includes(query);
			return matchesFilter && matchesSearch;
		});
	});

	setFilter(filter: FilterStatus) {
		this.activeFilter.set(filter);
	}

	updateSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		this.searchQuery.set(target.value);
	}

	statusLabel(status: ProjectStatus): string {
		if (status === 'done') return 'مكتمل';
		if (status === 'cancel') return 'ملغى';
		return 'مؤرشف';
	}

	formatNumber(value: string | number): string {
		if (typeof value === 'number') return value.toLocaleString('en-US');
		return value;
	}

	getCount(status: FilterStatus): number {
		if (status === 'all') return this.projects().length;
		return this.projects().filter(p => p.status === status).length;
	}

	retry() {
		this.fetchCompletedProjects();
	}

	openRatingModal(event: Event, project: ArchivedProject) {
		event.stopPropagation();
		event.preventDefault();
		this.ratingTarget.set(project);
		this.ratingStars.set(0);
		this.ratingComment.set('');
		this.ratingError.set(null);
		this.ratingSubmitting.set(false);
		this.showRatingModal.set(true);
	}

	closeRatingModal() {
		this.showRatingModal.set(false);
		this.ratingTarget.set(null);
		this.ratingStars.set(0);
		this.ratingComment.set('');
		this.ratingError.set(null);
		this.ratingSubmitting.set(false);
	}

	setRatingStar(star: number) {
		this.ratingStars.set(star);
	}

	updateRatingComment(event: Event) {
		const target = event.target as HTMLTextAreaElement;
		this.ratingComment.set(target.value);
	}

	submitRating() {
		const target = this.ratingTarget();
		const stars = this.ratingStars();
		if (!target || stars < 1 || stars > 5) {
			this.ratingError.set('يرجى اختيار تقييم من 1 إلى 5 نجوم');
			return;
		}
		this.ratingSubmitting.set(true);
		this.ratingError.set(null);

		const payload = { rating: stars, comment: this.ratingComment().trim() || undefined };

		this.http.post<any>(
			`${environment.url_api}/client/my-requests/${target.id}/rate`,
			payload
		).subscribe({
			next: (response) => {
				this.ratingSubmitting.set(false);
				if (response?.success) {
					this.projects.update(projects =>
						projects.map(p =>
							p.id === target.id ? { ...p, canRate: false, hasRated: true } : p
						)
					);
					this.closeRatingModal();
				} else {
					this.ratingError.set(response?.message || 'تعذر إرسال التقييم');
				}
			},
			error: (err) => {
				this.ratingSubmitting.set(false);
				this.ratingError.set(err?.error?.message || err?.message || 'تعذر إرسال التقييم');
			}
		});
	}

	ratingStarArray(): number[] {
		return [1, 2, 3, 4, 5];
	}

	private normaliseProject(p: any): ArchivedProject {
		const rawStatus = String(p.status || p.projectStatus || '').toUpperCase();
		let status: ProjectStatus = 'done';
		if (['CANCELLED', 'CANCELED', 'CANCEL'].includes(rawStatus)) status = 'cancel';
		else if (['DISPUTED', 'ARCHIVED', 'CLOSED'].includes(rawStatus)) status = 'arch';
		else status = 'done';

		const icon: ArchivedProject['icon'] =
			status === 'done' ? 'check' :
			status === 'cancel' ? 'list' :
			'doc';

		const numericAmount = p.totalPrice != null ? Number(p.totalPrice) : Number(p.amount) || 0;
		const amount = numericAmount > 0
			? `${numericAmount.toLocaleString('en-US')} $`
			: '—';

		let dateStr = '—';
		const rawDate = p.completedAt || p.updatedAt || p.createdAt;
		if (rawDate) {
			try {
				dateStr = new Date(rawDate).toLocaleDateString('ar-SA-u-nu-latn', {
					year: 'numeric', month: 'short', day: 'numeric',
				});
			} catch {
				dateStr = String(rawDate);
			}
		}

		const closedPrefix = status === 'cancel' ? 'أُلغي' : status === 'arch' ? 'أُرشف' : 'أُغلق';
		const closedLabel = dateStr && dateStr !== '—' ? `${closedPrefix} ${dateStr}` : closedPrefix;

		// Provider name — defensive: handle string, object, or missing
		let providerName = 'مقدم الخدمة';
		const rawProvider = p.provider;
		if (typeof rawProvider === 'string' && rawProvider.trim()) {
			providerName = rawProvider.trim();
		} else if (rawProvider && typeof rawProvider === 'object') {
			providerName = rawProvider.name || rawProvider.fullName || rawProvider.username || providerName;
		} else if (typeof p.providerName === 'string' && p.providerName.trim()) {
			providerName = p.providerName.trim();
		}

		const code = p.code || p.reference || p.contractReference || `PRJ-${String(p.id)}`;

		return {
			id: String(p.id),
			code,
			title: p.title || 'مشروع بدون عنوان',
			providerName,
			amount,
			dateStr,
			closedLabel,
			status,
			icon,
			canRate: Boolean(p.canRate),
			hasRated: Boolean(p.hasRated),
		};
	}
}
