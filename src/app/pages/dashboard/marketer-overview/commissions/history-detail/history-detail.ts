import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { WalletUnifyService } from '../../../../../core/services/wallet-unify.service';
import { WalletBreakdown, currencySymbol } from '../../../../../core/models/wallet-unify.model';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../../shared/wallet/wallet-breakdown.component';
import { commissionTypeLabel } from '../../../../../core/utils/marketer-labels.util';

interface MarketerHistoryRecord {
  id: string; kind?: string; type?: string; status?: string; amount: number; currency?: string; title?: string; createdAt: string; breakdown?: WalletBreakdown;
}

/** One commission or withdrawal of the marketer, by its history id (owner only: someone else's id answers 404). */
@Component({
  selector: 'app-marketer-history-detail',
  standalone: true,
  imports: [DecimalPipe, RouterLink, WalletBreakdownComponent],
  template: `
    <section dir="rtl" class="mhd" data-testid="marketer-history-detail">
      <a routerLink="/marketer-overview/commissions/history" class="mhd-back">← سجل العمولات والسحوبات</a>
      @if (loading()) { <div class="mhd-card">جاري تحميل بيانات العملية...</div> }
      @else if (error()) {
        <div class="mhd-card mhd-err" role="alert" data-testid="detail-error">{{ error() }}
          @if (!notFound()) { <button type="button" class="mhd-btn" (click)="load()">إعادة المحاولة</button> }
        </div>
      } @else if (rec(); as r) {
        <h1 class="mhd-title">{{ kindLabel() }}</h1>
        <div class="mhd-amount">{{ r.amount | number:'1.2-2' }} {{ cur(r.currency) }}</div>
        <div class="mhd-sub">{{ statusText(r.status) }} · {{ dateText(r.createdAt) }}</div>
        <div class="mhd-sec">تفصيل المبالغ والخصومات</div>
        <app-wallet-breakdown [rows]="rows()" />
      }
    </section>
  `,
  styles: [`
    :host{display:block;font-family:var(--font-family,'Tajawal'),system-ui,sans-serif;color:var(--txt)}
    .mhd{max-width:720px;margin:0 auto}
    .mhd-back{display:inline-flex;margin-bottom:12px;font-size:var(--font-size-label);font-weight:700;color:var(--txt-3);text-decoration:none}
    .mhd-card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:26px;text-align:center;color:var(--txt-2)}
    .mhd-err{color:var(--red)}
    .mhd-btn{font-family:inherit;margin-inline-start:10px;padding:6px 14px;border-radius:9px;border:none;cursor:pointer;font-weight:800;background:linear-gradient(135deg,#2BD4C7,#2B7FFF);color:#070D24}
    .mhd-title{margin:0;font-size:20px;font-weight:900}
    .mhd-amount{font-size:28px;font-weight:900;margin-top:8px;color:var(--green)}
    .mhd-sub{font-size:var(--font-size-small);color:var(--txt-3);margin:4px 0 16px}
    .mhd-sec{font-size:var(--font-size-body);font-weight:800;margin:6px 0 12px}
  `],
})
export class MarketerHistoryDetail implements OnInit {
  private api = inject(WalletUnifyService);
  private route = inject(ActivatedRoute);
  loading = signal(true);
  error = signal('');
  notFound = signal(false);
  rec = signal<MarketerHistoryRecord | null>(null);
  cur = currencySymbol;

  kindLabel = computed(() => {
    const r = this.rec();
    if (!r) return '';
    return r.kind === 'WITHDRAWAL' ? 'طلب سحب' : `عمولة · ${commissionTypeLabel(r.type ?? '')}`;
  });
  rows = computed<WalletBreakdownRow[]>(() => {
    const r = this.rec();
    return r ? [{ id: r.id, title: r.title || this.kindLabel(), breakdown: r.breakdown ?? null, storedAmount: r.amount, storedCurrency: r.currency }] : [];
  });

  ngOnInit() { this.load(); }

  load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set('رقم العملية غير صالح'); this.loading.set(false); return; }
    this.loading.set(true); this.error.set(''); this.notFound.set(false);
    this.api.detail('marketer', id).subscribe({
      next: res => { if (res?.success && res.data) this.rec.set(res.data); else this.error.set('تعذر تحميل بيانات العملية'); this.loading.set(false); },
      error: err => {
        if (err?.status === 404) { this.notFound.set(true); this.error.set('تعذر العثور على هذه العملية'); } else this.error.set('تعذر تحميل بيانات العملية');
        this.loading.set(false);
      },
    });
  }
  dateText(v: string): string { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v)); }
  statusText(s?: string): string {
    const m: Record<string, string> = { PENDING: 'معلق', APPROVED: 'مؤكد', PAID: 'مدفوع', CANCELLED: 'ملغي', REJECTED: 'مرفوض', PROCESSING: 'قيد التنفيذ', COMPLETED: 'مكتمل' };
    return s ? (m[s] ?? s) : '—';
  }
}
