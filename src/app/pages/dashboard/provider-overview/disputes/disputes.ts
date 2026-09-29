import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute as ApiDispute } from '../../../../core/models/dispute.model';
import { Dispute, DisputeTimelineStep } from './disputes.mock';

function buildTimeline(status: ApiDispute['status']): DisputeTimelineStep[] {
  return [
    { label: 'رُفع النزاع', done: true, icon: 'check' },
    {
      label: 'قيد مراجعة الإدارة',
      done: status === 'RESOLVED' || status === 'REJECTED',
      active: status === 'OPEN' || status === 'UNDER_REVIEW',
      icon: 'review',
    },
    {
      label: status === 'REJECTED' ? 'تم رفض النزاع' : 'القرار النهائي',
      done: status === 'RESOLVED' || status === 'REJECTED',
      icon: 'check',
    },
  ];
}

// Maps a real backend Dispute row onto the richer list-item shape this page's
// template expects (disputes.mock.ts's `Dispute` interface). Fields with no
// real backend source (amount, messages, showEscalate, teamMember, detail)
// are left empty/false/undefined rather than fabricated — see per-field notes
// below and DRIVE_REVIEW_PLAN.md's execution log for the tracked follow-up.
function mapDispute(d: ApiDispute, currentUserId: string | undefined): Dispute {
  const closed = d.status === 'RESOLVED' || d.status === 'REJECTED';
  const who = d.openedById === currentUserId ? 'mine' : 'against';
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
    extra: d.status === 'UNDER_REVIEW' ? 'review' : '',
    icon: closed ? 'check' : 'shield',
    iconClass: closed ? 'bg-[#0FA99A]/15 text-[#0FA99A]' : 'bg-[#FFB400]/15 text-[#FFB400]',
    badgeText,
    badgeClass: closed ? 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30' : 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
    activeBorder: d.status === 'OPEN',
    timeline: buildTimeline(d.status),
    aiText: closed ? (d.resolutionNote || d.resolution || 'تم إغلاق النزاع') : d.description,
    aiDone: closed,
    // No escrow-amount field exists on a Dispute row — omit rather than fabricate.
    amount: '',
    // No escalate endpoint exists yet.
    showEscalate: false,
    // No dispute-messaging endpoint exists yet.
    messages: 0,
    date: new Date(d.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }),
    // No backend detail/history/evidence/parties data source is wired here
    // yet (see follow-up note); detail route still falls back to the mock
    // for now when the id isn't a real one it recognizes.
    detail: undefined,
    // No backend concept of a company team-member assignment on a dispute.
    teamMember: undefined,
  };
}

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './disputes.html',
})
export class Disputes implements OnInit {
  private authStore = inject(AuthStore);
  private router = inject(Router);
  private disputeApi = inject(DisputeApiService);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  currentTab = signal<string>('all');
  showToast = signal<string>('');

  isLoading = signal<boolean>(true);
  listUnavailable = signal<boolean>(false);

  // Company mode: sends written guidance to the team member the dispute is
  // assigned to (d.teamMember). There is no backend "dispute guidance"
  // endpoint yet — submitting just confirms via toast, matching the pattern
  // already used elsewhere on this page (e.g. "رفع نزاع جديد").
  guidanceTarget = signal<Dispute | null>(null);
  guidanceText = signal<string>('');

  setTab(t: string) {
    this.currentTab.set(t);
  }

  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }

  disputes = signal<Dispute[]>([]);

  ngOnInit() {
    this.loadDisputes();
  }

  loadDisputes() {
    this.isLoading.set(true);
    const currentUserId = this.authStore.currentUser()?.id;
    this.disputeApi.getProviderDisputes({ limit: 50 }).subscribe({
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

  filteredDisputes = computed(() => {
    const f = this.currentTab();
    const list = this.disputes();
    if (f === 'all') return list;
    return list.filter(d => d.status === f || d.who === f || d.extra === f);
  });

  // KPI tiles: derived from the real disputes array instead of hardcoded
  // literals, so the numbers stay internally consistent with the list shown.
  kpis = computed(() => {
    const list = this.disputes();
    const activeDisputes = list.filter(d => d.status === 'open' && d.icon === 'shield').length;
    const activeCancellations = list.filter(d => d.status === 'open' && d.icon === 'hands').length;
    const closedAmicably = list.filter(d => d.status === 'closed').length;
    const followUpStatus = list.some(d => d.status === 'open') ? 'جارٍ' : 'لا يوجد';
    return { activeDisputes, activeCancellations, closedAmicably, followUpStatus };
  });

  tabs = computed(() => {
    const list = this.disputes();
    const countFor = (id: string) =>
      id === 'all' ? list.length : list.filter(d => d.status === id || d.who === id || d.extra === id).length;
    return [
      { id: 'all', label: 'الكل', count: countFor('all') },
      { id: 'open', label: 'نشطة', count: countFor('open') },
      { id: 'closed', label: 'مُغلقة', count: countFor('closed') },
      { id: 'mine', label: 'رفعتها أنا', count: countFor('mine') },
      { id: 'against', label: 'مرفوعة ضدي', count: countFor('against') },
      { id: 'pending', label: 'بانتظار ردي', count: countFor('pending') },
      { id: 'review', label: 'قيد المراجعة', count: countFor('review') },
    ];
  });

  // "رفع نزاع جديد": raising a dispute is only ever done in the context of a
  // specific project (dispute-api.service.ts createProviderDispute requires a
  // projectId), and that real, backend-wired flow already lives on the
  // project workspace page (projects/active/progress/:id -> openDisputeModal()
  // -> submitDispute() -> disputeApi.createProviderDispute). This page has no
  // project in scope, so instead of a dead-end toast we send the user to the
  // active-projects list to pick a project and open a dispute for real.
  goToActiveProjects() {
    this.router.navigate(['/provider-overview/projects/active']);
  }

  openGuidance(d: Dispute) {
    this.guidanceTarget.set(d);
    this.guidanceText.set('');
  }

  closeGuidance() {
    this.guidanceTarget.set(null);
  }

  sendGuidance() {
    const target = this.guidanceTarget();
    if (!target?.teamMember) return;
    this.closeGuidance();
    this.openToast(`تم إرسال التوجيه لـ${target.teamMember.name}`);
  }
}
