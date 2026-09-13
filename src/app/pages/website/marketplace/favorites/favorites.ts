import { Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';
import { AuthStore } from '../../../../core/store/auth.store';

@Component({
	selector: 'app-favorites',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './favorites.html',
	styleUrl: './favorites.css'
})
export class FavoritesComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private router = inject(Router);
	private marketplaceService = inject(MarketplaceService);
	private authStore = inject(AuthStore);

	favorites = signal<MarketplaceModel[]>([]);
	loading = signal<boolean>(true);
	requiresAuth = signal<boolean>(false);
	categoryFilter = signal<string>('all');
	sortBy = signal<'recent' | 'rating' | 'price' | 'ai'>('recent');
	removingIds = signal<Set<string>>(new Set());

	categories = computed(() => {
		const set = new Set<string>();
		this.favorites().forEach(m => { if (m.category) set.add(m.category); });
		return Array.from(set);
	});

	categoryCount(cat: string): number {
		return this.favorites().filter(m => m.category === cat).length;
	}

	filteredFavorites = computed(() => {
		let list = this.favorites();
		const cat = this.categoryFilter();
		if (cat !== 'all') list = list.filter(m => m.category === cat);
		const sort = this.sortBy();
		const sorted = [...list];
		if (sort === 'rating') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
		else if (sort === 'price') sorted.sort((a, b) => (a.totalAmount || 0) - (b.totalAmount || 0));
		else if (sort === 'ai') sorted.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
		return sorted;
	});

	averageRating = computed(() => {
		const list = this.favorites();
		if (!list.length) return '0.0';
		return (list.reduce((sum, m) => sum + (m.rating || 0), 0) / list.length).toFixed(1);
	});

	ngOnInit(): void {
		if (!this.authStore.isAuthenticated()) {
			this.requiresAuth.set(true);
			this.loading.set(false);
			return;
		}
		this.loadFavorites();
		if (isPlatformBrowser(this.platformId)) {
			setTimeout(() => this.initParticles(), 0);
		}
	}

	goToLogin() {
		this.router.navigate(['/auth/login'], { queryParams: { returnUrl: '/marketplace/favorites' } });
	}

	private loadFavorites() {
		this.loading.set(true);
		this.marketplaceService.getFavorites().pipe(catchError(() => of([]))).subscribe(res => {
			const ids: string[] = (res?.data || res || []).map((v: any) => (typeof v === 'string' ? v : v?.id)).filter(Boolean);
			if (!ids.length) {
				this.favorites.set([]);
				this.loading.set(false);
				return;
			}
			const requests = ids.map(id => this.marketplaceService.getPublishedModelById(id).pipe(catchError(() => of(null))));
			forkJoin(requests).subscribe(results => {
				const models = results
					.map(r => (r && (r as any).success ? (r as any).data : r))
					.filter((m): m is MarketplaceModel => !!m && !!m.id);
				this.favorites.set(models);
				this.loading.set(false);
			});
		});
	}

	setCategoryFilter(cat: string) {
		this.categoryFilter.set(cat);
	}

	setSort(sort: 'recent' | 'rating' | 'price' | 'ai') {
		this.sortBy.set(sort);
	}

	removeFavorite(id: string) {
		const set = new Set(this.removingIds());
		set.add(id);
		this.removingIds.set(set);
		this.marketplaceService.setFavorite(id, false).pipe(catchError(() => of(null))).subscribe(() => {
			this.favorites.set(this.favorites().filter(m => m.id !== id));
			const updated = new Set(this.removingIds());
			updated.delete(id);
			this.removingIds.set(updated);
		});
	}

	clearAll() {
		if (isPlatformBrowser(this.platformId) && !window.confirm('هل تريد مسح كل المفضلة؟')) return;
		const ids = this.favorites().map(m => m.id);
		ids.forEach(id => this.removeFavorite(id));
	}

	compareIds(): string {
		return this.favorites().slice(0, 3).map(m => m.id).join(',');
	}

	private initParticles() {
		const pc = document.getElementById('particles-container');
		if (!pc || pc.children.length > 0) return;
		const n = window.innerWidth < 768 ? 11 : 25;
		for (let i = 0; i < n; i++) {
			const p = document.createElement('div');
			p.className = 'particle';
			p.style.cssText = 'left:' + Math.random() * 100 + '%;width:' + (Math.random() * 3 + 2) + 'px;height:' + (Math.random() * 3 + 2) + 'px;animation-duration:' + (Math.random() * 20 + 15) + 's;animation-delay:-' + (Math.random() * 20) + 's';
			pc.appendChild(p);
		}
	}
}
