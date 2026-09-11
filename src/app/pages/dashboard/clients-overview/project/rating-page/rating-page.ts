import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingScore } from '../../../../../core/models/rating.model';

@Component({
	selector: 'app-rating-page',
	standalone: true,
	imports: [CommonModule, FormsModule],
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
					}
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
		return Number(amount).toLocaleString('en-US');
	}

	// Dynamic header text based on mode
	headerTitle(): string {
		return this.isStageRating ? 'قيّم هذه المرحلة' : 'اكتمل المشروع بنجاح';
	}
	headerSub(): string {
		if (this.isStageRating) {
			return `${this.projectTitle()} · ${this.stageTitle()} · شارك تقييمك حول جودة تسليم هذه المرحلة`;
		}
		return `${this.projectTitle()} · مع ${this.providerName()} · أُفرِج كامل المبلغ ${this.releasedAmount()} ريال`;
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
		this.submitting.set(true);
		this.submitError.set('');
		const payload: { rating: RatingScore; comment?: string } = { rating };
		const note = this.comment.trim();
		if (note) payload.comment = note;

		if (this.isStageRating) {
			// Stage rating: call rateStage API, navigate back to final-approval page.
			this.ratingApi.rateStage(this.projectId, this.stageId, payload).subscribe({
				next: () => {
					this.submitting.set(false);
					this.submitSuccess.set(true);
					setTimeout(() => this.router.navigate(['/client-overview/projects', this.projectId, 'final-approval']), 1200);
				},
				error: (err: any) => {
					this.submitting.set(false);
					this.submitError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
				},
			});
		} else {
			// Project/provider rating: call rateProvider API, navigate to archived/completed projects.
			this.ratingApi.rateProvider(this.projectId, payload).subscribe({
				next: () => {
					this.submitting.set(false);
					this.submitSuccess.set(true);
					setTimeout(() => this.router.navigate(['/client-overview/projects/archived']), 1200);
				},
				error: (err: any) => {
					this.submitting.set(false);
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
