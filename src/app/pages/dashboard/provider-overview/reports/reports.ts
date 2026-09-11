import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html'
})
export class Reports {
  private authStore = inject(AuthStore);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  currentTab = signal<string>('orders');
  currentPeriod = signal<string>('month');
  showDatePicker = signal<boolean>(false);
  showToast = signal<string>('');
  
  // Filters
  orderStatus = signal<string>('all');
  projStatus = signal<string>('all');
  projRating = signal<string>('all');
  projDuration = signal<string>('all');
  finType = signal<string>('all');
  finStatus = signal<string>('all');
  dispStatus = signal<string>('all');
  dispReason = signal<string>('all');
  
  setTab(tab: string) {
    this.currentTab.set(tab);
  }
  
  setPeriod(period: string) {
    this.currentPeriod.set(period);
    if (period === 'custom') {
      this.showDatePicker.set(true);
    } else {
      this.showDatePicker.set(false);
    }
  }
  
  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }
}
