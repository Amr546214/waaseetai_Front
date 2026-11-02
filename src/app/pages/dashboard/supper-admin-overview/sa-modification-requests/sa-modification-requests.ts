import { Component, ElementRef, OnInit, inject, signal, computed } from '@angular/core';
import { providerTimeZone } from '../../../../core/services/provider-prefs.store';
import { CommonModule } from '@angular/common';
import { Observable, catchError, finalize, forkJoin, of } from 'rxjs';
import { ProfileAiReview } from '../../../../core/models/ai-result.model';
import { ProfileAiReviewComponent } from '../../../../shared/ai/profile-ai-review.component';
import { KycDocumentLink } from '../../../../sheards/kyc-document-link/kyc-document-link';
import { mapHttpError } from '../../../../core/forms/http-error';
import { handleAdminError, reportAdminProblems } from '../shared/admin-form-report';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { SaModificationRequestsService, AffiliateChangeRequest, ProfileModificationRequestRow } from './sa-modification-requests.service';

type ReqStatus = 'ai' | 'human' | 'ok' | 'rejected';
type FilterKey = 'all' | ReqStatus;

interface TimelineStep {
  label: string;
  state: 'done' | 'active' | 'rejected' | 'pending';
}

interface ModificationRequest {
  id: string;
  /** a DOCUMENTS request carrying a new identity document the reviewer can open */
  identityDocAccess?: boolean;
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
  /** profile requests only: the advisory AI pre-review (null when none), the raw backend status and category */
  aiReview?: ProfileAiReview | null;
  rawStatus?: string;
  category?: string;
}

/** Labels of the document keys a DOCUMENTS request carries (the server sends them as a JSON object whose values are already safe words, never a link). */
const DOC_KEY_LABELS: Record<string, string> = {
  idDocumentUrl: 'مستند الهوية', commercialRegistration: 'السجل التجاري', vatCertificateUrl: 'شهادة الضريبة', certificateUrls: 'الشهادات',
};

/** A value the server sent as a JSON object is shown as readable lines, never as raw JSON; any other text is shown as it is. */
export function readableValue(value: string | null | undefined): string {
  if (!value) return '';
  const t = String(value).trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return value;
  try {
    const parsed = JSON.parse(t);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([k, v]) => `${DOC_KEY_LABELS[k] ?? k}: ${Array.isArray(v) ? (v.length ? v.join('، ') : 'غير محدد') : typeof v === 'object' && v !== null ? 'غير محدد' : String(v ?? 'غير محدد')}`)
        .join('\n');
    }
    if (Array.isArray(parsed)) return parsed.join('، ');
  } catch { /* not JSON: show it as it is */ }
  return value;
}

@Component({
  selector: 'app-sa-modification-requests',
  standalone: true,
  imports: [CommonModule, ProfileAiReviewComponent, KycDocumentLink],
  templateUrl: './sa-modification-requests.html',
  styleUrl: './sa-modification-requests.css',
})
export class SaModificationRequests implements OnInit {
  private service = inject(SaModificationRequestsService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  /** The request whose inline reject panel is open (replaces the old native window.prompt, which could not show a field error). */
  rejectingId = signal<string | null>(null);
  rejectReason = signal('');
  rejectError = signal('');
  actionError = signal('');
  /** A failed approve: the message belongs to THAT request's card (next to its buttons), not to the top of a long list. */
  cardError = signal<{ id: string; message: string } | null>(null);

  activeFilter = signal<FilterKey>('all');
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
    this.actionError.set('');
    this.cardError.set(null);

    this.processingId.set(req.id);
    const call$: Observable<{ success: boolean; message?: string }> = req.source === 'profile' ? this.service.reviewProfileRequest(req.id, true) : this.service.approve(req.id);
    call$.pipe(
      finalize(() => this.processingId.set(null))
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.notify.success(`تم اعتماد الطلب ${req.requestNumber} وتطبيق التعديل`);
          this.loadRequests();
        } else {
          this.notify.error(res.message || 'تعذر اعتماد الطلب');
        }
      },
      error: (err) => {
        const mapped = mapHttpError(err, { fallback: 'تعذر اعتماد الطلب، حاول مرة أخرى' });
        this.cardError.set({ id: req.id, message: mapped.message });
        // the request was decided by someone else / is no longer waiting (409) or is gone (404): reload so the card shows its CURRENT state next to the message
        if (mapped.kind === 'conflict' || mapped.kind === 'not-found') this.loadRequests();
      }
    });
  }

  /** Opens the inline reason panel under the request (nothing is sent yet). */
  reject(req: ModificationRequest) {
    if (this.processingId()) return;
    this.actionError.set('');
    this.cardError.set(null);
    this.rejectError.set('');
    this.rejectReason.set('');
    this.rejectingId.set(req.id);
  }

  cancelReject() {
    if (this.processingId()) return;
    this.rejectingId.set(null);
    this.rejectError.set('');
  }

  confirmReject(req: ModificationRequest) {
    if (this.processingId()) return;
    const reason = this.rejectReason().trim();
    this.rejectError.set('');
    if (reason.length < 2) {
      void reportAdminProblems(this.host.nativeElement, [{ field: 'mr-reject-reason', message: reason ? 'سبب الرفض قصير جدًا: اكتب حرفين على الأقل' : 'سبب الرفض مطلوب' }]);
      return;
    }

    this.processingId.set(req.id);
    const call$: Observable<{ success: boolean; message?: string }> = req.source === 'profile' ? this.service.reviewProfileRequest(req.id, false, reason) : this.service.reject(req.id, reason);
    call$.pipe(
      finalize(() => this.processingId.set(null))
    ).subscribe({
      next: (res) => {
        if (res.success) {
          this.rejectingId.set(null);
          this.notify.success(`تم رفض الطلب ${req.requestNumber}`);
          this.loadRequests();
        } else {
          this.rejectError.set(res.message || 'تعذر رفض الطلب');
        }
      },
      // The panel (and the typed reason) stays open: a field-named 400 goes under the box, anything else is the honest alert.
      error: (err) => handleAdminError(this.host.nativeElement, err, { fallback: 'تعذر رفض الطلب، حاول مرة أخرى', resolve: { reason: 'mr-reject-reason', rejectionReason: 'mr-reject-reason' } }, (m) => this.rejectError.set(m))
    });
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
      oldValue: readableValue(r.currentValue) || 'لا يوجد',
      newValue: readableValue(r.requestedValue),
      timeAgo: new Date(r.createdAt).toLocaleString('ar-SA', { timeZone: providerTimeZone() }),
      verdictLabel: status === 'ai' ? 'قيد المراجعة'
        : status === 'human' ? 'تم تأكيد الهوية عبر الرمز وبانتظار مراجعة الفريق'
        : status === 'ok' ? 'اعتمده المراجع'
        : 'مرفوض',
      verdictText: r.rejectionReason || (status === 'ok' ? 'تم تطبيق التعديل بعد اعتماد الفريق' : 'بانتظار مراجعة الفريق'),
      verdictScore: (status === 'rejected' ? 'تعارض' : ''),
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
      aiReview: r.aiReview ?? null,
      rawStatus: r.status,
      category: r.category,
      identityDocAccess: r.documentsAccess?.idDocumentUrl === true,
      oldValue: readableValue(r.currentValue) || 'لا يوجد',
      newValue: readableValue(r.requestedValue),
      timeAgo: new Date(r.createdAt).toLocaleString('ar-SA', { timeZone: providerTimeZone() }),
      verdictLabel: status === 'human' ? 'بانتظار قرار المراجع' : status === 'ok' ? 'اعتمده المراجع' : 'مرفوض',
      verdictText: r.rejectionReason || (status === 'ok' ? 'تم تطبيق التعديل بعد اعتماد الفريق' : 'بانتظار مراجعة الفريق'),
      verdictScore: status === 'rejected' ? 'تعارض' : '',
      timeline: this.buildTimeline(status),
    };
  }
}
