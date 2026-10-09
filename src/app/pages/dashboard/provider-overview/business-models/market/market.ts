import { Component, signal, inject, OnDestroy, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NewProjectService } from '../../../../../core/services/new-project.service';
import { ThemeService } from '../../../../../core/services/theme.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

export interface ModelAiAudit {
	status: 'PENDING' | 'READY' | 'NOT_ENOUGH_DATA' | 'FAILED';
	source: string;
	score: number | null;
	summary: string | null;
	recommendation: string | null;
	details: { isApproved: boolean | null; strengths: string[]; issues: string[]; recommendations: string[] } | null;
	generatedAt: string | null;
}

export interface MarketModel {
	id: string;
	title: string;
	category: string;
	categorySlug?: string;
	createdAtFormatted: string;
	viewsCount: number;
	offersCount: number;
	rating: number;
	reviewsCount?: number;
	/** Stored audit score; null = never audited (a real 0 is a real 0). */
	aiScore: number | null;
	/** The stored WaseetAI audit as the backend returns it (GET my-market-models). */
	aiAudit?: ModelAiAudit | null;
	tags: string[];
	bgGradient?: string;
	iconColor?: string;
	icon?: string;
	coverImage?: string;
	status: string;
	/** false while the service is kept off the public market (KYC or specialty not approved). */
	marketVisible?: boolean;
	/** Arabic reason from the backend; shown as received, never composed here. */
	marketNotice?: string | null;
}

export interface MarketGroup {
	title: string;
	slug: string;
	count: number;
	views: number;
	models: MarketModel[];
}

export interface ModificationRequest {
	id: string;
	title: string;
	subtitle: string;
	date: string;
	matchRate: number | null;
	statusLabel: string;
	isExpanded: boolean;
	checks: { text: string; status: string; type: 'success' | 'warning' | 'error' }[];
	recommendation: string;
	isError?: boolean;
	canApprove: boolean;
}

@Component({
	selector: 'app-business-models-market',
	standalone: true,
	imports: [CommonModule, RouterLink, FormsModule],
	templateUrl: './market.html',
	styleUrl: './market.css'
})
export class Market implements OnInit, OnDestroy {
	private newProjectService = inject(NewProjectService);
	private router = inject(Router);
	public themeService = inject(ThemeService);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	models = signal<MarketModel[]>([]);
	groups = signal<MarketGroup[]>([]);
	filterTabs = signal<{ id: string; name: string; count: number }[]>([
		{ id: 'all', name: 'الكل', count: 0 }
	]);

	stats = signal({
		totalModels: 0,
		totalViews: 0,
		pendingModifications: 0
	});

	/** Average of the real stored audit scores; null when no model has been scored. */
	avgAiScore = computed<number | null>(() => {
		const scored = this.models().map(m => m.aiScore).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
		if (!scored.length) return null;
		return Math.round(scored.reduce((a, b) => a + b, 0) / scored.length);
	});

	activeCategory = signal<string>('all');
	activeSort = signal<string>('newest');
	activeSubTab = signal<'models' | 'requests'>('models');
	searchQuery = signal<string>('');
	isLoading = signal<boolean>(false);
	errorMessage = signal<string | null>(null);

	toastMessage = signal<string | null>(null);
	private toastTimer: any = null;
	private searchTimer: ReturnType<typeof setTimeout> | null = null;

	modificationRequests = signal<ModificationRequest[]>([
		// {
		//   id: 'REQ-5021',
		//   title: 'هوية بصرية متكاملة – مطعم راقي',
		//   subtitle: 'تعديل السعر والوصف · طلب REQ-5021',
		//   date: '30 مايو · 11:42 ص',
		//   matchRate: 94,
		//   statusLabel: 'قيد المراجعة',
		//   isExpanded: false,
		//   checks: [
		//     { text: '✓ توافق السعر مع تخصصك المعتمد', status: 'سليم', type: 'success' },
		//     { text: '✓ وضوح الوصف الجديد', status: 'سليم', type: 'success' },
		//     { text: '△ السعر أعلى من متوسط السوق بـ 8%', status: 'توصية', type: 'warning' }
		//   ],
		//   recommendation: 'التعديل جيد بنسبة 94% لكن السعر أعلى قليلاً من المعدل. يمكنك اعتماده أو مراجعة السعر.',
		//   canApprove: true
		// },
		// {
		//   id: 'REQ-5019',
		//   title: 'تصميم واجهة مستخدم – تطبيق صحة',
		//   subtitle: 'تعديل الوصف والكلمات المفتاحية · طلب REQ-5019',
		//   date: '28 مايو · 09:15 ص',
		//   matchRate: 87,
		//   statusLabel: 'قيد المراجعة',
		//   isExpanded: false,
		//   checks: [
		//     { text: '✓ توافق التخصص مع ملفك المهني', status: 'سليم', type: 'success' },
		//     { text: '△ الوصف الجديد أطول من المعتاد', status: 'توصية', type: 'warning' },
		//     { text: '✕ كلمات مفتاحية لا تتوافق مع تخصصك المعتمد', status: 'يحتاج تعديل', type: 'error' }
		//   ],
		//   recommendation: 'تم رصد كلمات مفتاحية لا تتوافق مع تخصصك المعتمد. يجب تعديلها قبل الاعتماد.',
		//   isError: true,
		//   canApprove: false
		// }
	]);

	ngOnInit() {
		this.fetchMarketModels();
	}

	fetchMarketModels() {
		this.isLoading.set(true);
		this.errorMessage.set(null);
		const params: any = {};
		if (this.activeCategory() && this.activeCategory() !== 'all' && this.activeCategory() !== 'undefined') {
			params.category = this.activeCategory();
		}
		if (this.activeSort() && this.activeSort() !== 'undefined') {
			params.sort = this.activeSort();
		}
		if (this.searchQuery() && this.searchQuery().trim() !== '') {
			params.search = this.searchQuery().trim();
		}
		params._t = Date.now(); // Cache-busting timestamp to guarantee fresh database responses

		this.newProjectService.getMyMarketModels(params).subscribe({
			next: (res: any) => {
				this.isLoading.set(false);
				if (res && res.success && res.data) {
					this.models.set(res.data.models || []);
					this.groups.set(res.data.groups || []);
					this.modificationRequests.set(res.data.modificationRequests || []);
					if (res.data.filterTabs) {
						this.filterTabs.set(res.data.filterTabs);
					}
					if (res.data.stats) {
						this.stats.set({
							...res.data.stats,
							pendingModifications: this.modificationRequests().length
						});
					}
				}
			},
			error: (err) => {
				this.isLoading.set(false);
				this.errorMessage.set('ERR-PR-026-MKT-02: خطأ في استدعاء بيانات السوق');
				console.error('Error fetching market models:', err);
			}
		});
	}

	setCategory(catId: string) {
		this.activeCategory.set(catId);
		this.fetchMarketModels();
	}

	setSort(sortId: string) {
		this.activeSort.set(sortId);
		this.fetchMarketModels();
	}

	setSubTab(tab: 'models' | 'requests') {
		this.activeSubTab.set(tab);
	}

	onSearchChange(val: string) {
		this.searchQuery.set(val);
		if (this.searchTimer) clearTimeout(this.searchTimer);
		this.searchTimer = setTimeout(() => this.fetchMarketModels(), 300);
	}

	onEdit(model: MarketModel) {
		this.router.navigate(['/provider-overview/business-models/new-project'], { queryParams: { edit: model.id } });
	}

	onToggleVisibility(model: MarketModel) {
		const isHidden = model.status === 'ARCHIVED';
		this.newProjectService.setServiceVisibility(model.id, isHidden).subscribe({
			next: (res) => {
				const newStatus = res?.data?.status || (isHidden ? 'PUBLISHED' : 'ARCHIVED');
				this.models.update(list => list.map(item => item.id === model.id ? { ...item, status: newStatus } : item));
				this.groups.update(list => list.map(group => ({
					...group,
					models: group.models.map(item => item.id === model.id ? { ...item, status: newStatus } : item)
				})));
				this.showToast(isHidden ? 'تم إظهار الخدمة في السوق' : 'تم إخفاء الخدمة عن السوق');
			},
			error: (err) => {
				console.error('Visibility update failed', err);
				this.showToast(err?.error?.error || 'تعذر تحديث ظهور الخدمة');
			}
		});
	}

	toggleReport(reqId: string) {
		this.modificationRequests.update(list =>
			list.map(r => r.id === reqId ? { ...r, isExpanded: !r.isExpanded } : r)
		);
	}

	// "Skip at my own risk" — matches design intent (P-PR-026-سوق): the button itself
	// is labelled "تخطى على مسؤوليتي" (skip at my own risk), so it must always be
	// available, including for requests with AI-flagged issues — that's the whole
	// point of an at-your-own-risk skip. No backend endpoint persists a "skipped"
	// state for a modification request yet, so this only surfaces the confirmation
	// the design specifies; it does not remove the request from the list.
	onSkipRequest(req: ModificationRequest) {
		this.showToast('تم التخطي على مسؤوليتك');
	}

	// No backend endpoint exists yet to approve a modification request (see
	// BACKEND_BLOCKED_ISSUES.md). The button is kept disabled in market.html with a
	// "غير متاح حاليًا" note instead of silently no-oping, so this handler is
	// effectively unreachable until that endpoint ships.
	onApproveRequest(req: ModificationRequest) {
		if (!req.canApprove) return;
	}

	onReturnEdit(req: ModificationRequest) {
		this.router.navigate(['/provider-overview/business-models/new-project'], { queryParams: { edit: req.id } });
	}

	showToast(msg: string) {
		this.toastMessage.set(msg);
		if (this.toastTimer) {
			clearTimeout(this.toastTimer);
		}
		this.toastTimer = setTimeout(() => {
			this.toastMessage.set(null);
		}, 2800);
	}

	ngOnDestroy(): void {
		if (this.toastTimer) clearTimeout(this.toastTimer);
		if (this.searchTimer) clearTimeout(this.searchTimer);
	}
}
