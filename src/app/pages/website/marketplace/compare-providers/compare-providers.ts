import { Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
	skills: string[];
	location: string;
}

function mapToCard(id: string, raw: any): CompareProviderCard | null {
	const data = raw?.data || raw;
	if (!data) return null;
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
	private platformId = inject(PLATFORM_ID);
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

	topRated = computed(() => {
		const list = this.providers();
		return list.length ? [...list].sort((a, b) => b.rating - a.rating)[0] : null;
	});

	mostExperienced = computed(() => {
		const list = this.providers();
		return list.length ? [...list].sort((a, b) => b.completedProjects - a.completedProjects)[0] : null;
	});

	cheapest = computed(() => {
		const list = this.providers().filter(p => p.hourlyRate != null);
		return list.length ? [...list].sort((a, b) => (a.hourlyRate || 0) - (b.hourlyRate || 0))[0] : null;
	});

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
			if (isPlatformBrowser(this.platformId)) {
				setTimeout(() => this.initParticles(), 0);
			}
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
