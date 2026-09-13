import { Component, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { DISPUTES_MOCK } from './disputes.mock';

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './disputes.html',
})
export class Disputes {
  private authStore = inject(AuthStore);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  currentTab = signal<string>('all');
  showToast = signal<string>('');

  setTab(t: string) {
    this.currentTab.set(t);
  }

  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }

  // Sourced from the shared mock (disputes.mock.ts) so the list and the
  // dispute-details route always show the same data — there is no
  // provider-facing "get dispute by id" backend endpoint yet.
  disputes = DISPUTES_MOCK;

  filteredDisputes = computed(() => {
    let f = this.currentTab();
    if (f === 'all') return this.disputes;
    return this.disputes.filter(d => d.status === f || d.who === f || d.extra === f);
  });
}
