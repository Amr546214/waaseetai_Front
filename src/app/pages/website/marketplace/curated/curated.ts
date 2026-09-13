import { Component, OnInit, PLATFORM_ID, inject, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MarketplaceModel, MarketplaceService } from '../../../../core/services/marketplace.service';

export type CuratedMode = 'top-rated' | 'most-ordered' | 'featured' | 'exclusive' | 'newest';

interface CuratedModeConfig {
	badgeIcon: string;
	badgeLabel: string;
	titlePrefix: string;
	titleHighlight: string;
	titleSuffix: string;
	subtitle: string;
	highlightGradient: string;
	statLabel: string;
	sort: (a: MarketplaceModel, b: MarketplaceModel) => number;
	filter?: (m: MarketplaceModel) => boolean;
	badgeColorVar: string;
}

const MODE_CONFIG: Record<CuratedMode, CuratedModeConfig> = {
	'top-rated': {
		badgeIcon: 'ws-star',
		badgeLabel: 'تصنيف المتميزين',
		titlePrefix: 'الأعلى',
		titleHighlight: 'تقييماً',
		titleSuffix: 'في وسيط',
		subtitle: 'خدمات اختارها العملاء وأثنوا عليها — مرتبة حسب التقييم الحقيقي والجودة الموثقة بذكاء وسيط.',
		highlightGradient: 'linear-gradient(135deg,#D98A0B,#FFB400)',
		statLabel: 'الأعلى تقييماً',
		sort: (a, b) => (b.rating || 0) - (a.rating || 0),
		badgeColorVar: 'var(--kahr)'
	},
	'most-ordered': {
		badgeIcon: 'ws-chart',
		badgeLabel: 'الأكثر طلباً',
		titlePrefix: 'الأكثر',
		titleHighlight: 'طلباً',
		titleSuffix: 'في وسيط',
		subtitle: 'الخدمات التي يثق بها العملاء أكثر من غيرها — مرتبة حسب عدد الطلبات الفعلية المكتملة.',
		highlightGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
		statLabel: 'طلبات مكتملة',
		sort: (a, b) => (b.salesCount || 0) - (a.salesCount || 0),
		badgeColorVar: 'var(--teal)'
	},
	'featured': {
		badgeIcon: 'ws-shield',
		badgeLabel: 'خدمات مميزة',
		titlePrefix: 'خدمات',
		titleHighlight: 'مميزة',
		titleSuffix: 'باحتراف مضمون',
		subtitle: 'خدمات اختارها فريق وسيط ودقّقتها لجودتها الاستثنائية ومقدميها الموثوقين.',
		highlightGradient: 'linear-gradient(135deg,#D98A0B,#FFB400,#2BD4C7)',
		statLabel: 'خدمة مميزة',
		sort: (a, b) => (b.aiScore || 0) - (a.aiScore || 0),
		filter: m => !!m.isFeatured,
		badgeColorVar: 'var(--teal)'
	},
	'exclusive': {
		badgeIcon: 'ws-tag',
		badgeLabel: 'عروض حصرية',
		titlePrefix: 'عروض',
		titleHighlight: 'حصرية',
		titleSuffix: 'لا تفوتها',
		subtitle: 'خصومات محدودة المدة على خدمات مختارة — اطلبها قبل انتهاء العرض.',
		highlightGradient: 'linear-gradient(135deg,#FF8C69,#FFB400)',
		statLabel: 'عرض نشط',
		sort: (a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0),
		filter: m => !!m.discountPercentage && m.discountPercentage > 0,
		badgeColorVar: 'var(--red)'
	},
	'newest': {
		badgeIcon: 'ws-plus',
		badgeLabel: 'الجديد في السوق',
		titlePrefix: 'الجديد في',
		titleHighlight: 'السوق',
		titleSuffix: '',
		subtitle: 'أحدث الخدمات التي انضمت إلى وسيط — كن أول من يجربها.',
		highlightGradient: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
		statLabel: 'خدمة جديدة',
		sort: (a, b) => {
			const dateA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
			const dateB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
			return dateB - dateA;
		},
		badgeColorVar: 'var(--teal)'
	}
};

@Component({
	selector: 'app-curated',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './curated.html',
	styleUrl: './curated.css'
})
export class CuratedComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private marketplaceService = inject(MarketplaceService);

	mode = signal<CuratedMode>('top-rated');
	config = computed(() => MODE_CONFIG[this.mode()]);
	models = signal<MarketplaceModel[]>([]);
	loading = signal<boolean>(true);
	categoryFilter = signal<string>('all');

	categories = computed(() => {
		const set = new Set<string>();
		this.models().forEach(m => { if (m.category) set.add(m.category); });
		return Array.from(set);
	});

	filteredModels = computed(() => {
		const list = this.models();
		const cat = this.categoryFilter();
		return cat === 'all' ? list : list.filter(m => m.category === cat);
	});

	averageRating = computed(() => {
		const list = this.models();
		if (!list.length) return '0.0';
		return (list.reduce((sum, m) => sum + (m.rating || 0), 0) / list.length).toFixed(1);
	});

	ngOnInit(): void {
		this.route.data.subscribe(data => {
			const mode = (data['mode'] as CuratedMode) || 'top-rated';
			this.mode.set(mode);
			this.categoryFilter.set('all');
			this.loadModels();
		});
	}

	private loadModels() {
		this.loading.set(true);
		this.marketplaceService.getPublishedModels({ limit: 60 }).subscribe({
			next: res => {
				const list: MarketplaceModel[] = res?.data?.models || res?.models || [];
				const cfg = this.config();
				const filtered = cfg.filter ? list.filter(cfg.filter) : list;
				this.models.set([...filtered].sort(cfg.sort));
				this.loading.set(false);
				if (isPlatformBrowser(this.platformId)) {
					setTimeout(() => this.initParticles(), 0);
				}
			},
			error: () => {
				this.models.set([]);
				this.loading.set(false);
			}
		});
	}

	setCategoryFilter(cat: string) {
		this.categoryFilter.set(cat);
	}

	rankBadgeClass(index: number): string {
		if (index === 0) return 'rank-gold';
		if (index === 1) return 'rank-silver';
		if (index === 2) return 'rank-bronze';
		return '';
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
