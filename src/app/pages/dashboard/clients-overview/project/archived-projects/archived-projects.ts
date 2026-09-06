import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

type ProjectStatus = 'done' | 'cancel' | 'arch';
type FilterStatus = 'all' | ProjectStatus;

interface ArchivedProject {
	id: string;
	title: string;
	provider: string;
	amount: string;
	dateStr: string;
	status: ProjectStatus;
	icon: string;
	contractReference?: string;
	canRate?: boolean;
	hasRated?: boolean;
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

	searchQuery = signal<string>('');
	activeFilter = signal<FilterStatus>('all');
	isLoading = signal(true);
	hasError = signal(false);
	errorMessage = signal<string | null>(null);

	projects = signal<ArchivedProject[]>([]);

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
			const matchesSearch = p.id.toLowerCase().includes(query) || p.title.toLowerCase().includes(query) || p.provider.toLowerCase().includes(query);
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

		const icon = status === 'done' ? 'check' : status === 'cancel' ? 'list' : 'doc';

		const amount = p.totalPrice != null
			? `${Number(p.totalPrice).toLocaleString('ar-SA')} ريال`
			: p.amount || '—';

		let dateStr = '—';
		if (p.completedAt || p.updatedAt || p.createdAt) {
			try {
				dateStr = new Date(p.completedAt || p.updatedAt || p.createdAt).toLocaleDateString('ar-SA', {
					year: 'numeric',
					month: 'short',
					day: 'numeric',
				});
			} catch {
				dateStr = p.completedAt || p.updatedAt || '—';
			}
		}

		return {
			id: String(p.id),
			title: p.title || 'مشروع بدون عنوان',
			provider: p.provider?.name || p.providerName || 'مقدم الخدمة',
			amount,
			dateStr,
			status,
			icon,
			contractReference: p.contractReference || p.contractId || undefined,
			canRate: Boolean(p.canRate),
			hasRated: Boolean(p.hasRated),
		};
	}
}
