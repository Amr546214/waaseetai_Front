import { Component, OnInit, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarketplaceService, MarketplaceModel } from '../../../../../core/services/marketplace.service';
import { Card } from '../../../../../sheards/card/card';

@Component({
	selector: 'app-marketplace-preview',
	standalone: true,
	imports: [CommonModule, RouterLink, Card],
	templateUrl: './marketplace-preview.html',
	styleUrl: './marketplace-preview.css',
})
export class MarketplacePreview implements OnInit {
	private marketplaceService = inject(MarketplaceService);
	private platformId = inject(PLATFORM_ID);

	// Reactive state using Signals
	categories = signal<any[]>([]);
	models = signal<MarketplaceModel[]>([]);
	totalModelsCount = signal<number>(0);
	selectedCatId = signal<string>('all');
	sortBy = signal<string>('popular');
	isLoading = signal<boolean>(true);
	errorMsg = signal<string | null>(null);

	// Dynamic Computed filtered & sorted list (Top 8 highest rated/popular models)
	filteredModels = computed(() => {
		let items = [...this.models()];
		const cat = this.selectedCatId();
		const sort = this.sortBy();

		// 1. Filter by category slug or name
		if (cat !== 'all') {
			items = items.filter((m) => m.categorySlug === cat || (m.category && m.category.toLowerCase().includes(cat)));
		}

		// 2. Sort items
		if (sort === 'popular') {
			items.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.viewsCount || 0) - (a.viewsCount || 0));
		} else if (sort === 'newest') {
			items.reverse();
		} else if (sort === 'name') {
			items.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ar'));
		}

		// Return maximum 8 models as requested
		return items.slice(0, 8);
	});

	totalServicesCount = computed(() => {
		return this.totalModelsCount() || this.models().length;
	});

	ngOnInit(): void {
		if (isPlatformBrowser(this.platformId)) {
			this.loadData();
		}
	}

	loadData(): void {
		this.isLoading.set(true);
		this.errorMsg.set(null);

		// Fetch dynamic categories from Marketplace Service
		this.marketplaceService.getCategories().subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					const catList = res.data.categories || [];
					this.categories.set(catList);
					this.totalModelsCount.set(res.data.totalModelsCount || 0);
				}
			},
			error: (err) => {
				console.error('Failed to load marketplace categories:', err);
			}
		});

		// Fetch published marketplace models from DB
		this.marketplaceService.getPublishedModels({ page: 1, limit: 20 }).subscribe({
			next: (res) => {
				if (res && res.success && res.data && Array.isArray(res.data.models)) {
					this.models.set(res.data.models);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load marketplace models:', err);
				this.errorMsg.set('تعذر تحميل الخدمات المرفوعة من قاعدة البيانات.');
				this.isLoading.set(false);
			}
		});
	}

	selectCategory(catId: string): void {
		this.selectedCatId.set(catId);
	}

	onSortChange(event: Event): void {
		const target = event.target as HTMLSelectElement;
		if (target) {
			this.sortBy.set(target.value);
		}
	}


	getCategoryColor(index: number): { bg: string; color: string } {
		const colors = [
			{ bg: 'rgba(43,127,255,.12)', color: '#5DA0FF' },
			{ bg: 'rgba(43,212,199,.12)', color: 'var(--teal)' },
			{ bg: 'rgba(217,138,11,.12)', color: 'var(--kahr)' },
			{ bg: 'rgba(15,169,154,.12)', color: 'var(--green)' },
			{ bg: 'rgba(255,140,105,.12)', color: 'var(--red)' },
			{ bg: 'rgba(89,193,245,.12)', color: '#59C1F5' }
		];
		return colors[index % colors.length];
	}

	getCategoryIconSymbol(iconName?: string): string {
		if (!iconName) return '#ws-cat-code';
		if (iconName.startsWith('#')) return iconName;
		switch (iconName) {
			case 'code': return '#ws-cat-code';
			case 'design': case 'palette': return '#ws-cat-design';
			case 'marketing': case 'trending-up': return '#ws-cat-marketing';
			case 'writing': case 'feather': return '#ws-cat-writing';
			case 'video': return '#ws-cat-video';
			default: return '#ws-cat-consult';
		}
	}
}
