import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { finalize } from 'rxjs';
import { SaModificationRequestsService, AffiliateChangeRequest } from './sa-modification-requests.service';

type ReqStatus = 'ai' | 'human' | 'ok' | 'rejected';
type FilterKey = 'all' | ReqStatus;

interface TimelineStep {
  label: string;
  state: 'done' | 'active' | 'rejected' | 'pending';
}

interface ModificationRequest {
  id: string;
  requestNumber: string;
  field: string;
  requesterName: string;
  requesterType: string;
  sensitive: boolean;
  status: ReqStatus;
  oldValue: string;
  newValue: string;
  timeAgo: string;
  verdictLabel: string;
  verdictText: string;
  verdictScore: string;
  reviewer?: string;
  timeline: TimelineStep[];
}

@Component({
  selector: 'app-sa-modification-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-modification-requests.html',
  styleUrl: './sa-modification-requests.css',
})
export class SaModificationRequests implements OnInit {
  private service = inject(SaModificationRequestsService);

  activeFilter = signal<FilterKey>('all');
  toast = signal('');
  isLoading = signal(false);
  hasError = signal(false);
  processingId = signal<string | null>(null);

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'ai', label: 'قيد مراجعة الذكاء' },
    { key: 'human', label: 'بانتظار اعتماد' },
    { key: 'ok', label: 'معتمد' },
    { key: 'rejected', label: 'مرفوض' },
  ];

  // Only AffiliateProfile's ProfileChangeRequest is wired here — this page
  // never reads/writes ProviderProfile's separate ProfileModificationRequest
  // model, which has its own, already-working admin review flow under
  // provider-profile routes.
  requests = signal<ModificationRequest[]>([]);

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.service.list().pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.requests.set(
            res.data
              .filter(r => r.status !== 'WITHDRAWN')
              .map(r => this.mapRequest(r))
          );
        } else {
          this.hasError.set(true);
        }
      },
      error: () => this.hasError.set(true)
    });
  }

  filteredRequests = computed(() => {
    const f = this.activeFilter();
    const list = this.requests();
    return f === 'all' ? list : list.filter((r) => r.status === f);
  });

  counts = computed(() => {
    const list = this.requests();
    return {
      all: list.length,
      ai: list.filter((r) => r.status === 'ai').length,
      human: list.filter((r) => r.status === 'human').length,
      ok: list.filter((r) => r.status === 'ok').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  approve(req: ModificationRequest) {
    if (this.processingId()) return;

    this.processingId.set(req.id);
    this.service.approve(req.id).pipe(
      finalize(() => this.processingId.set(null))
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast(`تم اعتماد الطلب ${req.requestNumber} وتطبيق التعديل`);
          this.loadRequests();
        } else {
          this.showToast(res.message || 'تعذر اعتماد الطلب');
        }
      },
      error: (err) => this.showToast(err?.error?.message || 'تعذر اعتماد الطلب، حاول مرة أخرى')
    });
  }

  reject(req: ModificationRequest) {
    if (this.processingId()) return;

    const reason = window.prompt('سبب رفض الطلب:');
    if (!reason || !reason.trim()) return;

    this.processingId.set(req.id);
    this.service.reject(req.id, reason.trim()).pipe(
      finalize(() => this.processingId.set(null))
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast(`تم رفض الطلب ${req.requestNumber}`);
          this.loadRequests();
        } else {
          this.showToast(res.message || 'تعذر رفض الطلب');
        }
      },
      error: (err) => this.showToast(err?.error?.message || 'تعذر رفض الطلب، حاول مرة أخرى')
    });
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }

  private mapStatus(status: AffiliateChangeRequest['status']): ReqStatus {
    switch (status) {
      case 'PENDING_AI_REVIEW': return 'ai';
      case 'PENDING_HUMAN_APPROVAL': return 'human';
      case 'APPROVED_AND_APPLIED': return 'ok';
      default: return 'rejected';
    }
  }

  private buildTimeline(status: ReqStatus): TimelineStep[] {
    if (status === 'rejected') {
      return [
        { label: 'مراجعة الذكاء', state: 'done' },
        { label: 'رفض الاعتماد', state: 'rejected' },
      ];
    }
    return [
      { label: 'مراجعة الذكاء', state: status === 'ai' ? 'active' : 'done' },
      { label: 'اعتماد بشري', state: status === 'ok' ? 'done' : (status === 'human' ? 'active' : 'pending') },
      { label: 'تطبيق', state: status === 'ok' ? 'done' : 'pending' },
    ];
  }

  private mapRequest(r: AffiliateChangeRequest): ModificationRequest {
    const status = this.mapStatus(r.status);
    const requesterName = `${r.affiliateProfile?.user?.firstName || ''} ${r.affiliateProfile?.user?.lastName || ''}`.trim() || 'وسيط تسويقي';

    return {
      id: r.id,
      requestNumber: r.requestNumber,
      field: r.fieldLabel,
      requesterName,
      requesterType: 'وسيط تسويقي',
      sensitive: true,
      status,
      oldValue: r.currentValue || 'لا يوجد',
      newValue: r.requestedValue,
      timeAgo: new Date(r.createdAt).toLocaleString('ar-SA'),
      verdictLabel: status === 'ai' ? 'فحص الذكاء جار'
        : status === 'human' ? 'توصية الذكاء، تمرير للمراجعة'
        : status === 'ok' ? 'اعتمده المراجع'
        : 'مرفوض',
      verdictText: r.rejectionReason || r.aiRecommendation || 'يتحقق الذكاء من البيانات...',
      verdictScore: r.aiConfidenceScore ? `دقة ${r.aiConfidenceScore}%` : (status === 'rejected' ? 'تعارض' : 'دقة 95%'),
      reviewer: r.reviewedBy || undefined,
      timeline: this.buildTimeline(status),
    };
  }
}
