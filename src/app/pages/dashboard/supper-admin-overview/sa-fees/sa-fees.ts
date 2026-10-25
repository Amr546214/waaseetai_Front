import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { LevelsService, LevelRow, DEPOSIT_METHOD_LABELS, WITHDRAWAL_METHOD_LABELS } from '../../../../core/levels/levels.service';
import { CommonModule } from '@angular/common';
import { AdminCommissionsData, AdminOpsApiService } from '../../../../core/services/admin-ops-api.service';
import { errMsg, usd } from '../sub-finance/finance-ui';
import { RouterLink } from '@angular/router';

interface PlatformFee {
  label: string;
  value: string;
  color: string;
  desc: string;
}

@Component({
  selector: 'app-sa-fees',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-fees.html',
  styleUrl: './sa-fees.css',
})
export class SaFees implements OnInit {
  private adminOps = inject(AdminOpsApiService);
  readonly usd = usd;
  commissions = signal<AdminCommissionsData | null>(null);
  commLoading = signal(true);
  commError = signal('');
  readonly affiliateRows = computed(() => {
    const a = this.commissions()?.affiliate ?? {};
    return [
      { key: 'PENDING', label: 'قيد المراجعة' },
      { key: 'APPROVED', label: 'معتمدة' },
      { key: 'PAID', label: 'مدفوعة' },
    ].map((r) => ({ ...r, count: a[r.key]?.count ?? 0, amount: a[r.key]?.amount ?? 0 }));
  });

  private readonly levels = inject(LevelsService);

  constructor() { this.levels.ensureLoaded(); }

  ngOnInit() { this.loadCommissions(); }

  loadCommissions() {
    this.commLoading.set(true);
    this.commError.set('');
    this.adminOps.financeCommissions({ limit: 1 }).subscribe({
      next: (res) => { this.commissions.set(res.data ?? null); this.commLoading.set(false); },
      error: (err) => { this.commError.set(errMsg(err, 'تعذر تحميل بيانات العمولات')); this.commLoading.set(false); },
    });
  }

  /**
   * The platform's percentages, read from the backend tables (نظام النقاط و الولاء.xlsx / نسب الدفع.xlsx through GET /levels). Nothing is typed:
   * until the table answers the list is empty. (The old rows - a 10% deal fee, a 200 $ minimum, 72 h escrow, a 49 $ boost, 2% cashback - were
   * invented values that no workbook contains and are gone.)
   */
  platformFees = computed<PlatformFee[]>(() => {
    const p = this.levels.payload();
    if (!p) return [];
    const range = (r: LevelRow[]) => `${Math.min(...r.map(l => l.percent))}% – ${Math.max(...r.map(l => l.percent))}%`;
    const list = (m: Record<string, number>, labels: Record<string, string>) => Object.entries(m).map(([k, v]) => `${labels[k] ?? k} ${v}%`).join(' · ');
    return [
      { label: 'عمولة المنصة على مقدم الخدمة (الخصم النهائي)', value: range(p.roles.PROVIDER.levels), color: '#2BD4C7', desc: 'تنخفض مع ارتفاع المستوى: المستوى 1 إلى المستوى 15' },
      { label: 'نسبة الكاش باك لطالب الخدمة', value: range(p.roles.CLIENT.levels), color: '#59C1F5', desc: 'تزيد مع ارتفاع المستوى — للعرض فقط: لا يُمنح كاش باك ماليًا حاليًا' },
      { label: 'عمولة الوسيط', value: range(p.roles.MARKETER.levels), color: '#0FA99A', desc: 'تزيد مع ارتفاع المستوى' },
      { label: 'رسوم إيداع طالب الخدمة', value: '', color: '#FFB400', desc: list(p.payments.clientDeposit, DEPOSIT_METHOD_LABELS) },
      { label: 'رسوم سحب الوسيط', value: '', color: '#5DA0FF', desc: list(p.payments.marketerWithdrawal, WITHDRAWAL_METHOD_LABELS) + ' — للعرض فقط: لا تُخصم من السحب حاليًا' },
    ];
  });
}
