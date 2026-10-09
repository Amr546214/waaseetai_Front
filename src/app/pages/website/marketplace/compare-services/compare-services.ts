import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketplaceModel, MarketplaceService, byAiScoreDesc, hasAiScore } from '../../../../core/services/marketplace.service';

const MAX_COMPARE = 3;

@Component({
	selector: 'app-compare-services',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './compare-services.html',
	styleUrl: './compare-services.css'
})
export class CompareServicesComponent implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private marketplaceService = inject(MarketplaceService);

	models = signal<MarketplaceModel[]>([]);
	loading = signal<boolean>(true);
	maxCompare = MAX_COMPARE;

	winnerId = computed(() => {
		const list = this.models();
		if (!list.length) return null;
		// Batch 5: highest REAL stored AI score wins. No winner when nobody has a
		// score (the old `|| 0` sort crowned the first card with "AI 0") or
		// when the top score is tied (the old sort picked one arbitrarily).
		const ranked = [...list].sort(byAiScoreDesc);
		if (!hasAiScore(ranked[0]?.aiScore)) return null;
		const top = ranked[0].aiScore as number;
		if (ranked.length > 1 && ranked[1].aiScore === top) return null;
		return ranked[0].id || null;
	});

	winnerModel = computed(() => {
		const wid = this.winnerId();
		return wid ? this.models().find(m => m.id === wid) || null : null;
	});

	/** Design P-MK-017: winner feature ticks use a stronger teal tint. */
	readonly winnerYesStyle = 'background:rgba(43,212,199,.12);border-color:rgba(43,212,199,.3)';
	readonly starSlots = [0, 1, 2, 3, 4];

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

	/** Maps the level label to the design's badge colour class (P-MK-017). */
	levelClass(level?: string): string {
		switch ((level || '').trim()) {
			case 'خبير': return 'expert';
			case 'متقدم': return 'advanced';
			case 'محترف': return 'pro';
			default: return '';
		}
	}

	filledStars(rating: number | null | undefined): number {
		return Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
	}

	ordinal(index: number): string {
		return ['أولى', 'ثانية', 'ثالثة', 'رابعة'][index] || 'أخرى';
	}
}
