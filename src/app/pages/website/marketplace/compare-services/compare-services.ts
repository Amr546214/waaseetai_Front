import { Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';

const MAX_COMPARE = 3;

@Component({
	selector: 'app-compare-services',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './compare-services.html',
	styleUrl: './compare-services.css'
})
export class CompareServicesComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private marketplaceService = inject(MarketplaceService);

	models = signal<MarketplaceModel[]>([]);
	loading = signal<boolean>(true);
	maxCompare = MAX_COMPARE;

	winnerId = computed(() => {
		const list = this.models();
		if (!list.length) return null;
		return [...list].sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))[0]?.id || null;
	});

	cheapestModel = computed(() => {
		const list = this.models();
		if (!list.length) return null;
		return [...list].sort((a, b) => (a.totalAmount || 0) - (b.totalAmount || 0))[0];
	});

	fastestModel = computed(() => {
		const list = this.models();
		if (!list.length) return null;
		return [...list].sort((a, b) => (a.totalDays || 0) - (b.totalDays || 0))[0];
	});

	topRatedModel = computed(() => {
		const list = this.models();
		if (!list.length) return null;
		return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
	});

	emptySlots = computed(() => Math.max(0, this.maxCompare - this.models().length));
	emptySlotsArray = computed(() => Array.from({ length: this.emptySlots() }));

	ngOnInit(): void {
		this.route.queryParams.subscribe(params => {
			const idsParam: string = params['ids'] || '';
			const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean).slice(0, MAX_COMPARE);
			this.loadModels(ids);
		});
	}

	private loadModels(ids: string[]) {
		if (!ids.length) {
			this.models.set([]);
			this.loading.set(false);
			return;
		}
		this.loading.set(true);
		const requests = ids.map(id =>
			this.marketplaceService.getPublishedModelById(id).pipe(catchError(() => of(null)))
		);
		forkJoin(requests).subscribe(results => {
			const models = results
				.map(res => (res && (res as any).success ? (res as any).data : res))
				.filter((m): m is MarketplaceModel => !!m && !!m.id);
			this.models.set(models);
			this.loading.set(false);
			if (isPlatformBrowser(this.platformId)) {
				setTimeout(() => this.initParticles(), 0);
			}
		});
	}

	removeModel(id: string) {
		const remaining = this.models().filter(m => m.id !== id).map(m => m.id);
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { ids: remaining.join(',') || null },
			queryParamsHandling: 'merge'
		});
	}

	goToMarketplaceToAdd() {
		this.router.navigate(['/marketplace']);
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
