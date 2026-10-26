import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { MarketingCenterService } from '../../../../../core/services/marketing-center.service';
import { MarketingCenterData, MarketingKpi, MarketingToolSummary, MarketingTopTool } from '../../../../../core/models/marketing.model';
import {
  STATUS_LABELS, STATUS_PILL, avatarGradient, formatMoney, formatNumber, httpErrorMessage, initials, monthLabel, relativeTime,
} from '../marketing-utils';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, focusInvalidControls } from '../../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { currencyCode } from '../../../../../core/utils/currency';
import { WsCurrencyPipe } from '../../../../../shared/money/money.pipe';

/** P-PR-039 (individual) / P-CO-MK-005 (company) — مركز التسويق. */
@Component({
  selector: 'app-marketing-center',
  standalone: true,
  imports: [WsCurrencyPipe, CommonModule, FormsModule, RouterLink],
  templateUrl: './center.html',
  styleUrls: ['../marketing-shared.css', './center.css'],
})
export class MarketingCenter implements OnInit {
  private authStore = inject(AuthStore);
  private notify = inject(UiNotificationService);
  private centerApi = inject(MarketingCenterService);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();

  isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

  readonly statusLabels = STATUS_LABELS;
  readonly statusPill = STATUS_PILL;
  readonly fmt = formatNumber;
  readonly money = formatMoney;
  readonly rel = relativeTime;
  readonly initials = initials;
  readonly avatarBg = avatarGradient;

  data = signal<MarketingCenterData | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  editingCap = signal(false);
  capInput: number | null = null;
  savingCap = signal(false);
  /** Field message under the cap input (empty / not positive / too large, or a 400/422 from the server). */
  capError = signal<string | null>(null);
  /** Honest message for failures that belong to no field (network, 429, 5xx, 403...). */
  capGeneralError = signal<string | null>(null);

  trendBars = computed(() => {
    const trend = this.data()?.monthlyTrend ?? [];
    const max = Math.max(1, ...trend.map(t => t.usageCount));
    return trend.map((t, i) => ({
      label: monthLabel(t.month),
      value: t.usageCount,
      height: Math.max(3, Math.round((t.usageCount / max) * 100)),
      current: i === trend.length - 1,
    }));
  });

  leaderboard = computed(() => {
    const tools = (this.data()?.topTools ?? []).filter(t => t.usageCount > 0).slice(0, 5);
    const max = Math.max(1, ...tools.map(t => t.usageCount));
    return tools.map(t => ({ name: t.name, value: t.usageCount, width: Math.max(8, Math.round((t.usageCount / max) * 100)) }));
  });

  company = computed(() => this.data()?.company ?? null);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.centerApi.getCenter().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.data.set(res.data);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(httpErrorMessage(err, 'تعذر تحميل بيانات مركز التسويق'));
        this.loading.set(false);
      },
    });
  }

  deltaClass(k: MarketingKpi): string {
    if (k.changePercent === null || k.changePercent === 0) return '';
    return k.changePercent > 0 ? 'up' : 'down';
  }

  deltaText(k: MarketingKpi): string {
    if (k.changePercent === null) return 'لا توجد بيانات للمقارنة بالشهر الماضي';
    const arrow = k.changePercent > 0 ? '↑' : k.changePercent < 0 ? '↓' : '';
    return `${arrow} ${Math.abs(k.changePercent)}% عن الشهر الماضي`.trim();
  }

  summaryText(s: MarketingToolSummary | undefined, kind: 'coupon' | 'offer'): string {
    if (!s || s.total === 0) {
      return kind === 'coupon' ? 'لا توجد كوبونات بعد — أنشئ أول كوبون خصم لنماذجك.' : 'لا توجد عروض بعد — أنشئ باقة مرتبطة أو خصماً مباشراً.';
    }
    const parts = [`${s.active} نشطة`];
    if (s.paused) parts.push(`${s.paused} متوقف`);
    if (s.expired) parts.push(`${s.expired} منتهي`);
    if (s.pending) parts.push(`${s.pending} بانتظار الموافقة`);
    return parts.join(' · ');
  }

  toolUsage(t: MarketingTopTool): string {
    if (t.kind === 'COUPON' && t.maxUses) return `${t.usageCount} / ${t.maxUses}`;
    return `${t.usageCount} ${t.usageCount === 1 ? 'مرة' : 'مرات'}`;
  }

  toolLink(t: MarketingTopTool): string[] {
    return ['/provider-overview/marketing', t.kind === 'COUPON' ? 'coupons' : 'offers', t.id];
  }

  teamRowSub(r: { activeCoupons: number; activeOffers: number; totalTools: number }): string {
    if (!r.totalTools) return 'لا أدوات تسويق بعد';
    const parts: string[] = [];
    if (r.activeCoupons) parts.push(`${r.activeCoupons} ${r.activeCoupons === 1 ? 'كوبون' : 'كوبونات'}`);
    if (r.activeOffers) parts.push(`${r.activeOffers} ${r.activeOffers === 1 ? 'عرض' : 'عروض'}`);
    return parts.length ? `${parts.join(' · ')} نشط` : `${r.totalTools} أداة غير نشطة`;
  }

  // --- Spend cap (company) ---------------------------------------------
  startEditCap(): void {
    this.capInput = this.company()?.spendCap.cap ?? null;
    this.capError.set(null);
    this.capGeneralError.set(null);
    this.editingCap.set(true);
  }

  saveCap(remove = false): void {
    const cap = remove ? null : this.capInput;
    if (!remove && (cap === null || !(Number(cap) > 0) || Number(cap) > 100_000_000)) {
      const message = cap === null || (cap as unknown) === '' ? `أدخل السقف الشهري (${currencyCode()})` : Number(cap) > 100_000_000 ? 'السقف الشهري كبير جدًا' : 'أدخل سقفاً شهرياً صحيحاً أكبر من صفر';
      this.capError.set(message);
      this.notify.warning(message);
      void focusInvalidControls(this.host.nativeElement, [{ path: 'cap-input', message }]);
      return;
    }
    if (!this.guard.enter()) return;
    this.capError.set(null);
    this.capGeneralError.set(null);
    this.savingCap.set(true);
    this.centerApi.updateSpendCap(cap === null ? null : Number(cap)).subscribe({
      next: () => {
        this.savingCap.set(false);
        this.guard.release();
        this.editingCap.set(false);
        this.notify.success(remove ? 'تمت إزالة السقف الشهري' : 'تم تحديث السقف الشهري');
        this.load();
      },
      error: err => {
        this.savingCap.set(false);
        this.guard.release();
        const mapped = mapHttpError(err, { fallback: 'تعذر تحديث السقف الشهري' });
        if (mapped.kind === 'backend-validation' && !remove) {
          // The cap is the only field of this form: a 400/422 explains itself at the input.
          this.capError.set(mapped.message);
          void focusInvalidControls(this.host.nativeElement, [{ path: 'cap-input', message: mapped.message }]);
        } else {
          this.capGeneralError.set(mapped.message);
        }
        this.notify.error(mapped.message);
      },
    });
  }

  // --- Export (client-side CSV of what the center shows) --------------
  exportReport(): void {
    const d = this.data();
    if (!d) return;
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows: unknown[][] = [
      ['تقرير التسويق', d.period.month],
      [],
      ['المؤشر', 'القيمة', 'الشهر الماضي', 'التغير %'],
      ['أدوات تسويقية نشطة', d.kpis.activeTools.count, '', ''],
      ['مرات الاستخدام', d.kpis.monthlyUsage.value, d.kpis.monthlyUsage.previousMonth, d.kpis.monthlyUsage.changePercent ?? ''],
      [`القيمة المخصومة (${currencyCode()})`, d.kpis.discountedValue.value, d.kpis.discountedValue.previousMonth, d.kpis.discountedValue.changePercent ?? ''],
      [`إيراد إضافي (${currencyCode()})`, d.kpis.extraRevenue.value, d.kpis.extraRevenue.previousMonth, d.kpis.extraRevenue.changePercent ?? ''],
      [],
      ['الشهر', 'مرات الاستخدام', 'القيمة المخصومة', 'الإيراد'],
      ...d.monthlyTrend.map(t => [t.month, t.usageCount, t.discountedValue, t.revenue]),
      [],
      ['النوع', 'الاسم', 'الاستخدام', 'القيمة المخصومة', 'الحالة', 'آخر استخدام'],
      ...d.topTools.map(t => [t.kind === 'COUPON' ? 'كوبون' : 'عرض', t.name, t.usageCount, t.discountedValue, STATUS_LABELS[t.status], t.lastUsedAt ?? '']),
    ];
    const csv = '﻿' + rows.map(r => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-report-${d.period.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
