import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingScore } from '../../../../../core/models/rating.model';

@Component({
	selector: 'app-provider-rating-page',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './provider-rating-page.html',
	styleUrl: './provider-rating-page.css',
})
export class ProviderRatingPage implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private activeService = inject(ActiveProjectsService);
	private ratingApi = inject(RatingApiService);

	private projectId = '';

	// Project context loaded from provider workspace API (real data, no fakes)
	project = signal<any>(null);
	isLoading = signal(true);
	error = signal('');

	// Rating state
	hoverRating = signal<RatingScore | 0>(0);
	selectedRating = signal<RatingScore | 0>(0);
	comment = '';
	publish = true;
	chips = signal<string[]>([]);
	submitting = signal(false);
	submitError = signal('');
	submitSuccess = signal(false);

	// Already-rated state (provider has already rated this client for this project)
	hasRatedClient = signal(false);
	savedRating = signal<number | null>(null);
	savedComment = signal<string | null>(null);

	// Design P-PR-013 chips (provider rating client)
	availableChips: string[] = [
		'توصيات واضحة',
		'تعاون ممتاز',
		'ردود سريعة',
		'متطلبات منظمة',
		'احترام المواعيد',
		'قيمة عادلة للعمل',
	];

	stars: RatingScore[] = [1, 2, 3, 4, 5];

	ngOnInit() {
		this.projectId = this.route.snapshot.paramMap.get('id') || '';
		if (!this.projectId) {
			this.error.set('معرّف المشروع مفقود');
			this.isLoading.set(false);
			return;
		}
		this.loadProject();
	}

	private loadProject() {
		this.isLoading.set(true);
		this.error.set('');
		this.activeService.getProjectProgress(this.projectId).subscribe({
			next: response => {
				if (!response?.success || !response.data) {
					this.error.set('تعذر تحميل بيانات المشروع');
					this.isLoading.set(false);
					return;
				}
				this.project.set(response.data);
				// Check if provider already rated this client
				const pcr = response.data?.providerClientRating;
				if (pcr?.hasRated === true) {
					this.hasRatedClient.set(true);
					this.savedRating.set(pcr.rating ?? null);
					this.savedComment.set(pcr.comment ?? null);
					this.selectedRating.set((pcr.rating as RatingScore) || 0);
					this.comment = pcr.comment || '';
				}
				this.isLoading.set(false);
			},
			error: event => {
				this.error.set(event?.error?.message || 'تعذر تحميل بيانات المشروع');
				this.isLoading.set(false);
			},
		});
	}

	setHover(value: RatingScore | 0): void { this.hoverRating.set(value); }
	clearHover(): void { this.hoverRating.set(0); }
	selectRating(value: RatingScore): void {
		this.selectedRating.set(value);
		this.submitError.set('');
	}

	toggleChip(name: string): void {
		const current = this.chips();
		if (current.includes(name)) {
			this.chips.set(current.filter(c => c !== name));
		} else {
			this.chips.set([...current, name]);
		}
	}
	isChipOn(name: string): boolean { return this.chips().includes(name); }

	clientName(): string {
		const data = this.project();
		return data?.clientName || data?.client?.name || 'العميل';
	}
	projectTitle(): string {
		const data = this.project();
		return data?.title || data?.project || 'المشروع';
	}
	releasedAmount(): string {
		const data = this.project();
		const amount = data?.price ?? data?.amount ?? data?.totalAmount ?? 0;
		return Number(amount).toLocaleString('en-US');
	}

	submit() {
		const rating = this.selectedRating();
		if (rating === 0) {
			this.submitError.set('الرجاء اختيار تقييم من 1 إلى 5 نجوم');
			return;
		}
		if (this.submitting()) return;
		this.submitting.set(true);
		this.submitError.set('');
		const payload: { rating: RatingScore; comment?: string } = { rating };
		const note = this.comment.trim();
		if (note) payload.comment = note;

		// Provider rates client: call rateClient API, navigate to archived/completed projects.
		this.ratingApi.rateClient(this.projectId, payload).subscribe({
			next: () => {
				this.submitting.set(false);
				this.submitSuccess.set(true);
				setTimeout(() => this.router.navigate(['/provider-overview/projects/archived']), 1200);
			},
			error: (err: any) => {
				this.submitting.set(false);
				const msg = err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى';
				// If duplicate rating detected, reload project data to switch to read-only state.
				if (msg.includes('تم تقييم') || err?.status === 409) {
					this.submitError.set('تم تقييم العميل مسبقًا');
					this.loadProject();
				} else {
					this.submitError.set(msg);
				}
			},
		});
	}

	skip() {
		// Skip rating → provider archived/completed projects.
		this.router.navigate(['/provider-overview/projects/archived']);
	}

	back() {
		// Back to project progress page.
		this.router.navigate(['/provider-overview/projects/progress', this.projectId]);
	}

	goToArchived() {
		// Return to completed projects archive.
		this.router.navigate(['/provider-overview/projects/archived']);
	}

	savedStarsArray(): number[] {
		return [1, 2, 3, 4, 5];
	}

	savedRatingValue(): number {
		return this.savedRating() || 0;
	}

	retry() {
		this.error.set('');
		this.loadProject();
	}
}
