import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { Dispute } from '../../../../core/models/dispute.model';
import { disputeResolutionText } from '../../../../core/utils/dispute-labels.util';

interface DisputeTimelineStep {
  label: string;
  done?: boolean;
  active?: boolean;
  icon?: 'check' | 'review' | 'shield';
}

interface DisputeItem {
  id: string;
  /** The server's status; the card, tabs and KPIs all read from it. */
  raw: Dispute['status'];
  /** Project (or request) the dispute is about, for the link to it. */
  targetId: string | null;
  title: string;
  project: string;
  status: 'open' | 'closed';
  who: 'mine' | 'against';
  extra: 'review' | 'rejected' | '';
  icon: 'shield' | 'hands' | 'check';
  iconClass: string;
  badgeText: string;
  badgeClass: string;
  activeBorder: boolean;
  timeline: DisputeTimelineStep[];
  aiText: string;
  aiDone: boolean;
  amount: string;
  showEscalate: boolean;
  messages: number;
  date: string;
}

function buildTimeline(status: Dispute['status']): DisputeTimelineStep[] {
  const opened = { label: 'تم فتح النزاع', done: true, icon: 'shield' as const };
  const review = {
    label: 'قيد مراجعة الإدارة',
    done: status === 'RESOLVED' || status === 'REJECTED',
    active: status === 'OPEN' || status === 'UNDER_REVIEW',
    icon: 'review' as const,
  };
  const decision = {
    label: status === 'REJECTED' ? 'تم رفض النزاع' : 'القرار النهائي',
    done: status === 'RESOLVED' || status === 'REJECTED',
    icon: 'check' as const,
  };
  return [opened, review, decision];
}

function mapDispute(d: Dispute, currentUserId: string | undefined): DisputeItem {
  const closed = d.status === 'RESOLVED' || d.status === 'REJECTED';
  const who: 'mine' | 'against' = d.openedById === currentUserId ? 'mine' : 'against';
  const badgeText = d.status === 'UNDER_REVIEW' ? 'قيد مراجعة الإدارة'
    : d.status === 'RESOLVED' ? 'تم حل النزاع'
    : d.status === 'REJECTED' ? 'تم رفض النزاع'
    : 'مفتوح';

  return {
    id: d.id,
    raw: d.status,
    targetId: d.projectId || d.requestId || null,
    title: d.reason,
    project: d.request?.title || d.project?.title || '—',
    status: closed ? 'closed' : 'open',
    who,
    // No messaging/reply endpoint exists, so there is no "awaiting my reply" state — only what the server reports.
    extra: d.status === 'UNDER_REVIEW' ? 'review' : d.status === 'REJECTED' ? 'rejected' : '',
    icon: closed ? 'check' : 'shield',
    iconClass: '',
    badgeText,
    badgeClass: '',
    activeBorder: d.status === 'OPEN',
    timeline: buildTimeline(d.status),
    // Real backend text (description/resolution), not an AI-generated claim
    // — the banner's icon is decorative chrome from the existing template.
    aiText: closed ? ([disputeResolutionText(d), d.resolutionNote].filter(Boolean).join(' — ') || 'تم إغلاق النزاع') : d.description,
    aiDone: closed,
    // No escrow-amount field exists on a Dispute row — omit rather than
    // fabricate a number; the template hides this line when amount is falsy.
    amount: '',
    // No escalate endpoint exists yet.
    showEscalate: false,
    // No dispute-messaging endpoint exists yet.
    messages: 0,
    date: new Date(d.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
  };
}

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './disputes.html',
  styleUrl: './disputes.css'
})
export class Disputes implements OnInit {
  private authStore = inject(AuthStore);
  private disputeApi = inject(DisputeApiService);
  private route = inject(ActivatedRoute);
  private notify = inject(UiNotificationService);

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

  currentTab = signal<string>('all');

  isLoading = signal<boolean>(true);
  // True only on a real fetch failure — an empty-but-successful response
  // renders the honest "no disputes" state instead (see disputes.html).
  listUnavailable = signal<boolean>(false);

  disputes = signal<DisputeItem[]>([]);

  ngOnInit() {
    this.loadDisputes();
  }

  loadDisputes() {
    this.isLoading.set(true);
    const currentUserId = this.authStore.currentUser()?.id;
    this.disputeApi.getClientDisputes({ limit: 50 }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success) {
          this.listUnavailable.set(false);
          this.disputes.set((res.data?.items || []).map(d => mapDispute(d, currentUserId)));
          this.openFocusedDispute();
        } else {
          this.listUnavailable.set(true);
        }
      },
      error: () => {
        this.isLoading.set(false);
        this.listUnavailable.set(true);
      }
    });
  }

  /**
   * The client app has no dispute-details route: a notification links to /client-overview/disputes?dispute=<id>, and the list opens that
   * dispute's details (and brings its card into view) instead of leaving the client to hunt for it.
   */
  private openFocusedDispute() {
    const id = this.route.snapshot?.queryParamMap?.get('dispute');
    if (!id || !this.disputes().some(d => d.id === id) || this.detailsId() === id) return;
    this.toggleDetails(id);
    queueMicrotask(() => (document.getElementById('dispute-' + id) as HTMLElement | null)?.scrollIntoView?.({ block: 'center' }));
  }

  /** Text of the admin decision (Arabic label for a code, the admin's own text verbatim) for the details panel. */
  resolutionText = disputeResolutionText;

  setTab(t: string) {
    this.currentTab.set(t);
  }

  escalate() {
    this.notify.success('تم تصعيد النزاع للإدارة، سيتدخّل فريق الدعم خلال 24 ساعة');
  }

  filteredDisputes = computed(() => {
    const f = this.currentTab();
    const all = this.disputes();
    if (f === 'all') return all;
    return all.filter(d => d.status === f || d.who === f || d.extra === f);
  });

  // Counts of the server's own statuses only (open / under review / resolved / rejected); no mutual-cancel notion exists.
  readonly kpis = computed(() => {
    const all = this.disputes();
    return {
      activeDisputes: all.filter(d => d.raw === 'OPEN' || d.raw === 'UNDER_REVIEW').length,
      underReview: all.filter(d => d.raw === 'UNDER_REVIEW').length,
      resolved: all.filter(d => d.raw === 'RESOLVED').length,
      rejected: all.filter(d => d.raw === 'REJECTED').length,
    };
  });

  // Read-only details of one dispute (GET /client/disputes/:id). Resolving is the admin's alone; the client only reads the status.
  detailsId = signal<string | null>(null);
  detail = signal<Dispute | null>(null);
  detailLoading = signal(false);
  detailError = signal('');

  toggleDetails(id: string) {
    if (this.detailsId() === id) { this.detailsId.set(null); return; }
    this.detailsId.set(id);
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.disputeApi.getClientDispute(id).subscribe({
      next: (res) => {
        if (this.detailsId() !== id) return;
        this.detailLoading.set(false);
        if (res.success && res.data) this.detail.set(res.data);
        else this.detailError.set('تعذر تحميل تفاصيل النزاع.');
      },
      error: (err) => {
        if (this.detailsId() !== id) return;
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || 'تعذر تحميل تفاصيل النزاع.');
      }
    });
  }

  readonly tabsList = computed(() => {
    const all = this.disputes();
    return [
      { id: 'all', label: 'الكل', count: all.length },
      { id: 'open', label: 'نشطة', count: all.filter(d => d.status === 'open').length },
      { id: 'closed', label: 'مُغلقة', count: all.filter(d => d.status === 'closed').length },
      { id: 'mine', label: 'رفعتها أنا', count: all.filter(d => d.who === 'mine').length },
      { id: 'against', label: 'مرفوعة ضدي', count: all.filter(d => d.who === 'against').length },
      { id: 'review', label: 'قيد المراجعة', count: all.filter(d => d.extra === 'review').length },
      { id: 'rejected', label: 'مرفوضة', count: all.filter(d => d.extra === 'rejected').length },
    ];
  });
}
