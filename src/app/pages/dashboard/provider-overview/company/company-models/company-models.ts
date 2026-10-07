import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ThemeService } from '../../../../../core/services/theme.service';

export interface CompanyModelCard {
	id: string;
	title: string;
	category: string;
	categorySlug?: string;
	tags: string[];
	aiScore: number;
	rating: number;
	reviewsCount?: number;
	viewsCount: number;
	status: string;
	/** false while the service is kept off the public market (provider KYC or specialty not approved). */
	marketVisible?: boolean;
	/** Arabic reason from the backend, shown as received (same field the provider models page uses). */
	marketNotice?: string | null;
	bgGradient?: string;
	iconColor?: string;
}

@Component({
	selector: 'app-company-models',
	standalone: true,
	imports: [CommonModule, RouterLink, FormsModule],
	templateUrl: './company-models.html',
	styleUrl: './company-models.css'
})
export class CompanyModels implements OnInit {
	private newProjectService = inject(NewProjectService);
	public themeService = inject(ThemeService);

	isLoading = signal<boolean>(true);
	errorMessage = signal<string | null>(null);

	models = signal<CompanyModelCard[]>([]);
	filterTabs = signal<{ id: string; name: string; count: number }[]>([{ id: 'all', name: 'الكل', count: 0 }]);
	stats = signal({ totalModels: 0, viewsThisMonth: 0, avgAiScore: 0, offersGenerated: 0, offersAccepted: 0 });

	activeCategory = signal<string>('all');
	activeSort = signal<'newest' | 'top-rated' | 'views'>('views');
	searchQuery = signal<string>('');

	filteredModels = computed<CompanyModelCard[]>(() => {
		let list = this.models();
		const cat = this.activeCategory();
		if (cat && cat !== 'all') {
			list = list.filter(m => m.categorySlug === cat || m.category === cat);
		}
		const q = this.searchQuery().trim().toLowerCase();
		if (q) {
			list = list.filter(m => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
		}
		const sort = this.activeSort();
		list = [...list].sort((a, b) => {
			if (sort === 'top-rated') return (b.aiScore || 0) - (a.aiScore || 0);
			if (sort === 'views') return (b.viewsCount || 0) - (a.viewsCount || 0);
			return 0; // 'newest' keeps API order
		});
		return list;
	});

	ngOnInit(): void {
		this.load();
	}

	load(): void {
		this.isLoading.set(true);
		this.errorMessage.set(null);
		this.newProjectService.getMyMarketModels({ _t: Date.now() }).subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && res.data) {
					this.models.set(res.data.models || []);
					if (res.data.filterTabs) this.filterTabs.set(res.data.filterTabs);
					if (res.data.stats) {
						this.stats.set({
							totalModels: res.data.stats.totalModels || (res.data.models || []).length,
							viewsThisMonth: res.data.stats.viewsThisMonth || 0,
							avgAiScore: res.data.stats.avgAiScore || 0,
							offersGenerated: res.data.stats.offersGenerated || 0,
							offersAccepted: res.data.stats.offersAccepted || 0
						});
					}
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.errorMessage.set('ERR-CO-MK-001: تعذر تحميل نماذج الشركة');
			}
		});
	}

	setCategory(catId: string): void {
		this.activeCategory.set(catId);
	}

	setSort(sort: 'newest' | 'top-rated' | 'views'): void {
		this.activeSort.set(sort);
	}

	/** Card badge: hidden by the owner / kept off the market by the backend (under review) / live. */
	statusBadge(model: CompanyModelCard): { text: string; cls: 'hidden-status' | 'review-status' | '' } {
		if (model.status === 'ARCHIVED') return { text: 'غير معروض', cls: 'hidden-status' };
		if (model.status === 'UNDER_REVIEW' || model.marketVisible === false) return { text: 'قيد المراجعة', cls: 'review-status' };
		return { text: '● في السوق', cls: '' };
	}

	/** Status rows built only from the model's real fields (status, stored AI score, client reviews) — never fixed ✓ marks or score thresholds. */
	checks(model: CompanyModelCard): { text: string; ok: boolean }[] {
		const live = (model.status === 'PUBLISHED' || model.status === 'APPROVED') && model.marketVisible !== false;
		return [
			{ text: live ? 'منشور في السوق' : 'قيد المراجعة', ok: live },
			{ text: model.aiScore > 0 ? `تقييم AI: ${model.aiScore}%` : 'لم يُقيَّم بتقييم AI بعد', ok: model.aiScore > 0 },
			{ text: (model.reviewsCount ?? 0) > 0 ? `تقييم العملاء: ${model.rating} (${model.reviewsCount})` : 'لا تقييمات من العملاء بعد', ok: (model.reviewsCount ?? 0) > 0 },
		];
	}
}
