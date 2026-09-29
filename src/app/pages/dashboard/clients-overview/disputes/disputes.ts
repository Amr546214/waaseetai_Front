import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute } from '../../../../core/models/dispute.model';

interface DisputeTimelineStep {
  label: string;
  done?: boolean;
  active?: boolean;
  icon?: 'check' | 'review' | 'shield';
}

interface DisputeItem {
  id: string;
  title: string;
  project: string;
  status: 'open' | 'closed';
  who: 'mine' | 'against';
  extra: 'review' | 'pending' | '';
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
    title: d.reason,
    project: d.request?.title || '—',
    status: closed ? 'closed' : 'open',
    who,
    // No messaging/reply endpoint exists yet, so "awaiting my reply" can't
    // be determined from real data — never fabricate a match for it.
    extra: d.status === 'UNDER_REVIEW' ? 'review' : '',
    icon: closed ? 'check' : 'shield',
    iconClass: '',
    badgeText,
    badgeClass: '',
    activeBorder: d.status === 'OPEN',
    timeline: buildTimeline(d.status),
    // Real backend text (description/resolution), not an AI-generated claim
    // — the banner's icon is decorative chrome from the existing template.
    aiText: closed ? (d.resolutionNote || d.resolution || 'تم إغلاق النزاع') : d.description,
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

  readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

  currentTab = signal<string>('all');
  showToast = signal<string>('');

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

  setTab(t: string) {
    this.currentTab.set(t);
  }

  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }

  filteredDisputes = computed(() => {
    const f = this.currentTab();
    const all = this.disputes();
    if (f === 'all') return all;
    return all.filter(d => d.status === f || d.who === f || d.extra === f);
  });

  readonly kpis = computed(() => {
    const all = this.disputes();
    const activeDisputes = all.filter(d => d.status === 'open' && d.icon === 'shield').length;
    const mutualCancelPending = all.filter(d => d.status === 'open' && d.icon === 'hands').length;
    const closedMutual = all.filter(d => d.status === 'closed').length;
    const hasOpen = all.some(d => d.status === 'open');
    return {
      activeDisputes,
      mutualCancelPending,
      closedMutual,
      overallStatus: all.length === 0 ? '—' : (hasOpen ? 'جارٍ' : 'مكتمل'),
    };
  });

  readonly tabsList = computed(() => {
    const all = this.disputes();
    return [
      { id: 'all', label: 'الكل', count: all.length },
      { id: 'open', label: 'نشطة', count: all.filter(d => d.status === 'open').length },
      { id: 'closed', label: 'مُغلقة', count: all.filter(d => d.status === 'closed').length },
      { id: 'mine', label: 'رفعتها أنا', count: all.filter(d => d.who === 'mine').length },
      { id: 'against', label: 'مرفوعة ضدي', count: all.filter(d => d.who === 'against').length },
      { id: 'pending', label: 'بانتظار ردي', count: all.filter(d => d.extra === 'pending').length },
      { id: 'review', label: 'قيد المراجعة', count: all.filter(d => d.extra === 'review').length },
    ];
  });
}
