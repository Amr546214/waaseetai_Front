import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ReqStatus,
  RiskLevel,
  ServiceRequest,
  RequestOffer,
  TimelineStep,
  REQ_STATUS_LABELS,
  REQ_STATUS_CLASSES,
  SERVICE_REQUESTS,
} from '../sa-requests.data';

@Component({
  selector: 'app-sa-request-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-request-detail.html',
  styleUrls: ['../sa-requests.css', './sa-request-detail.css'],
})
export class SaRequestDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statusLabels: Record<ReqStatus, string> = REQ_STATUS_LABELS;

  readonly statusClasses: Record<ReqStatus, string> = REQ_STATUS_CLASSES;

  readonly riskLabels: Record<RiskLevel, string> = {
    low: 'منخفضة',
    medium: 'متوسطة',
    high: 'عالية',
  };

  readonly riskColors: Record<RiskLevel, string> = {
    low: '#0FA99A',
    medium: '#D98A0B',
    high: '#FF8C69',
  };

  selected = signal<ServiceRequest | null>(null);
  notFound = signal(false);
  actionMessage = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.actionMessage.set('');
      // Mock data only — no backend endpoint for service requests yet.
      const item = id ? SERVICE_REQUESTS.find((r) => String(r.id) === id) : undefined;
      this.selected.set(item ?? null);
      this.notFound.set(!item);
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/requests']);
  }

  timeline(item: ServiceRequest): TimelineStep[] {
    const steps: TimelineStep[] = [
      { label: 'نشر الطلب', note: 'نُشر الطلب بتاريخ ' + item.date, done: true },
      { label: 'فحص AI', note: item.aiClean ? 'نتيجة الفحص: نظيف لا مخالفات' : 'رُصد محتوى مخالف — الطلب موقوف للمراجعة', done: true },
      { label: 'استقبال العروض', note: item.offers + ' عرض تم استلامه', done: item.offers > 0 },
      { label: 'قبول عرض وبدء المشروع', note: item.status === 'in-progress' || item.status === 'completed' ? 'بدأ تنفيذ المشروع' : 'بانتظار قبول عرض', done: item.status === 'in-progress' || item.status === 'completed' },
      { label: 'إتمام الطلب', note: item.status === 'completed' ? 'اكتمل الطلب بنجاح' : 'لم يكتمل بعد', done: item.status === 'completed' },
    ];
    return steps;
  }

  private toNumber(s: string): number {
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  private fmtSar(n: number): string {
    return n.toLocaleString('en-US') + ' ر.س';
  }

  acceptedOffer(item: ServiceRequest): RequestOffer | undefined {
    return item.offersList.find((o) => o.accepted);
  }

  financials(item: ServiceRequest) {
    const accepted = this.acceptedOffer(item);
    const base = accepted ? accepted.priceValue : this.toNumber(item.budget);
    const feePercent = 10;
    const fee = Math.round(base * feePercent) / 100;
    const net = Math.round((base - fee) * 100) / 100;
    return {
      isEstimate: !accepted,
      base: this.fmtSar(base),
      escrow: this.fmtSar(base),
      feePercent,
      fee: this.fmtSar(fee),
      net: this.fmtSar(net),
      sourceLabel: accepted
        ? 'بناءً على العرض المقبول من ' + accepted.provider
        : 'تقدير أولي بناءً على الميزانية المعلنة — سيُعاد احتسابه عند قبول عرض',
    };
  }

  notifyOwner() {
    this.actionMessage.set('تم إرسال إشعار لصاحب الطلب');
  }

  suspend() {
    const item = this.selected();
    if (!item) return;
    this.actionMessage.set('تم تعليق الطلب مؤقتاً');
    this.selected.update((s) => (s ? { ...s, status: 'cancelled' } : s));
  }

  cancelRequest() {
    const item = this.selected();
    if (!item) return;
    this.actionMessage.set('تم إلغاء الطلب');
    this.selected.update((s) => (s ? { ...s, status: 'cancelled' } : s));
  }
}
