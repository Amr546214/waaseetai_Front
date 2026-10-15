import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingScore, RatingStatus } from '../../../../../core/models/rating.model';
import { RatingSavedCard } from '../../../../../sheards/rating-saved-card/rating-saved-card.component';
import { RatingPublishChoice } from '../../../../../sheards/rating-publish-choice/rating-publish-choice.component';
import { SettlementSummary } from '../../../../../sheards/settlement-summary/settlement-summary.component';
import { formatMoney } from '../../../../../core/utils/money.util';

@Component({
	selector: 'app-rating-page',
	standalone: true,
	imports: [CommonModule, FormsModule, RatingSavedCard, SettlementSummary, RatingPublishChoice],
	templateUrl: './rating-page.html',
	styleUrl: './rating-page.css',
})
export class RatingPage implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	private ratingApi = inject(RatingApiService);

	private projectId = '';
	private stageId = '';
	isStageRating = false;

	// Project context loaded from workspace API (real data, no fakes)
	project = signal<any>(null);
	stage = signal<any>(null);
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

	// Project rating only: what the server says BEFORE any form is shown (eligibility + the saved review). Never assumed.
	status = signal<RatingStatus | null>(null);
	statusError = signal('');
	/** 'form' | 'saved' | 'blocked', for the project rating and (same shape) for the stage rating: always decided by the server status. */
	view = computed<'form' | 'saved' | 'blocked'>(() => {
		const st = this.status();
		if (!st) return 'blocked';
		if (st.review) return 'saved';
		return st.canRate ? 'form' : 'blocked';
	});

	// Design P-SK-017 chips (used for project/provider rating only)
	availableChips: string[] = [
		'جودة عالية',
		'التزام بالموعد',
		'تواصل ممتاز',
		'احترافية',
		'مرونة في التعديلات',
		'قيمة مقابل السعر',
	];

	stars: RatingScore[] = [1, 2, 3, 4, 5];

	ngOnInit() {
		this.projectId = this.route.snapshot.paramMap.get('id') || '';
		this.stageId = this.route.snapshot.paramMap.get('stageId') || '';
		this.isStageRating = !!this.stageId;
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
		this.statusError.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) {
					this.error.set('تعذر تحميل بيانات المشروع');
					this.isLoading.set(false);
					return;
				}
				this.project.set(response.data);
				if (this.isStageRating) {
					const found = response.data.stages?.find((s: any) => s.id === this.stageId) || null;
					this.stage.set(found);
					if (!found) {
						this.error.set('تعذر العثور على المرحلة المطلوبة');
						this.isLoading.set(false);
						return;
					}
				}
				this.loadStatus(true);
			},
			error: event => {
				this.error.set(event?.error?.message || 'تعذر تحميل بيانات المشروع');
				this.isLoading.set(false);
			},
		});
	}

	/** Reads eligibility + the saved review. A failure is shown as an error with a retry: it is never read as "not rated yet". */
	private loadStatus(initial = false) {
		const read = this.isStageRating ? this.ratingApi.getStageRatingStatus(this.projectId, this.stageId) : this.ratingApi.getRatingStatus('client', this.projectId);
		read.subscribe({
			next: st => { this.status.set(st); this.statusError.set(''); if (initial) this.isLoading.set(false); },
			error: event => {
				this.statusError.set(event?.error?.message || 'تعذر قراءة حالة التقييم');
				if (initial) { this.error.set(this.statusError()); this.isLoading.set(false); }
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

	providerName(): string {
		const data = this.project();
		return data?.clientName || data?.providerName || data?.provider?.name || 'مقدم الخدمة';
	}
	projectTitle(): string {
		const data = this.project();
		return data?.title || data?.project || 'المشروع';
	}
	stageTitle(): string {
		const s = this.stage();
		return s?.title || 'المرحلة';
	}
	releasedAmount(): string {
		const data = this.project();
		const amount = data?.price ?? data?.amount ?? data?.totalAmount ?? 0;
		return formatMoney(amount);
	}

	// Dynamic header text based on mode
	headerTitle(): string {
		const st = this.status();
		if (this.isStageRating) return st?.review ? 'تقييم المرحلة المحفوظ' : st?.canRate ? 'قيّم هذه المرحلة' : 'التقييم غير متاح الآن';
		// A project closed by a settlement is never presented as "completed successfully", whatever else is shown below.
		if (st?.adminSettled) return 'أُغلق بتسوية نزاع';
		if (st?.review) return 'تقييمك المحفوظ';
		return st?.canRate ? 'اكتمل المشروع بنجاح' : 'التقييم غير متاح الآن';
	}
	headerSub(): string {
		const st = this.status();
		if (this.isStageRating) {
			return st?.canRate ? `${this.projectTitle()} · ${this.stageTitle()} · شارك تقييمك حول جودة تسليم هذه المرحلة` : `${this.projectTitle()} · ${this.stageTitle()}`;
		}
		if (st && !st.canRate) return `${this.projectTitle()} · مع ${this.providerName()}${st.adminSettled ? ' · التوزيع الفعلي أدناه' : ''}`;
		return `${this.projectTitle()} · مع ${this.providerName()} · أُفرِج كامل المبلغ ${this.releasedAmount()} $`;
	}
	sectionTitle(): string {
		return this.isStageRating ? 'تقييم المرحلة' : 'قيّم تجربتك';
	}
	backLabel(): string {
		return this.isStageRating ? 'العودة إلى الاعتماد النهائي' : 'العودة إلى المشروع';
	}

	submit() {
		const rating = this.selectedRating();
		if (rating === 0) {
			this.submitError.set('الرجاء اختيار تقييم من 1 إلى 5 نجوم');
			return;
		}
		if (this.submitting()) return;
		// The form only exists while the server said the user may rate (project or stage).
		if (!this.status()?.canRate) return;
		this.submitting.set(true);
		this.submitError.set('');
		const payload: { rating: RatingScore; comment?: string; tags?: string[]; publish: boolean } = { rating, publish: this.publish };
		const note = this.comment.trim();
		if (note) payload.comment = note;
		if (this.chips().length) payload.tags = this.chips();

		if (this.isStageRating) {
			// Stage rating: on success the page switches to the SAVED stage review read from the server (same as the project rating).
			this.ratingApi.rateStage(this.projectId, this.stageId, payload).subscribe({
				next: () => {
					this.submitting.set(false);
					this.submitSuccess.set(true);
					this.loadStatus();
				},
				error: (err: any) => {
					this.submitting.set(false);
					// Another window rated first (or the project was settled): reload what the server holds instead of keeping a form with an error.
					if (err?.status === 409) { this.loadStatus(); return; }
					this.submitError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
				},
			});
		} else {
			// Project/provider rating. On success the page switches to the SAVED review (read from the server, so a refresh or a direct link shows the same card).
			this.ratingApi.rateProvider(this.projectId, payload).subscribe({
				next: () => {
					this.submitting.set(false);
					this.submitSuccess.set(true);
					this.loadStatus();
				},
				error: (err: any) => {
					this.submitting.set(false);
					if (err?.status === 409) {
						// Another window rated first (or the project was settled): load what the server holds instead of keeping a form with an error.
						this.loadStatus();
						return;
					}
					this.submitError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
				},
			});
		}
	}

	skip() {
		if (this.isStageRating) {
			// Skip stage rating → back to final approval page.
			this.router.navigate(['/client-overview/projects', this.projectId, 'final-approval']);
		} else {
			// Skip project rating → active projects list.
			this.router.navigate(['/client-overview/projects/active']);
		}
	}

	back() {
		if (this.isStageRating) {
			this.router.navigate(['/client-overview/projects', this.projectId, 'final-approval']);
		} else {
			this.router.navigate(['/client-overview/projects', this.projectId]);
		}
	}

	retry() {
		this.error.set('');
		this.loadProject();
	}
}
