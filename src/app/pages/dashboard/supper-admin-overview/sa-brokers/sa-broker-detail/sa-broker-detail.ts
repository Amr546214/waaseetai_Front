import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../../shared/admin-form-report';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
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

// Every field/KPI below is real (AffiliateProfile/Referral/CommissionLog/
// AffiliateChannelMetric via GET /api/admin/brokers/:id). The old static
// commission-tier table, the invented monthly payments sample, the
// "average conversion 31%" comparison and the fake "send for withdrawal"
// toast were replaced: the level / rate come from the broker's real level,
// the monthly table is summed from his real CommissionLog rows, and the
// withdrawal button is disabled with its reason (affiliate payouts go
// through the broker's own withdrawal request, reviewed under /withdrawals).

@Component({
  selector: 'app-sa-broker-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-broker-detail.html',
  styleUrls: ['../sa-brokers.css', './sa-broker-detail.css'],
})
export class SaBrokerDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private brokerApi = inject(AdminBrokerApiService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private statusGuard = new SubmitGuard();
  statusError = signal('');

  selected = signal<AdminBrokerDetail | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  // Suspend / reactivate dialog (confirmation + required reason when suspending).
  statusDialog = signal<'SUSPENDED' | 'ACTIVE' | null>(null);
  statusReason = signal('');
  statusBusy = signal(false);

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

  // Plain facts from the broker's own record — no peer average, no scoring.
  performanceFacts(b: AdminBrokerDetail): string[] {
    return [
      `نسبة التحويل ${b.conversionRate}% (${b.convertedReferrals} محوّلة من ${b.totalReferrals} إحالة)`,
      `المستوى الحالي: ${b.level}${b.commissionPercent != null ? ` — نسبة العمولة ${b.commissionPercent}%` : ''}`,
    ];
  }

  monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('ar-SA', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(y, m - 1, 1)));
  }

  openStatusDialog(target: 'SUSPENDED' | 'ACTIVE') {
    this.statusReason.set('');
    this.statusError.set('');
    this.statusDialog.set(target);
  }

  closeStatusDialog() {
    if (!this.statusBusy()) this.statusDialog.set(null);
  }

  confirmStatusChange() {
    const b = this.selected();
    const target = this.statusDialog();
    if (!b || !target) return;
    const reason = this.statusReason().trim();
    this.statusError.set('');
    if (target === 'SUSPENDED' && reason.length < 5) {
      void reportAdminProblems(this.host.nativeElement, [{ field: 'bk-status-reason', message: reason ? 'سبب الإيقاف قصير جدًا (5 أحرف على الأقل)' : 'اكتب سبب الإيقاف (5 أحرف على الأقل)' }]);
      return;
    }
    if (!this.statusGuard.enter()) return;
    this.statusBusy.set(true);
    this.brokerApi.setBrokerStatus(b.id, target, reason || undefined).subscribe({
      next: () => {
        this.statusGuard.release();
        this.statusBusy.set(false);
        this.statusDialog.set(null);
        this.selected.set({ ...b, status: target });
        this.notify.success(target === 'SUSPENDED' ? 'تم إيقاف حساب الوسيط' : 'تمت إعادة تفعيل حساب الوسيط');
      },
      error: (err) => {
        this.statusGuard.release();
        this.statusBusy.set(false);
        handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر تحديث حالة الوسيط', resolve: { reason: 'bk-status-reason' } }, (m) => this.statusError.set(m));
      },
    });
  }
}
