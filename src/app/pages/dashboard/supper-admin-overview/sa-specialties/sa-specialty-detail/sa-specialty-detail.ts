import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaSpecialtiesService, AdminCategory, AdminSpecialty } from '../sa-specialties.service';

// --- Specialty Analytics (detail panel) -------------------------------------------------
// The live API (SaSpecialtiesService) only exposes providersCount / monthlyRequests per
// specialty today. The richer analytics shown in the detail panel below (12-month demand
// trend, supply/demand gap, top providers, performance metrics, sub-specialty chips, AI
// insights) have no backing endpoint yet. Following this codebase's own convention
// (see sa-team-performance.ts's fixed `current`/`previous`/`benchmarks` arrays), these
// sections use small fixed/illustrative sample content rather than fabricating
// per-specialty random statistics. Wherever a real field is available (providersCount,
// monthlyRequests, isActive, category, rank among siblings) it is used directly instead.
interface DemandPoint { label: string; value: number; }
interface TopProviderStat { name: string; rating: number; completedJobs: number; responseHours: number; }
interface PerformanceMetric { label: string; value: string; }
interface SpecialtyAnalytics {
	kpis: {
		activeProviders: number;
		monthlyRequests: number;
		requestsPerProvider: string;
		categoryRank: string;
	};
	demandTrend: DemandPoint[];
	demandTrendMax: number;
	gap: {
		ratio: number;
		status: 'shortage' | 'balanced' | 'surplus';
		statusLabel: string;
		statusColor: string;
	};
	topProviders: TopProviderStat[];
	performanceMetrics: PerformanceMetric[];
	subSpecialties: string[];
	aiInsights: string[];
}

// Fixed illustrative seasonal shape applied to the specialty's real monthlyRequests to draw
// a 12-month trend (last point anchored to the real current value). Same shape for every
// specialty — not fabricated per-id — matching sa-team-performance.ts's fixed chart arrays.
const DEMAND_SEASONAL_CURVE = [0.70, 0.74, 0.80, 0.84, 0.88, 0.92, 0.96, 1.02, 1.08, 1.04, 0.96, 1.00];

// Fixed illustrative sample content (identical across specialties) for sections with no
// backing API field at all, mirroring sa-team-performance.ts's static benchmarks table.
const SAMPLE_TOP_PROVIDERS: TopProviderStat[] = [
	{ name: 'مقدم خدمة معتمد #1', rating: 4.9, completedJobs: 128, responseHours: 2 },
	{ name: 'مقدم خدمة معتمد #2', rating: 4.8, completedJobs: 104, responseHours: 3 },
	{ name: 'مقدم خدمة معتمد #3', rating: 4.7, completedJobs: 91, responseHours: 4 },
	{ name: 'مقدم خدمة معتمد #4', rating: 4.6, completedJobs: 76, responseHours: 5 },
	{ name: 'مقدم خدمة معتمد #5', rating: 4.5, completedJobs: 62, responseHours: 6 },
];
const SAMPLE_PERFORMANCE_METRICS: PerformanceMetric[] = [
	{ label: 'معدل إتمام المشاريع', value: '89%' },
	{ label: 'متوسط وقت التسليم', value: '4.2 أيام' },
	{ label: 'معدل النزاعات', value: '1.8%' },
	{ label: 'رضا العملاء', value: '4.6 / 5' },
];
const SAMPLE_SUB_SPECIALTY_TIERS = ['مبتدئ', 'متوسط الخبرة', 'محترف', 'خبير معتمد'];

const MONTH_NAMES_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

@Component({
  selector: 'app-sa-specialty-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-specialty-detail.html',
  styleUrls: ['./sa-specialty-detail.css'],
})
export class SaSpecialtyDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(SaSpecialtiesService);

  private currentId: string | null = null;

  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  selectedSpec = signal<AdminSpecialty | null>(null);
  selectedSpecCategory = signal<AdminCategory | null>(null);
  specialtyAnalytics = signal<SpecialtyAnalytics | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.currentId = id;
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetchDetail(id);
    });
  }

  // There is no GET /admin/specialties/:id endpoint — load the same category/specialty
  // tree the list page uses (getTree) and locate the specialty (and its category) by id.
  // Works on page refresh / deep link since it doesn't depend on router state.
  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selectedSpec.set(null);
    this.selectedSpecCategory.set(null);
    this.specialtyAnalytics.set(null);

    this.service.getTree('').subscribe({
      next: (res) => {
        const cats = res.success ? res.data : [];
        let foundSpec: AdminSpecialty | null = null;
        let foundCat: AdminCategory | null = null;
        for (const cat of cats) {
          const spec = (cat.specialties || []).find((s) => String(s.id) === id);
          if (spec) {
            foundSpec = spec;
            foundCat = cat;
            break;
          }
        }
        if (foundSpec && foundCat) {
          this.selectedSpec.set(foundSpec);
          this.selectedSpecCategory.set(foundCat);
          // Real fields come straight from the loaded tree; everything else is fixed
          // illustrative sample content — see the comment above SpecialtyAnalytics.
          this.specialtyAnalytics.set(this.buildAnalytics(foundSpec, foundCat));
        } else {
          this.notFound.set(true);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error fetching specialties tree', err);
        this.error.set(err?.error?.message || 'تعذر تحميل بيانات التخصص');
        this.loading.set(false);
      },
    });
  }

  retry(): void {
    if (this.currentId) this.fetchDetail(this.currentId);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/specialties']);
  }

  private buildAnalytics(spec: AdminSpecialty, cat: AdminCategory): SpecialtyAnalytics {
    const providers = Math.max(spec.providersCount || 0, 0);
    const monthly = Math.max(spec.monthlyRequests || 0, 0);

    // Rank of this specialty within its own category by monthly requests — real, derived
    // from the already-loaded tree, no fabrication involved.
    const siblings = [...(cat.specialties || [])].sort((a, b) => (b.monthlyRequests || 0) - (a.monthlyRequests || 0));
    const rankIndex = siblings.findIndex(s => s.id === spec.id);
    const categoryRank = rankIndex >= 0 ? `${rankIndex + 1} من ${siblings.length}` : `— من ${siblings.length}`;

    const requestsPerProviderNum = providers > 0 ? monthly / providers : 0;
    const requestsPerProvider = providers > 0 ? requestsPerProviderNum.toFixed(1) : '—';

    // 12-month demand trend: fixed illustrative seasonal shape applied to the real current
    // monthlyRequests value (last point is anchored exactly to it).
    const now = new Date();
    const baseline = Math.max(monthly, 1);
    const demandTrend: DemandPoint[] = DEMAND_SEASONAL_CURVE.map((mult, i) => {
      const offset = DEMAND_SEASONAL_CURVE.length - 1 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      return { label: MONTH_NAMES_AR[d.getMonth()], value: Math.round(baseline * mult) };
    });
    if (demandTrend.length) demandTrend[demandTrend.length - 1].value = monthly;
    const demandTrendMax = Math.max(...demandTrend.map(p => p.value), 1);

    // Supply/demand gap: real ratio (monthly requests per provider) against fixed thresholds.
    let status: 'shortage' | 'balanced' | 'surplus';
    let statusLabel: string;
    let statusColor: string;
    if (providers === 0 && monthly > 0) {
      status = 'shortage'; statusLabel = 'لا يوجد مقدمو خدمة معتمدون رغم وجود طلب'; statusColor = '#FF8C69';
    } else if (requestsPerProviderNum > 5) {
      status = 'shortage'; statusLabel = 'الطلب يفوق طاقة مقدمي الخدمة الحاليين'; statusColor = '#FF8C69';
    } else if (requestsPerProviderNum < 1) {
      status = 'surplus'; statusLabel = 'عدد مقدمي الخدمة أعلى من الطلب الحالي'; statusColor = '#FFB400';
    } else {
      status = 'balanced'; statusLabel = 'توازن جيد بين العرض والطلب'; statusColor = '#0FA99A';
    }

    const aiInsights: string[] = [
      `يضم هذا التخصص حالياً ${providers} مقدم خدمة معتمد، بمعدل ${requestsPerProvider === '—' ? '0' : requestsPerProvider} طلب شهرياً لكل مقدم خدمة.`,
      providers === 0
        ? 'لا يوجد مقدمو خدمة معتمدون في هذا التخصص بعد — يُنصح بحملة استقطاب مستهدفة.'
        : statusLabel + '.',
      `يحتل هذا التخصص المرتبة ${categoryRank} من حيث الطلبات الشهرية ضمن قسم "${cat.nameAr}".`,
      spec.isActive ? 'حالة التخصص: مُفعَّل ومتاح لطلبات المستخدمين.' : 'حالة التخصص: معطَّل حالياً وغير ظاهر للمستخدمين.',
    ];

    return {
      kpis: { activeProviders: providers, monthlyRequests: monthly, requestsPerProvider, categoryRank },
      demandTrend,
      demandTrendMax,
      gap: { ratio: Math.round(requestsPerProviderNum * 10) / 10, status, statusLabel, statusColor },
      topProviders: SAMPLE_TOP_PROVIDERS.slice(0, Math.max(0, Math.min(5, providers))),
      performanceMetrics: SAMPLE_PERFORMANCE_METRICS,
      subSpecialties: SAMPLE_SUB_SPECIALTY_TIERS,
      aiInsights,
    };
  }
}
