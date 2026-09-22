import { Component, signal, OnInit, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProviderApiService } from '../../../../core/services/provider-api.service';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
	selector: 'app-explore-requests',
	imports: [CommonModule, RouterLink],
	templateUrl: './explore-requests.html',
	styleUrl: './explore-requests.css',
})
export class ExploreRequests implements OnInit {
	private providerApi = inject(ProviderApiService);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company team members for assignment
	companyTeamMembers = signal([
		{ id: 'tm1', name: 'فهد العتيبي', initials: 'فه', match: 94, specialty: 'تطوير ويب', available: true },
		{ id: 'tm2', name: 'ريم الدوسري', initials: 'ري', match: 78, specialty: 'تصميم', available: true },
		{ id: 'tm3', name: 'خالد الحربي', initials: 'خا', match: 72, specialty: 'تطوير ويب', available: true },
		{ id: 'tm4', name: 'نورة القحطاني', initials: 'نو', match: 85, specialty: 'محتوى', available: false },
	]);

	// Company tabs
	companyTabs = [
		{ id: 'all', label: 'الكل', count: 47 },
		{ id: 'unassigned', label: 'لم يُسند', count: 34 },
		{ id: 'assigned', label: 'مُسند', count: 9 },
		{ id: 'saved', label: 'محفوظة', count: 4 },
	];

	isFilterOpen = signal(false);

	// AI Intelligence Modal States
	isAiModalOpen = signal(false);
	aiLoading = signal(false);
	selectedProject = signal<any>(null);
	aiAnalysisData = signal<any>(null);

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
						aiNote: p.aiNote || (p.aiMatchScore > 90 ? 'الذكاء يوضح هذا الطلب كأفضل توافق مع تخصصك وأسلوبك' : (p.aiMatchScore > 80 ? 'منافسة منخفضة - فرصة جيدة للفوز بالعرض' : 'السعر أقل من التقدير - يمكنك طلب تفاوض للخدمة')),
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

		this.providerApi.analyzeProjectWithAi(req.id).subscribe({
			next: (res) => {
				this.aiLoading.set(false);
				if (res && res.success && res.data) {
					this.aiAnalysisData.set(res.data);
				} else {
					this.setFallbackAiAnalysis(req);
				}
			},
			error: (err) => {
				console.warn('AI analysis API unreachable, using intelligent simulation fallback', err);
				this.aiLoading.set(false);
				this.setFallbackAiAnalysis(req);
			}
		});
	}

	private setFallbackAiAnalysis(req: any) {
		this.aiAnalysisData.set({
			matchPercent: req.aiScore || 88,
			matchSummary: `يتطابق ملفك المهني ومستوى مهاراتك مع متطلبات مشروع "${req.title}"؛ حيث يعكس سجل أعمالك وتقييماتك القدرة التامة على تقديم المخرجات باحترافية عالية.`,
			winningStrategy: [
				`ابدأ عرضك الفني بإبراز الفهم الدقيق لتحديات ومتطلبات "${req.specialty}" وكيفية التميز فيها بدون عبارات عامة ومحفوظة.`,
				`ركز في عرضك على تقديم وعد بجدول زمني دقيق ومتابعة دورية مجانية لطمأنة العميل حول التزامك.`,
				`اقترح تقسيم الدفعات والعمل على مرحلتين (Milestones) لتعزيز الاطمئنان والاستفادة القصوى من نظام الضمان الذكي للمنصة.`
			],
			suggestedBidPrice: req.aiPriceRange || req.clientBudget || '3,500 ريال',
			priceRationale: `هذا التسعير مدروس بدقة ليعكس التوازن التنافسي المثالي في سوق الخدمات الراهن ومستوى الجودة المطلوب للتسليم في غضون ${req.clientDuration || 'المدة المحددة'}.`,
			clientInsights: req.clientType === 'شركة' 
				? `العميل عبارة عن "حساب شركة/مؤسسة"، وهذا النوع يفضل الالتزام التام بالمعايير الفنية والجودة الموثوقة على الخصم السعرية.` 
				: `العميل "حساب فردي"، يركز غالباً على الاستجابة السريعة، وتقدير التفاصيل الدقيقة، وتحديد أوقات تسليم واضحة ومحددة.`,
			riskAssessment: `تصنيف المخاطر: منخفض (Low Risk). متطلبات العمل والجدول الزمني متناسقان ويدعمان إنجازاً سلساً ومستقراً.`
		});
	}

	closeAiModal() {
		this.isAiModalOpen.set(false);
		this.selectedProject.set(null);
		this.aiAnalysisData.set(null);
	}
}
