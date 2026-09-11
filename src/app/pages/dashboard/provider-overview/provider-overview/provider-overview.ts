import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderApiService, ProviderStatsResponse } from '../../../../core/services/provider-api.service';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

@Component({
  selector: 'app-provider-overview',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './provider-overview.html',
  styleUrl: './provider-overview.css',
})
export class ProviderOverview implements OnInit {
  private providerApiService = inject(ProviderApiService);
  private authStore = inject(AuthStore);

  stats = signal<ProviderStatsResponse['data'] | null>(null);
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  companyDisplayName = computed<string>(() => {
    const user = this.authStore.currentUser();
    return user ? `${user.firstName} ${user.lastName}`.trim() : 'شركتك';
  });

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.providerApiService.getOverviewStats().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.stats.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load provider statistics:', err);
        this.error.set('حدث خطأ أثناء تحميل الإحصائيات');
        this.isLoading.set(false);
      }
    });
  }

  retryFetch(): void {
    this.loadStats();
  }

  getStatusLabel(status: string, type?: string): string {
    switch (status) {
      case 'IN_PROGRESS':
        return 'قيد التنفيذ';
      case 'PENDING_APPROVAL':
        return 'في انتظار الموافقة';
      case 'AWAITING_DELIVERY':
        return 'إيداع مطلوب';
      case 'PENDING':
        return 'قيد المراجعة';
      case 'UNDER_NEGOTIATION':
        return 'مرحلة التفاوض';
      case 'SUBMITTED':
      case 'IN_AI_REVIEW':
        return 'تقييم الذكاء';
      case 'ACCEPTED':
      case 'COMPLETED':
        return 'مكتمل';
      case 'REJECTED':
        return 'مرفوض';
      case 'DRAFT':
        return 'إيداع مطلوب';
      default:
        return status || 'قيد المعالجة';
    }
  }

  getStatusIconClass(status: string): string {
    switch (status) {
      case 'IN_PROGRESS':
      case 'ACCEPTED':
      case 'COMPLETED':
        return 'green';
      case 'PENDING':
      case 'SUBMITTED':
      case 'IN_AI_REVIEW':
        return 'blue';
      case 'UNDER_NEGOTIATION':
      case 'PENDING_APPROVAL':
      case 'AWAITING_DELIVERY':
        return 'teal';
      default:
        return 'amber';
    }
  }

  getStatusTextClass(status: string): string {
    switch (status) {
      case 'IN_PROGRESS':
      case 'ACCEPTED':
      case 'COMPLETED':
        return 's-done';
      case 'PENDING':
      case 'SUBMITTED':
      case 'IN_AI_REVIEW':
        return 's-offers';
      default:
        return 's-deposit';
    }
  }
}

