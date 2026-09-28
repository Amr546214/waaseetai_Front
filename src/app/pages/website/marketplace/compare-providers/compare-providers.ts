import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketplaceService } from '../../../../core/services/marketplace.service';

const MAX_COMPARE = 3;

export interface CompareProviderCard {
	id: string;
	fullName: string;
	initials: string;
	avatarUrl?: string | null;
	levelName: string;
	isVerified: boolean;
	headline: string;
	aiScore: number;
	rating: number;
	reviewsCount: number;
	completedProjects: number;
	responseHours: number | null;
	hourlyRate: number | null;
	/** Lowest / highest totalAmount among the provider's published services. */
	minServicePrice: number | null;
	maxServicePrice: number | null;
	skills: string[];
	location: string;
}

function mapToCard(id: string, raw: any): CompareProviderCard | null {
	const data = raw?.data || raw;
	if (!data) return null;
	const prices: number[] = (data.services || [])
		.map((s: any) => Number(s?.totalAmount))
		.filter((n: number) => Number.isFinite(n) && n > 0);
	const fullName = data.header?.fullName || data.companyName || 'مزود خدمة';
	return {
		id,
		fullName,
		initials: fullName.substring(0, 2),
		avatarUrl: data.header?.avatarUrl || null,
		levelName: data.header?.levelInfo?.levelName || 'مبتدئ',
		isVerified: !!data.header?.isVerified,
		headline: data.basicInfo?.headline || 'مزود خدمة محترف',
		aiScore: data.specialties?.[0]?.aiMetrics?.aiScore || 0,
		rating: data.header?.stats?.clientRating ? Math.round((data.header.stats.clientRating / 20) * 10) / 10 : 0,
		reviewsCount: data.header?.stats?.reviewsCount || 0,
		completedProjects: data.header?.stats?.completedProjects || 0,
		responseHours: data.header?.avgResponseHours ?? null,
		hourlyRate: data.basicInfo?.hourlyRate ?? data.hourlyRate ?? null,
		minServicePrice: prices.length ? Math.min(...prices) : null,
		maxServicePrice: prices.length ? Math.max(...prices) : null,
		skills: (data.skills || []).slice(0, 4),
		location: data.header?.location || data.basicInfo?.location || 'غير محدد'
	};
}

@Component({
	selector: 'app-compare-providers',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './compare-providers.html',
	styleUrl: './compare-providers.css'
})
export class CompareProvidersComponent implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private marketplaceService = inject(MarketplaceService);

	providers = signal<CompareProviderCard[]>([]);
	loading = signal<boolean>(true);
	maxCompare = MAX_COMPARE;

	winnerId = computed(() => {
		const list = this.providers();
		if (!list.length) return null;
		return [...list].sort((a, b) => b.aiScore - a.aiScore)[0]?.id || null;
	});

	winner = computed(() => {
		const wid = this.winnerId();
		return wid ? this.providers().find(p => p.id === wid) || null : null;
	});

	fastestResponse = computed(() => {
		const list = this.providers().filter(p => p.responseHours != null);
		return list.length ? [...list].sort((a, b) => (a.responseHours || 0) - (b.responseHours || 0))[0] : null;
	});

	topRated = computed(() => {
		const list = this.providers();
		return list.length ? [...list].sort((a, b) => b.rating - a.rating)[0] : null;
	});

	mostExperienced = computed(() => {
		const list = this.providers();
		return list.length ? [...list].sort((a, b) => b.completedProjects - a.completedProjects)[0] : null;
	});

	/** Best price: lowest starting service price; falls back to hourly rate when no provider has priced services. */
	cheapest = computed(() => {
		const byService = this.providers().filter(p => p.minServicePrice != null);
		if (byService.length) return [...byService].sort((a, b) => (a.minServicePrice || 0) - (b.minServicePrice || 0))[0];
		const list = this.providers().filter(p => p.hourlyRate != null);
		return list.length ? [...list].sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0))[0] : null;
	});

	/** Design P-MK-024: winner feature ticks / stats use teal accents. */
	readonly winnerPstatStyle = 'border-color:rgba(43,212,199,.15)';

	emptySlots = computed(() => Math.max(0, this.maxCompare - this.providers().length));
	emptySlotsArray = computed(() => Array.from({ length: this.emptySlots() }));

	ngOnInit(): void {
		this.route.queryParams.subscribe(params => {
			const idsParam: string = params['ids'] || '';
			const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean).slice(0, MAX_COMPARE);
			this.loadProviders(ids);
		});
	}

	private loadProviders(ids: string[]) {
		if (!ids.length) {
			this.providers.set([]);
			this.loading.set(false);
			return;
		}
		this.loading.set(true);
		const requests = ids.map(id =>
			this.marketplaceService.getProviderPublicProfile(id).pipe(catchError(() => of(null)))
		);
		forkJoin(requests).subscribe(results => {
			const cards = results
				.map((res, idx) => mapToCard(ids[idx], res))
				.filter((c): c is CompareProviderCard => !!c);
			this.providers.set(cards);
			this.loading.set(false);
		});
	}

	removeProvider(id: string) {
		const remaining = this.providers().filter(p => p.id !== id).map(p => p.id);
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { ids: remaining.join(',') || null },
			queryParamsHandling: 'merge'
		});
	}

	goToMarketplaceToAdd() {
		this.router.navigate(['/marketplace']);
	}

	/** Level pill colours from design P-MK-024 / P-MK-017 (خبير / متقدم / محترف). */
	levelStyle(level: string): { background: string; color: string } {
		switch ((level || '').trim()) {
			case 'خبير': return { background: 'rgba(123,47,190,.85)', color: '#E0C6FF' };
			case 'محترف': return { background: 'rgba(15,169,154,.85)', color: '#fff' };
			default: return { background: 'rgba(43,127,255,.85)', color: '#fff' };
		}
	}

	starsText(rating: number): string {
		const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
		return '★'.repeat(n) + '☆'.repeat(5 - n);
	}

	ordinal(index: number): string {
		return ['أول', 'ثانٍ', 'ثالث', 'رابع'][index] || 'آخر';
	}
}
