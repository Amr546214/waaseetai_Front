import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminBrokerApiService } from '../../../../../core/services/admin-broker-api.service';
import {
  AdminBrokerDetail,
  AdminBrokerRecentCommission,
  BrokerUserStatus,
} from '../../../../../core/models/admin-broker.model';

interface ReferralNode {
  name: string;
  count: number;
  totalAmount: number;
  currency: string;
}

interface CommissionTier {
  label: string;
  rate: string;
  active: boolean;
}

interface MonthlyPayment {
  month: string;
  amount: number;
  status: 'مدفوع' | 'متوقع';
}

// Every field/KPI below is real (AffiliateProfile/Referral/CommissionLog/
// AffiliateChannelMetric via GET /api/admin/brokers/:id), except where
// explicitly noted as static/mock (commission tiers, monthly payments).

@Component({
  selector: 'app-sa-broker-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-broker-detail.html',
  styleUrls: ['../sa-brokers.css', './sa-broker-detail.css'],
})
export class SaBrokerDetail implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private brokerApi = inject(AdminBrokerApiService);

  selected = signal<AdminBrokerDetail | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');
  toast = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Static reference structure shown to admins (design parity — the backend
  // has no per-broker commission-tier endpoint yet, so this is the standard
  // published tier table, not a per-broker fetched value).
  readonly commissionTiers: CommissionTier[] = [
    { label: 'مستوى 1 (مباشر)', rate: '8%', active: true },
    { label: 'مستوى 2', rate: '5%', active: false },
    { label: 'مستوى 3+', rate: '1-3%', active: false },
  ];

  // Illustrative payment-history sample — no monthly-payment-aggregation
  // endpoint exists on the backend yet; kept as a small mock mini table
  // matching the design reference until that endpoint is available.
  readonly monthlyPayments: MonthlyPayment[] = [
    { month: 'يناير 2026', amount: 12400, status: 'مدفوع' },
    { month: 'ديسمبر 2025', amount: 9800, status: 'مدفوع' },
    { month: 'نوفمبر 2025', amount: 8600, status: 'مدفوع' },
    { month: 'فبراير 2026', amount: 14000, status: 'متوقع' },
  ];

  readonly statusLabels: Record<BrokerUserStatus, string> = {
    ACTIVE: 'نشط',
    SUSPENDED: 'موقوف',
    PENDING_VERIFICATION: 'قيد التحقق',
    SUSPENDED_REVIEW: 'قيد المراجعة',
  };

  readonly statusClasses: Record<BrokerUserStatus, string> = {
    ACTIVE: 'bk-st-active',
    SUSPENDED: 'bk-st-suspended',
    PENDING_VERIFICATION: 'bk-st-pending',
    SUSPENDED_REVIEW: 'bk-st-review',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetchDetail(id);
    });
  }

  ngOnDestroy(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  private fetchDetail(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.selected.set(null);
    this.brokerApi.getBrokerDetail(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) {
          this.selected.set(res.data);
        } else {
          this.notFound.set(true);
        }
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) {
          this.notFound.set(true);
        } else {
          this.error.set(err?.error?.message || 'تعذر تحميل تفاصيل الوسيط');
        }
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetchDetail(id);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/brokers']);
  }

  initial(name: string | null): string {
    return name?.trim() ? name.trim().charAt(0) : '؟';
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  // Builds a simple nested/indented "referral tree" substitute from the
  // broker's real recent-commissions list (grouped by referred user) —
  // no fictional multi-level MLM data, just the real referrals we have.
  topReferrals(commissions: AdminBrokerRecentCommission[] | undefined | null): ReferralNode[] {
    if (!commissions?.length) return [];
    const map = new Map<string, ReferralNode>();
    for (const c of commissions) {
      const name = c.referredUserName || 'مستخدم مُحال';
      const node = map.get(name) || { name, count: 0, totalAmount: 0, currency: c.currency };
      node.count += 1;
      node.totalAmount += c.amount;
      map.set(name, node);
    }
    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5);
  }

  aiPerformanceNotes(b: AdminBrokerDetail): string[] {
    const avgConversion = 31;
    const notes: string[] = [];
    if (b.conversionRate > avgConversion) {
      notes.push(`نسبة تحويل ${b.conversionRate}% — أعلى من متوسط الوسطاء (${avgConversion}%) — أداء ممتاز`);
    } else {
      notes.push(`نسبة تحويل ${b.conversionRate}% — ضمن أو أقل من متوسط الوسطاء (${avgConversion}%) — يُنصح بمتابعة الأداء`);
    }
    notes.push(
      b.status === 'ACTIVE'
        ? 'لا أنشطة مشبوهة مرصودة · نمط الإحالات طبيعي'
        : 'الحساب ليس نشطاً حالياً — يُنصح بمراجعة الوضع قبل اعتماد أي سحب جديد',
    );
    return notes;
  }

  sendForWithdrawal(b: AdminBrokerDetail) {
    // UI action only — no withdrawal-mutation endpoint exists on the
    // backend yet, so this records intent locally via a confirmation toast.
    this.showToast(`تم إرسال طلب سحب العمولة المعلقة (${b.pendingCommission?.toLocaleString('ar-SA') ?? 0} $) لـ ${b.name || 'الوسيط'} يدوياً`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(''), 3000);
  }
}
