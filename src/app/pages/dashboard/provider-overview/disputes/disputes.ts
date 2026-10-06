import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../core/services/dispute-api.service';
import { Dispute } from './disputes.model';
import { mapDispute } from './disputes.mapper';

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
