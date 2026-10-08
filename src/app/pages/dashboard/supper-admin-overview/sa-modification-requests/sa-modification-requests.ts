import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';
import { SaModificationRequestsService, AffiliateChangeRequest, ProfileModificationRequestRow } from './sa-modification-requests.service';

type ReqStatus = 'ai' | 'human' | 'ok' | 'rejected';
type FilterKey = 'all' | ReqStatus;

interface TimelineStep {
  label: string;
  state: 'done' | 'active' | 'rejected' | 'pending';
}

interface ModificationRequest {
  id: string;
  /** which backend model it belongs to: marketer requests (affiliate) or provider/client requests (profile) */
  source: 'affiliate' | 'profile';
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
  createdMs: number;
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
    { key: 'ai', label: 'قيد المراجعة' },
    { key: 'human', label: 'بانتظار اعتماد' },
    { key: 'ok', label: 'معتمد' },
    { key: 'rejected', label: 'مرفوض' },
  ];

  // Two backend models feed this queue: marketers' ProfileChangeRequest and providers'/clients' ProfileModificationRequest. Both are loaded
  // with their history (APPROVED / REJECTED too), so a decided request stays visible with its final status instead of vanishing.
  requests = signal<ModificationRequest[]>([]);
  /** Which sources failed to load (the other one is still shown). */
  failedSources = signal<string[]>([]);

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.failedSources.set([]);
    const failed: string[] = [];
    forkJoin({
      affiliate: this.service.list('ALL').pipe(catchError(() => { failed.push('الوسطاء'); return of(null); })),
      profile: this.service.listProfileRequests('ALL').pipe(catchError(() => { failed.push('مقدمو الخدمة وطالبو الخدمة'); return of(null); })),
    }).pipe(
      finalize(() => this.isLoading.set(false))
    ).subscribe(({ affiliate, profile }) => {
      const okAffiliate = !!(affiliate && affiliate.success && affiliate.data);
      const okProfile = !!(profile && profile.success && profile.data);
      if (affiliate && !okAffiliate && !failed.includes('الوسطاء')) failed.push('الوسطاء');
      if (profile && !okProfile && !failed.includes('مقدمو الخدمة وطالبو الخدمة')) failed.push('مقدمو الخدمة وطالبو الخدمة');
      this.failedSources.set([...failed]);
      if (!okAffiliate && !okProfile) {
        this.requests.set([]);
        this.hasError.set(true);
        return;
      }
      const merged = [
        ...(okAffiliate ? affiliate!.data!.filter(r => r.status !== 'WITHDRAWN').map(r => this.mapRequest(r)) : []),
        ...(okProfile ? profile!.data!.filter(r => ['PENDING_HUMAN_REVIEW', 'APPROVED', 'REJECTED'].includes(r.status)).map(r => this.mapProfileRequest(r)) : []),
      ].sort((x, y) => y.createdMs - x.createdMs);
      this.requests.set(merged);
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
    const call$: Observable<{ success: boolean; message?: string }> = req.source === 'profile' ? this.service.reviewProfileRequest(req.id, true) : this.service.approve(req.id);
    call$.pipe(
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
    const call$: Observable<{ success: boolean; message?: string }> = req.source === 'profile' ? this.service.reviewProfileRequest(req.id, false, reason.trim()) : this.service.reject(req.id, reason.trim());
    call$.pipe(
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
        { label: 'مراجعة أولية', state: 'done' },
        { label: 'رفض الاعتماد', state: 'rejected' },
      ];
    }
    return [
      { label: 'مراجعة أولية', state: status === 'ai' ? 'active' : 'done' },
      { label: 'اعتماد بشري', state: status === 'ok' ? 'done' : (status === 'human' ? 'active' : 'pending') },
      { label: 'تطبيق', state: status === 'ok' ? 'done' : 'pending' },
    ];
  }

  private mapRequest(r: AffiliateChangeRequest): ModificationRequest {
    const status = this.mapStatus(r.status);
    const requesterName = `${r.affiliateProfile?.user?.firstName || ''} ${r.affiliateProfile?.user?.lastName || ''}`.trim() || 'وسيط تسويقي';

    return {
      id: r.id,
      source: 'affiliate',
      createdMs: new Date(r.createdAt).getTime(),
      requestNumber: r.requestNumber,
      field: r.fieldLabel,
      requesterName,
      requesterType: 'وسيط تسويقي',
      sensitive: true,
      status,
      oldValue: r.currentValue || 'لا يوجد',
      newValue: r.requestedValue,
      timeAgo: new Date(r.createdAt).toLocaleString('ar-SA'),
      verdictLabel: status === 'ai' ? 'قيد المراجعة'
        : status === 'human' ? 'نتيجة الفحص الآلي: تمرير للمراجعة'
        : status === 'ok' ? 'اعتمده المراجع'
        : 'مرفوض',
      verdictText: r.rejectionReason || r.aiRecommendation || 'لا توجد نتيجة فحص بعد',
      verdictScore: (status === 'rejected' ? 'تعارض' : 'غير متاح'),
      reviewer: r.reviewedBy || undefined,
      timeline: this.buildTimeline(status),
    };
  }

  private requesterTypeLabel(accountType: string): string {
    if (accountType.startsWith('CLIENT')) return 'طالب خدمة';
    if (accountType.startsWith('PROVIDER')) return 'مقدم خدمة';
    return 'مستخدم';
  }

  private mapProfileRequest(r: ProfileModificationRequestRow): ModificationRequest {
    const status: ReqStatus = r.status === 'APPROVED' ? 'ok' : r.status === 'REJECTED' ? 'rejected' : 'human';
    const name = `${r.provider?.firstName || ''} ${r.provider?.lastName || ''}`.trim() || r.provider?.email || 'مستخدم';
    return {
      id: r.id,
      source: 'profile',
      createdMs: new Date(r.createdAt).getTime(),
      requestNumber: `REQ-${r.id.slice(0, 8)}`,
      field: r.fieldLabel,
      requesterName: name,
      requesterType: this.requesterTypeLabel(r.provider?.accountType || ''),
      sensitive: true,
      status,
      oldValue: r.currentValue || 'لا يوجد',
      newValue: r.requestedValue,
      timeAgo: new Date(r.createdAt).toLocaleString('ar-SA'),
      verdictLabel: status === 'human' ? 'بانتظار قرار المراجع' : status === 'ok' ? 'اعتمده المراجع' : 'مرفوض',
      verdictText: r.rejectionReason || r.aiRecommendation || 'لا توجد نتيجة فحص بعد',
      verdictScore: status === 'rejected' ? 'تعارض' : 'غير متاح',
      timeline: this.buildTimeline(status),
    };
  }
}
