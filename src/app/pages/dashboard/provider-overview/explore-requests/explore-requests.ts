import { Component, signal, OnInit, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { RouterLink } from '@angular/router';

@Component({
	selector: 'app-explore-requests',
	imports: [CommonModule, RouterLink],
	templateUrl: './explore-requests.html',
	styleUrl: './explore-requests.css',
})
export class ExploreRequests implements OnInit {
	private providerApi = inject(ProviderApiService);

	// Batch 7: PROVIDER_COMPANY accounts previously saw a fictional
	// "company mode" — a fabricated team-member roster with hardcoded AI
	// match percentages (companyTeamMembers), fabricated tab counts
	// (companyTabs: 47/34/9/4, unrelated to the real backend counts used
	// by `tabs` below), a static "47 طلب متاح / 91% متوسط تطابق الفريق"
	// stats bar hardcoded directly in the template, and an "إدارة الإسناد"
	// (manage assignment) button that just routed to the same apply page
	// as everyone else. None of it was backed by real data: there is no
	// team-member/company-employee model anywhere in the Prisma schema —
	// a provider account (individual or company) is a single user, so
	// per-employee assignment is not a thing the current backend can
	// represent. Building that for real would require a schema change
	// (a genuine future feature, not something to fake in the meantime),
	// so company accounts now see the exact same real, fully-connected
	// explore-requests experience as individual providers instead of a
	// fictional one.
	isFilterOpen = signal(false);

	// AI Intelligence Modal States
	isAiModalOpen = signal(false);
	aiLoading = signal(false);
	selectedProject = signal<any>(null);
	aiAnalysisData = signal<any>(null);
	// Honest failure state — set when the real AI analysis endpoint fails or
	// returns no data. Never paired with a fabricated aiAnalysisData value.
	aiUnavailable = signal(false);

	// Filter States
	activeSpecialty = signal('all');
	activeSort = signal('match');
	activeTab = signal('all');
	searchQuery = signal('');

	specialties = [
		{ id: 'all', label: 'كل التخصصات' },
		{ id: 'graphic', label: 'تصميم جرافيك' },
		{ id: 'uiux', label: 'UI/UX تصميم' },
		{ id: 'web', label: 'تصميم ويب' }
	];

	sortOptions = [
		{ id: 'match', label: 'الأعلى تطابقاً' },
		{ id: 'newest', label: 'الأحدث' },
		{ id: 'budget', label: 'الأعلى ميزانية' },
		{ id: 'closing', label: 'قرب الإغلاق' }
	];

	tabs = [
		{ id: 'all', label: 'الكل', count: 0 },
		{ id: 'not_applied', label: 'لم أتقدم بعد', count: 0 },
		{ id: 'applied', label: 'تقدمت', count: 0 },
		{ id: 'saved', label: 'محفوظة', count: 0 }
	];

	filterSections = signal([
		{
			id: 'budget',
			title: 'الميزانية',
			options: [
				{ id: 'b1', label: 'أقل من 2,000 ريال', checked: true },
				{ id: 'b2', label: '2,000 - 5,000 ريال', checked: true },
				{ id: 'b3', label: '5,000 - 15,000 ريال', checked: false },
				{ id: 'b4', label: 'أكثر من 15,000 ريال', checked: false }
			]
		},
		{
			id: 'duration',
			title: 'مدة التنفيذ',
			options: [
				{ id: 'd1', label: 'أقل من أسبوع', checked: false },
				{ id: 'd2', label: '1 - 2 أسبوع', checked: true },
				{ id: 'd3', label: '3 - 4 أسابيع', checked: true },
				{ id: 'd4', label: 'أكثر من شهر', checked: false }
			]
		},
		{
			id: 'clientType',
			title: 'نوع العميل',
			options: [
				{ id: 'c1', label: 'فرد', checked: true },
				{ id: 'c2', label: 'شركة', checked: true }
			]
		},
		{
			id: 'experience',
			title: 'مستوى الخبرة المطلوبة',
			options: [
				{ id: 'e1', label: 'مبتدئ', checked: false },
				{ id: 'e2', label: 'متوسط', checked: true },
				{ id: 'e3', label: 'خبير', checked: true }
			]
		},
		{
			id: 'competition',
			title: 'حجم المنافسة',
			options: [
				{ id: 'comp1', label: 'أقل من 5 عروض', checked: true },
				{ id: 'comp2', label: '5 - 10 عروض', checked: false },
				{ id: 'comp3', label: 'أكثر من 10 عروض', checked: false }
			]
		}
	]);

	openFilter() {
		this.isFilterOpen.set(true);
	}

	closeFilter() {
		this.isFilterOpen.set(false);
	}

	toggleFilterOption(sectionId: string, optionId: string) {
		this.filterSections.update(sections => {
			const sec = sections.find(s => s.id === sectionId);
			if (sec) {
				const opt = sec.options.find(o => o.id === optionId);
				if (opt) opt.checked = !opt.checked;
			}
			return [...sections];
		});
	}

	resetDrawerFilters() {
		this.filterSections.update(sections => {
			sections.forEach(sec => sec.options.forEach(opt => opt.checked = false));
			return [...sections];
		});
	}

	requests = signal<any[]>([]);

	constructor() {
		effect(() => {
			// Trigger fetch when any filter state changes
			this.fetchRequests(this.activeSpecialty(), this.activeTab(), this.activeSort(), this.searchQuery());
		});
	}

	ngOnInit() {
		this.fetchRequests('all', 'all', 'match', '');
	}

	fetchRequests(category: string, tab: string, sortBy: string, search: string) {
		let params: any = {};
		if (category && category !== 'all') params.category = category;
		if (tab && tab !== 'all') params.tab = tab.toUpperCase();
		if (sortBy) params.sortBy = sortBy.toUpperCase();
		if (search) params.search = search;

		this.providerApi.getExploreRequests(params).subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					const data = res.data;

					// Map backend response to component format if necessary
					const mappedRequests = data.projects.map((p: any) => ({
						id: p.id,
						title: p.title,
						ref: `#ORD-${p.id.substring(0, 8).toUpperCase()}`,
						desc: p.description,
						specialty: p.category,
						clientBudget: p.budgetMin && p.budgetMax ? `${p.budgetMin} - ${p.budgetMax} ريال` : (p.budgetMin ? `${p.budgetMin} ريال` : 'غير محدد'),
						clientDuration: `${p.durationDays} يوم`,
						offersCount: p.proposalsCount,
						timeAgo: p.createdAtFormatted,
						clientType: p.clientType,
						aiScore: p.aiMatchScore,
						aiPriceRange: p.aiSuggestedBudget,
						aiPriceEval: p.aiPriceEval || 'عادل ومطابق لمتطلبات السوق',
						aiDurationRange: p.aiSuggestedDuration,
						aiDurationEval: p.aiDurationEval || 'واقعية ومناسبة',
						// The backend always sets aiNote (see explore-requests.service.ts),
						// so this is a defensive fallback only — kept honest (no "AI
						// determined this" claim) since this list's ranking is a
						// deterministic keyword/heuristic engine, not Gemini/OpenAI.
						aiNote: p.aiNote || (p.aiMatchScore > 90 ? 'نظام المطابقة يوضح هذا الطلب كأفضل توافق مع تخصصك وأسلوبك' : (p.aiMatchScore > 80 ? 'منافسة منخفضة - فرصة جيدة للفوز بالعرض' : 'السعر أقل من التقدير - يمكنك طلب تفاوض للخدمة')),
						isSaved: p.isSaved,
						isApplied: p.hasApplied
					}));

					this.requests.set(mappedRequests);
					this.tabs = [
						{ id: 'all', label: 'الكل', count: data.counts.all },
						{ id: 'not_applied', label: 'لم أتقدم بعد', count: data.counts.notApplied },
						{ id: 'applied', label: 'تقدمت', count: data.counts.applied },
						{ id: 'saved', label: 'محفوظة', count: data.counts.saved }
					];

					// "كل التخصصات" always shows every OPEN request — browsing is never
					// gated by specialty verification status. The provider's own
					// specialties (any status) only appear as optional narrowing chips.
					if (data.providerSpecialties && data.providerSpecialties.length > 0) {
						const specs = data.providerSpecialties.map((s: string) => ({ id: s, label: s }));
						this.specialties = [{ id: 'all', label: 'كل التخصصات' }, ...specs];
					} else {
						this.specialties = [{ id: 'all', label: 'كل التخصصات' }];
					}
				}
			},
			error: (err) => console.error('Error fetching explore requests', err)
		});
	}

	setSpecialty(id: string) {
		this.activeSpecialty.set(id);
	}

	setSort(id: string) {
		this.activeSort.set(id);
	}

	setTab(id: string) {
		this.activeTab.set(id);
	}

	onSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		this.searchQuery.set(input.value);
	}

	resetFilters() {
		this.activeSpecialty.set('all');
		this.activeSort.set('match');
		this.activeTab.set('all');
		this.searchQuery.set('');
	}

	toggleSave(target: any, reqId: string) {
		// Optimistic UI Update
		let currentSavedState = false;
		this.requests.update(reqs => reqs.map(r => {
			if (r.id === reqId) {
				currentSavedState = r.isSaved;
				return { ...r, isSaved: !r.isSaved };
			}
			return r;
		}));

		// Update counts optimistically
		this.tabs = this.tabs.map(t => {
			if (t.id === 'saved') {
				return { ...t, count: t.count + (currentSavedState ? -1 : 1) };
			}
			return t;
		});

		// API Call
		this.providerApi.toggleSaveRequest(reqId).subscribe({
			next: (res) => {
				if (res && res.success) {
					const isSaved = res.data.isSaved;
					const savedCount = res.data.savedCount;

					// Re-sync with actual data
					this.requests.update(reqs => reqs.map(r => r.id === reqId ? { ...r, isSaved } : r));
					this.tabs = this.tabs.map(t => t.id === 'saved' ? { ...t, count: savedCount } : t);

					// If we are currently on the 'saved' tab, we might need to re-fetch or filter
					if (this.activeTab() === 'saved') {
						this.fetchRequests(this.activeSpecialty(), this.activeTab(), this.activeSort(), this.searchQuery());
					}
				}
			},
			error: (err) => {
				console.error('Error toggling save', err);
				// Revert optimistic update
				this.requests.update(reqs => reqs.map(r => r.id === reqId ? { ...r, isSaved: currentSavedState } : r));
				this.tabs = this.tabs.map(t => t.id === 'saved' ? { ...t, count: t.count + (currentSavedState ? 1 : -1) } : t);
			}
		});
	}

	openAiAnalysis(req: any) {
		this.selectedProject.set(req);
		this.isAiModalOpen.set(true);
		this.aiLoading.set(true);
		this.aiAnalysisData.set(null);
		this.aiUnavailable.set(false);

		this.providerApi.analyzeProjectWithAi(req.id).subscribe({
			next: (res) => {
				this.aiLoading.set(false);
				if (res && res.success && res.data) {
					this.aiAnalysisData.set(res.data);
				} else {
					// Honest failure — no invented match score, strategy, or
					// pricing. The real AI service was unavailable; say so.
					this.aiUnavailable.set(true);
				}
			},
			error: (err) => {
				console.warn('AI analysis unavailable', err);
				this.aiLoading.set(false);
				this.aiUnavailable.set(true);
			}
		});
	}

	closeAiModal() {
		this.isAiModalOpen.set(false);
		this.selectedProject.set(null);
		this.aiAnalysisData.set(null);
		this.aiUnavailable.set(false);
	}
}
