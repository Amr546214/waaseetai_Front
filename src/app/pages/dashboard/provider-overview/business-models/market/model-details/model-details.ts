import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NewProjectService } from '../../../../../../core/services/new-project.service';
import { ThemeService } from '../../../../../../core/services/theme.service';
import { AuthStore } from '../../../../../../core/store/auth.store';
import { AccountType } from '../../../../../../core/models/auth.model';
import { MarketModel } from '../market';

export interface AiMetric {
	label: string;
	value: number;
}

@Component({
	selector: 'app-model-details',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './model-details.html',
	styleUrl: './model-details.css'
})
export class ModelDetails implements OnInit {
	private route = inject(ActivatedRoute);
	private newProjectService = inject(NewProjectService);
	public themeService = inject(ThemeService);
	private authStore = inject(AuthStore);
	private platformId = inject(PLATFORM_ID);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	model = signal<MarketModel | null>(null);
	isLoading = signal<boolean>(true);
	errorMessage = signal<string | null>(null);

	ratingStars = computed(() => {
		const rating = Math.round(this.model()?.rating || 0);
		return Array.from({ length: 5 }, (_, i) => i < rating);
	});

	aiMetrics = computed<AiMetric[]>(() => {
		const score = this.model()?.aiScore || 0;
		// Derived sub-metrics for visual breakdown — presentational only, based on the overall AI score.
		return [
			{ label: 'جودة التنفيذ', value: Math.min(100, score + 2) },
			{ label: 'أصالة العمل', value: Math.max(0, score - 1) },
			{ label: 'توافق مع السوق', value: Math.max(0, score - 2) },
			{ label: 'دقة التفاصيل', value: Math.min(100, score + 1) },
			{ label: 'ملاءمة التخصص', value: Math.min(100, score + 3) },
			{ label: 'إثبات الملكية', value: 100 }
		];
	});

	// `MarketModel` only ever carries an aggregate `reviewsCount`/`rating` from the
	// backend (GET /business-models/my-market-models) — there is no per-review
	// text/author/date field on the object. Individual review cards used to be
	// filled with two hardcoded canned quotes attributed to a fake "عميل سابق" for
	// every model with reviewsCount >= 1/2; that fabricated content has been
	// removed. Once the backend exposes real per-review records, wire them in here.

	async shareModel(): Promise<void> {
		if (!isPlatformBrowser(this.platformId)) return;
		const title = this.model()?.title || document.title;
		if (navigator.share) {
			await navigator.share({ title, url: window.location.href }).catch(() => undefined);
			return;
		}
		await navigator.clipboard?.writeText(window.location.href);
	}

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get('id');
		if (!id) {
			this.isLoading.set(false);
			this.errorMessage.set('ERR-PR-026-D: معرّف النموذج غير صالح');
			return;
		}
		this.loadModel(id);
	}

	loadModel(id: string): void {
		this.isLoading.set(true);
		this.errorMessage.set(null);
		this.newProjectService.getMyMarketModels({ _t: Date.now() }).subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				const models: MarketModel[] = res?.data?.models || [];
				const found = models.find(m => String(m.id) === String(id)) || null;
				if (found) {
					this.model.set(found);
				} else {
					this.errorMessage.set('ERR-PR-026-D-404: تعذر العثور على هذا النموذج');
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.errorMessage.set('ERR-PR-026-D: خطأ في استدعاء بيانات النموذج');
			}
		});
	}
}
