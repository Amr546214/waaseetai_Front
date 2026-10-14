import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingScore, RatingStatus } from '../../../../../core/models/rating.model';
import { RatingSavedCard } from '../../../../../sheards/rating-saved-card/rating-saved-card.component';
import { SettlementSummary } from '../../../../../sheards/settlement-summary/settlement-summary.component';
import { formatMoney } from '../../../../../core/utils/money.util';

@Component({
	selector: 'app-provider-rating-page',
	standalone: true,
	imports: [CommonModule, FormsModule, RatingSavedCard, SettlementSummary],
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

	// What the server says BEFORE any form is shown (eligibility + the saved review). Never assumed from the progress payload.
	status = signal<RatingStatus | null>(null);
	view = computed<'form' | 'saved' | 'blocked'>(() => {
		const st = this.status();
		if (!st) return 'blocked';
		if (st.review) return 'saved';
		return st.canRate ? 'form' : 'blocked';
	});

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
				this.loadStatus(true);
			},
			error: event => {
				this.error.set(event?.error?.message || 'تعذر تحميل بيانات المشروع');
				this.isLoading.set(false);
			},
		});
	}

	/** Reads eligibility + the saved review. A failure is an error with a retry, never "not rated yet". */
	private loadStatus(initial = false) {
		this.ratingApi.getRatingStatus('provider', this.projectId).subscribe({
			next: st => { this.status.set(st); if (initial) this.isLoading.set(false); },
			error: event => {
				if (initial) { this.error.set(event?.error?.message || 'تعذر قراءة حالة التقييم'); this.isLoading.set(false); }
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
		return formatMoney(amount);
	}

	submit() {
		const rating = this.selectedRating();
		if (rating === 0) {
			this.submitError.set('الرجاء اختيار تقييم من 1 إلى 5 نجوم');
			return;
		}
		if (this.submitting() || !this.status()?.canRate) return;
		this.submitting.set(true);
		this.submitError.set('');
		const payload: { rating: RatingScore; comment?: string; tags?: string[] } = { rating };
		const note = this.comment.trim();
		if (note) payload.comment = note;
		if (this.chips().length) payload.tags = this.chips();

		// On success the page switches to the SAVED review read from the server (a refresh or a direct link shows the same card).
		this.ratingApi.rateClient(this.projectId, payload).subscribe({
			next: () => {
				this.submitting.set(false);
				this.submitSuccess.set(true);
				this.loadStatus();
			},
			error: (err: any) => {
				this.submitting.set(false);
				if (err?.status === 409) { this.loadStatus(); return; } // another window rated first (or the project was settled): show what the server holds
				this.submitError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
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

	retry() {
		this.error.set('');
		this.loadProject();
	}
}
