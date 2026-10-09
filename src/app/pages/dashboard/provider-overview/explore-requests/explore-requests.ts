import { Component, signal, computed, OnInit, effect, inject } from '@angular/core';
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
	// Backend says the project/profile lack enough data to compare — shown as an
	// honest empty state, with no numbers.
	aiInsufficient = signal(false);

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
		// Batch 5: backend 'MATCH' sort = real specialty-relevance tier, then
		// requirement overlap, then newest (explore-requests.service.ts).
		{ id: 'match', label: 'الأقرب لتخصصك' },
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

	// Batch: the "مستوى الخبرة المطلوبة" (required experience level) filter
	// section was removed. Neither the primary ClientRequest model nor the
	// data actually returned by GET /explore-requests carries any
	// experience-level field for a request (the legacy Project model has an
	// unrelated `provLevel` column used only by the AI matching engine, and
	// it isn't selected/returned by this endpoint), so there was nothing
	// real to filter by — a fake control was removed rather than left
	// non-functional. Budget, duration, client type and competition size
	// ARE all present on every request already loaded into `requests()`
	// (see fetchRequests below), so those are filtered for real,
	// client-side, when "تطبيق الفلاتر" is clicked.
	filterSections = signal([
		{
			id: 'budget',
			title: 'الميزانية',
			options: [
				{ id: 'b1', label: 'أقل من 2,000 $', checked: false },
				{ id: 'b2', label: '2,000 - 5,000 $', checked: false },
				{ id: 'b3', label: '5,000 - 15,000 $', checked: false },
				{ id: 'b4', label: 'أكثر من 15,000 $', checked: false }
			]
		},
		{
			id: 'duration',
			title: 'مدة التنفيذ',
			options: [
				{ id: 'd1', label: 'أقل من أسبوع', checked: false },
				{ id: 'd2', label: '1 - 2 أسبوع', checked: false },
				{ id: 'd3', label: '3 - 4 أسابيع', checked: false },
				{ id: 'd4', label: 'أكثر من شهر', checked: false }
			]
		},
		{
			id: 'clientType',
			title: 'نوع العميل',
			options: [
				{ id: 'c1', label: 'فرد', checked: false },
				{ id: 'c2', label: 'شركة', checked: false }
			]
		},
		{
			id: 'competition',
			title: 'حجم المنافسة',
			options: [
				{ id: 'comp1', label: 'أقل من 5 عروض', checked: false },
				{ id: 'comp2', label: '5 - 10 عروض', checked: false },
				{ id: 'comp3', label: 'أكثر من 10 عروض', checked: false }
			]
		}
	]);

	// Snapshot of the checked options at the moment "تطبيق الفلاتر" was last
	// clicked — filtering is only ever computed from this, never from the
	// live (in-progress) checkbox state in the drawer.
	appliedFilters = signal<{ budget: string[]; duration: string[]; clientType: string[]; competition: string[] }>({
		budget: [],
		duration: [],
		clientType: [],
		competition: []
	});

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

	/** Reads the currently-checked option ids out of a drawer section. */
	private checkedIds(sections: { id: string; options: { id: string; checked: boolean }[] }[], sectionId: string): string[] {
		return sections.find(s => s.id === sectionId)?.options.filter(o => o.checked).map(o => o.id) || [];
	}

	/** Snapshots the drawer's checked options as the active filter set and closes the drawer. */
	applyFilters() {
		const sections = this.filterSections();
		this.appliedFilters.set({
			budget: this.checkedIds(sections, 'budget'),
			duration: this.checkedIds(sections, 'duration'),
			clientType: this.checkedIds(sections, 'clientType'),
			competition: this.checkedIds(sections, 'competition')
		});
		this.closeFilter();
	}

	private matchesBudget(req: any, ids: string[]): boolean {
		if (ids.length === 0) return true;
		const value = req.budgetMax > 0 ? req.budgetMax : req.budgetMin;
		return ids.some(id => {
			switch (id) {
				case 'b1': return value < 2000;
				case 'b2': return value >= 2000 && value < 5000;
				case 'b3': return value >= 5000 && value < 15000;
				case 'b4': return value >= 15000;
				default: return false;
			}
		});
	}

	private matchesDuration(req: any, ids: string[]): boolean {
		if (ids.length === 0) return true;
		const days = req.durationDaysRaw || 0;
		return ids.some(id => {
			switch (id) {
				case 'd1': return days < 7;
				case 'd2': return days >= 7 && days < 14;
				case 'd3': return days >= 14 && days < 30;
				case 'd4': return days >= 30;
				default: return false;
			}
		});
	}

	private matchesClientType(req: any, ids: string[]): boolean {
		if (ids.length === 0) return true;
		return ids.some(id => {
			if (id === 'c1') return req.clientType === 'فرد';
			if (id === 'c2') return req.clientType === 'شركة';
			return false;
		});
	}

	private matchesCompetition(req: any, ids: string[]): boolean {
		if (ids.length === 0) return true;
		const count = req.offersCount || 0;
		return ids.some(id => {
			switch (id) {
				case 'comp1': return count < 5;
				case 'comp2': return count >= 5 && count <= 10;
				case 'comp3': return count > 10;
				default: return false;
			}
		});
	}

	/** The list actually rendered — `requests()` narrowed by the last-applied drawer filters. */
	visibleRequests = computed(() => {
		const list = this.requests();
		const f = this.appliedFilters();
		if (f.budget.length === 0 && f.duration.length === 0 && f.clientType.length === 0 && f.competition.length === 0) {
			return list;
		}
		return list.filter(r =>
			this.matchesBudget(r, f.budget) &&
			this.matchesDuration(r, f.duration) &&
			this.matchesClientType(r, f.clientType) &&
			this.matchesCompetition(r, f.competition)
		);
	});

	activeDrawerFilterCount = computed(() => {
		const f = this.appliedFilters();
		return f.budget.length + f.duration.length + f.clientType.length + f.competition.length;
	});

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
						clientBudget: p.budgetMin && p.budgetMax ? `${p.budgetMin} - ${p.budgetMax} $` : (p.budgetMin ? `${p.budgetMin} $` : 'غير محدد'),
						budgetMin: p.budgetMin || 0,
						budgetMax: p.budgetMax || 0,
						clientDuration: `${p.durationDays} يوم`,
						durationDaysRaw: p.durationDays || 0,
						offersCount: p.proposalsCount,
						timeAgo: p.createdAtFormatted,
						clientType: p.clientType,
						// AI Cleanup Batch 5: no per-card percentage. The old
						// backend value was fabricated (fixed base + hash of the
						// request id). Only the real, deterministic specialty
						// relevance tier is shown, as words, when there is one.
						relevanceLabel: ExploreRequests.relevanceLabel(p.specialtyRelevance),
						aiPriceRange: p.aiSuggestedBudget,
						aiPriceEval: p.aiPriceEval || 'عادل ومطابق لمتطلبات السوق',
						aiDurationRange: p.aiSuggestedDuration,
						aiDurationEval: p.aiDurationEval || 'واقعية ومناسبة',
						// The backend always sets aiNote (see explore-requests.service.ts),
						// so this is a defensive fallback only — kept honest (no "AI
						// determined this" claim) since this list's ranking is a
						// deterministic keyword/heuristic engine, not Gemini/OpenAI.
						aiNote: p.aiNote || '',
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

	/** Words for the backend's real specialty-relevance tier; null = show nothing. */
	static relevanceLabel(tier: unknown): string | null {
		if (tier === 'REQUIREMENTS') return 'متطلباته تتقاطع مع تخصصاتك';
		if (tier === 'SPECIALTY') return 'ضمن تخصصاتك المسجلة';
		return null;
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
		this.resetDrawerFilters();
		this.appliedFilters.set({ budget: [], duration: [], clientType: [], competition: [] });
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
		this.aiInsufficient.set(false);

		this.providerApi.analyzeProjectWithAi(req.id).subscribe({
			next: (res) => {
				this.aiLoading.set(false);
				const data = res && res.success ? res.data : null;
				if (!data) {
					this.aiUnavailable.set(true);
					return;
				}
				if (data.insufficientData === true) {
					this.aiInsufficient.set(true);
					return;
				}
				const a = data.analysis;
				const summary = typeof a?.summary === 'string' ? a.summary.trim() : '';
				const fitLabel = this.fitLabels[a?.overallFit as string];
				const texts = (list: any): string[] => Array.isArray(list)
					? list.map((i: any) => (typeof i?.text === 'string' ? i.text.trim() : '')).filter(Boolean)
					: [];
				if (!a || !summary || !fitLabel) {
					// Unexpected shape — treat as failure rather than render blanks.
					this.aiUnavailable.set(true);
					return;
				}
				this.aiAnalysisData.set({ fitLabel, fitKey: a.overallFit, summary, matchPoints: texts(a.matchPoints), gaps: texts(a.gaps) });
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
		this.aiInsufficient.set(false);
	}

	// overallFit is a qualitative level from the backend (HIGH/MEDIUM/LOW), not a percentage.
	private readonly fitLabels: Record<string, string> = { HIGH: 'ملاءمة عالية', MEDIUM: 'ملاءمة متوسطة', LOW: 'ملاءمة منخفضة' };
}
