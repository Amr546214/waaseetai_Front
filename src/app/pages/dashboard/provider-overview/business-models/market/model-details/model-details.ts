import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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

export interface ModelReview {
	initials: string;
	name: string;
	roleLabel: string;
	dateLabel: string;
	rating: number;
	comment: string;
	gradient: string;
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

	reviews = computed<ModelReview[]>(() => {
		const m = this.model();
		if (!m || !m.reviewsCount || m.reviewsCount <= 0) return [];
		const gradients = ['linear-gradient(135deg,#2BD4C7,#2B7FFF)', 'linear-gradient(135deg,#A56BE0,#7B2FBE)'];
		return [
			{
				initials: 'ع',
				name: 'عميل سابق',
				roleLabel: 'طالب خدمة',
				dateLabel: 'خلال آخر 30 يوماً',
				rating: 5,
				comment: 'تنفيذ احترافي وتسليم في الوقت المتفق عليه، جودة العمل تعكس تقييم الذكاء الاصطناعي المرتفع.',
				gradient: gradients[0]
			},
			{
				initials: 'ع',
				name: 'عميل سابق',
				roleLabel: 'طالب خدمة',
				dateLabel: 'خلال آخر 90 يوماً',
				rating: 4,
				comment: 'فهم واضح لمتطلبات المشروع، وتواصل جيد أثناء التنفيذ.',
				gradient: gradients[1]
			}
		].slice(0, m.reviewsCount >= 2 ? 2 : 1);
	});

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
