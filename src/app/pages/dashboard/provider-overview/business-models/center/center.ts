import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';

export interface AccreditationSampleItem {
	id: string;
	title: string;
	description: string;
	projectUrl?: string;
	githubUrl?: string;
	technologiesUsed: string[];
	attachments: string[];
	status: 'PENDING_AI_AUDIT' | 'AI_VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
	aiScore?: number;
	aiQualityRating?: string;
	aiFeedbackAr?: string;
	aiStrengths?: string[];
	aiRecommendations?: string[];
	aiAuditedAt?: string;
	createdAt: string;
	viewsCount?: number;
	rating?: number;
	reviewsCount?: number;
	offersGenerated?: number;
	offersAccepted?: number;
	providerSpecialtyId?: string;
	providerSpecialty?: {
		id?: string;
		specialtyId?: string;
		specialty?: {
			id?: string;
			nameAr?: string;
			nameEn?: string;
			name?: string;
			icon?: string;
		};
	};
	serviceCatalogs?: { id: string; status: string }[];
}

@Component({
	selector: 'app-business-models-center',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './center.html',
	styleUrl: './center.css'
})
export class Center implements OnInit {
	private providerApi = inject(ProviderApiService);

	isLoading = signal<boolean>(true);
	accreditationSamples = signal<AccreditationSampleItem[]>([]);
	selectedSampleForModal = signal<AccreditationSampleItem | null>(null);

	// Filters
	activeCategory = signal<string>('all');
	activeStatusFilter = signal<string>('all');
	activeSort = signal<string>('new');
	searchQuery = signal<string>('');
	activeScoreFilter = signal<string>('all');
	isFilterOpen = signal<boolean>(false);

	private searchTimeout: any;

	ngOnInit() {
		this.loadAccreditationSamples();
	}

	loadAccreditationSamples() {
		this.isLoading.set(true);
		this.providerApi.getAccreditationSamples().subscribe({
			next: (res) => {
				if (res && res.success && Array.isArray(res.samples)) {
					this.accreditationSamples.set(res.samples);
				} else {
					this.accreditationSamples.set([]);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load accreditation samples', err);
				this.accreditationSamples.set([]);
				this.isLoading.set(false);
			}
		});
	}

	// Dynamic specialties derived strictly from user's accreditation samples
	specialties = computed(() => {
		const samples = this.accreditationSamples();
		const map = new Map<string, { id: string; name: string; count: number }>();

		samples.forEach(s => {
			const spec = s.providerSpecialty?.specialty;
			const specId = spec?.id || s.providerSpecialtyId || 'general';
			const specName = spec?.nameAr || spec?.nameEn || spec?.name || 'تخصص عام';

			if (!map.has(specId)) {
				map.set(specId, { id: specId, name: specName, count: 0 });
			}
			map.get(specId)!.count++;
		});

		const list = Array.from(map.values());
		return [
			{ id: 'all', name: 'الكل', count: samples.length },
			...list
		];
	});

	// Dynamic stats summary cards
	stats = computed(() => {
		const samples = this.accreditationSamples();
		const verified = samples.filter(s => s.status === 'AI_VERIFIED').length;
		const totalViews = samples.reduce((acc, s) => acc + (s.viewsCount || 0), 0);
		const scores = samples.map(s => s.aiScore).filter((sc): sc is number => sc !== undefined && sc !== null);
		const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
		const totalOffers = samples.reduce((acc, s) => acc + (s.offersGenerated || 0), 0);
		const totalAccepted = samples.reduce((acc, s) => acc + (s.offersAccepted || 0), 0);

		return [
			{ value: verified, sub: 'في تخصصاتك' },
			{ value: totalViews, sub: 'إجمالي مشاهدات النماذج' },
			{ value: avgScore, sub: 'مستوى الجودة التقنية' },
			{ value: totalOffers, sub: `${totalAccepted} قُبلت` }
		];
	});

	// Filtered Accreditation Samples list based on category, status, search, and sort
	filteredAccreditationSamples = computed(() => {
		let list = [...this.accreditationSamples()];
		const category = this.activeCategory();
		const status = this.activeStatusFilter();
		const query = this.searchQuery().toLowerCase().trim();
		const sort = this.activeSort();

		// Filter by specialty category
		if (category !== 'all') {
			list = list.filter(s => {
				const specId = s.providerSpecialty?.specialty?.id || s.providerSpecialtyId;
				return specId === category;
			});
		}

		// Filter by status
		if (status !== 'all') {
			list = list.filter(s => s.status === status);
		}

		// Filter by search query
		if (query) {
			list = list.filter(s => {
				const titleMatch = s.title?.toLowerCase().includes(query);
				const descMatch = s.description?.toLowerCase().includes(query);
				const techMatch = s.technologiesUsed?.some(t => t.toLowerCase().includes(query));
				const specMatch = s.providerSpecialty?.specialty?.nameAr?.toLowerCase().includes(query);
				return titleMatch || descMatch || techMatch || specMatch;
			});
		}

		// Filter by AI Score
		const scoreFilter = this.activeScoreFilter();
		if (scoreFilter !== 'all') {
			list = list.filter(s => {
				const score = s.aiScore || 0;
				if (scoreFilter === 'high') return score >= 90;
				if (scoreFilter === 'medium') return score >= 80 && score < 90;
				if (scoreFilter === 'low') return score < 80;
				return true;
			});
		}

		// Sorting
		if (sort === 'score') {
			list.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0));
		} else if (sort === 'new') {
			list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		} else if (sort === 'status') {
			const order: Record<string, number> = { AI_VERIFIED: 1, PENDING_AI_AUDIT: 2, MANUAL_REVIEW: 3, REJECTED: 4 };
			list.sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5));
		}

		return list;
	});

	openAuditModal(sample: AccreditationSampleItem, event?: Event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		this.selectedSampleForModal.set(sample);
	}

	closeAuditModal() {
		this.selectedSampleForModal.set(null);
	}

	setCategory(catId: string) {
		this.activeCategory.set(catId);
	}

	setStatusFilter(status: string) {
		this.activeStatusFilter.set(status);
	}

	setSort(sort: string) {
		this.activeSort.set(sort);
	}

	setSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		if (this.searchTimeout) {
			clearTimeout(this.searchTimeout);
		}
		this.searchTimeout = setTimeout(() => {
			this.searchQuery.set(target.value);
		}, 300);
	}

	setScoreFilter(score: string) {
		this.activeScoreFilter.set(score);
	}

	openFilter() {
		this.isFilterOpen.set(true);
	}

	closeFilter() {
		this.isFilterOpen.set(false);
	}

	resetAllFilters() {
		this.activeCategory.set('all');
		this.activeStatusFilter.set('all');
		this.activeScoreFilter.set('all');
		this.searchQuery.set('');
		this.isFilterOpen.set(false);
	}

	getActiveFilterCount(): number {
		let count = 0;
		if (this.activeCategory() !== 'all') count++;
		if (this.activeStatusFilter() !== 'all') count++;
		if (this.activeScoreFilter() !== 'all') count++;
		if (this.searchQuery().trim() !== '') count++;
		return count;
	}

	isImageAttachment(att: string): boolean {
		if (!att) return false;
		if (att.startsWith('data:image/')) return true;
		const lower = att.toLowerCase();
		return lower.includes('.png') || lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.webp') || lower.includes('.svg');
	}

	getFileName(att: string, index: number = 0): string {
		if (!att) return `مرفق إثبات ${index + 1}`;
		if (att.startsWith('data:')) {
			const mimeMatch = att.match(/data:(.*?);/);
			const mime = mimeMatch ? mimeMatch[1] : 'image';
			const ext = mime.split('/')[1] || 'png';
			return `مرفق_إثبات_${index + 1}.${ext}`;
		}
		return att.split('/').pop() || `مرفق_إثبات_${index + 1}`;
	}

	getFirstImageAttachment(sample: AccreditationSampleItem): string | null {
		if (!sample?.attachments || sample.attachments.length === 0) return null;
		const firstImg = sample.attachments.find(att => this.isImageAttachment(att));
		return firstImg || null;
	}

	isPublishedInMarket(sample: AccreditationSampleItem): boolean {
		return sample.serviceCatalogs?.some(service => service.status === 'PUBLISHED' || service.status === 'APPROVED') || false;
	}
}
