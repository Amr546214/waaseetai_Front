import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SaKycService } from './sa-kyc.service';
import {
  OnboardingRequest,
  OnboardingStatus,
  OnboardingQuery,
  KycProvider,
  KycStatus,
  KycProviderQuery,
} from '../../../../core/models/onboarding.model';

type Tab = 'clients' | 'providers';

@Component({
  selector: 'app-sa-kyc',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-kyc.html',
  styleUrls: ['./sa-kyc.css']
})
export class SaKyc implements OnInit {
  private kycService = inject(SaKycService);

  // ── Tab state ───────────────────────────────────────────────────────
  activeTab = signal<Tab>('clients');

  // ── Client onboarding state ─────────────────────────────────────────
  onboarding = signal<OnboardingRequest[]>([]);
  onboardingLoading = signal<boolean>(false);
  onboardingError = signal<string | null>(null);
  onboardingStatusFilter = signal<string>('all');
  onboardingPage = signal<number>(1);
  onboardingTotalPages = signal<number>(1);
  onboardingTotal = signal<number>(0);
  readonly limit = 10;

  readonly onboardingStatusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'PENDING', label: 'قيد المراجعة' },
    { value: 'APPROVED', label: 'مقبول' },
    { value: 'REJECTED', label: 'مرفوض' },
  ];

  // ── Provider KYC state ──────────────────────────────────────────────
  providers = signal<KycProvider[]>([]);
  providersLoading = signal<boolean>(false);
  providersError = signal<string | null>(null);
  providersStatusFilter = signal<string>('all');
  providersPage = signal<number>(1);
  providersTotalPages = signal<number>(1);
  providersTotal = signal<number>(0);

  readonly providerStatusOptions: { value: string; label: string }[] = [
    { value: 'all', label: 'الكل' },
    { value: 'UNVERIFIED', label: 'غير موثق' },
    { value: 'PENDING', label: 'قيد المراجعة' },
    { value: 'VERIFIED', label: 'موثق' },
    { value: 'REJECTED', label: 'مرفوض' },
  ];

  // ── Detail modal ────────────────────────────────────────────────────
  showDetailModal = signal<boolean>(false);
  detailLoading = signal<boolean>(false);
  detailError = signal<string | null>(null);
  selectedOnboarding = signal<OnboardingRequest | null>(null);
  selectedProvider = signal<KycProvider | null>(null);

  // ── Action modal ────────────────────────────────────────────────────
  showActionModal = signal<boolean>(false);
  actionType = signal<'approve' | 'reject'>('approve');
  actionReason = signal<string>('');
  actionNote = signal<string>('');
  processing = signal<boolean>(false);
  actionError = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // ── Computed summary (from loaded items) ────────────────────────────
  onboardingPending = computed(() => this.onboarding().filter(o => o.status === 'PENDING').length);
  onboardingApproved = computed(() => this.onboarding().filter(o => o.status === 'APPROVED').length);
  onboardingRejected = computed(() => this.onboarding().filter(o => o.status === 'REJECTED').length);

  providersPending = computed(() => this.providers().filter(p => p.kycStatus === 'PENDING' || p.kycStatus === 'UNVERIFIED').length);
  providersVerified = computed(() => this.providers().filter(p => p.kycStatus === 'VERIFIED' || p.isVerified === true).length);
  providersRejected = computed(() => this.providers().filter(p => p.kycStatus === 'REJECTED').length);

  ngOnInit() {
    this.loadOnboarding();
  }

  // ── Tab switching ───────────────────────────────────────────────────
  switchTab(tab: Tab) {
    if (this.activeTab() === tab) return;
    this.activeTab.set(tab);
    this.successMessage.set(null);
    if (tab === 'clients' && this.onboarding().length === 0) {
      this.loadOnboarding();
    } else if (tab === 'providers' && this.providers().length === 0) {
      this.loadProviders();
    }
  }

  // ── Client onboarding ───────────────────────────────────────────────
  loadOnboarding() {
    this.onboardingLoading.set(true);
    this.onboardingError.set(null);

    const query: OnboardingQuery = {
      page: this.onboardingPage(),
      limit: this.limit,
    };
    if (this.onboardingStatusFilter() !== 'all') {
      query.status = this.onboardingStatusFilter();
    }

    this.kycService.getOnboardingRequests(query).subscribe({
      next: (res) => {
        this.onboardingLoading.set(false);
        const data = res?.data;
        if (data) {
          const items = data.onboardingRequests ?? data.items ?? [];
          this.onboarding.set(items);
          const pag = data.pagination;
          if (pag) {
            this.onboardingTotal.set(pag.total ?? 0);
            this.onboardingTotalPages.set(pag.totalPages ?? pag.pages ?? 1);
          } else {
            this.onboardingTotal.set(data.total ?? items.length);
            this.onboardingTotalPages.set(data.totalPages ?? data.pages ?? 1);
          }
        } else {
          this.onboarding.set([]);
          this.onboardingTotal.set(0);
          this.onboardingTotalPages.set(1);
        }
      },
      error: (err) => {
        this.onboardingLoading.set(false);
        if (err?.status === 204) {
          this.onboarding.set([]);
          this.onboardingTotal.set(0);
          this.onboardingTotalPages.set(1);
          this.onboardingError.set(null);
        } else {
          this.onboardingError.set(err?.error?.message || err?.message || 'تعذر تحميل طلبات التحقق');
        }
      },
    });
  }

  onOnboardingStatusChange(status: string) {
    this.onboardingStatusFilter.set(status);
    this.onboardingPage.set(1);
    this.loadOnboarding();
  }

  goToOnboardingPage(page: number) {
    if (page < 1 || page > this.onboardingTotalPages()) return;
    this.onboardingPage.set(page);
    this.loadOnboarding();
  }

  viewOnboardingDetail(id: string) {
    this.showDetailModal.set(true);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.selectedOnboarding.set(null);
    this.selectedProvider.set(null);

    this.kycService.getOnboardingRequest(id).subscribe({
      next: (res) => {
        this.detailLoading.set(false);
        if (res?.data) {
          this.selectedOnboarding.set(res.data);
        } else {
          this.detailError.set('لم يتم العثور على الطلب');
        }
      },
      error: (err) => {
        this.detailLoading.set(false);
        this.detailError.set(err?.error?.message || err?.message || 'تعذر تحميل تفاصيل الطلب');
      },
    });
  }

  // ── Provider KYC ────────────────────────────────────────────────────
  loadProviders() {
    this.providersLoading.set(true);
    this.providersError.set(null);

    const query: KycProviderQuery = {
      page: this.providersPage(),
      limit: this.limit,
    };
    if (this.providersStatusFilter() !== 'all') {
      query.status = this.providersStatusFilter();
    }

    this.kycService.getKycProviders(query).subscribe({
      next: (res) => {
        this.providersLoading.set(false);
        const data = res?.data;
        if (data) {
          const items = data.providers ?? data.items ?? [];
          this.providers.set(items);
          const pag = data.pagination;
          if (pag) {
            this.providersTotal.set(pag.total ?? 0);
            this.providersTotalPages.set(pag.totalPages ?? pag.pages ?? 1);
          } else {
            this.providersTotal.set(data.total ?? items.length);
            this.providersTotalPages.set(data.totalPages ?? data.pages ?? 1);
          }
        } else {
          this.providers.set([]);
          this.providersTotal.set(0);
          this.providersTotalPages.set(1);
        }
      },
      error: (err) => {
        this.providersLoading.set(false);
        if (err?.status === 204) {
          this.providers.set([]);
          this.providersTotal.set(0);
          this.providersTotalPages.set(1);
          this.providersError.set(null);
        } else {
          this.providersError.set(err?.error?.message || err?.message || 'تعذر تحميل مقدمي الخدمة');
        }
      },
    });
  }

  onProviderStatusChange(status: string) {
    this.providersStatusFilter.set(status);
    this.providersPage.set(1);
    this.loadProviders();
  }

  goToProviderPage(page: number) {
    if (page < 1 || page > this.providersTotalPages()) return;
    this.providersPage.set(page);
    this.loadProviders();
  }

  viewProviderDetail(p: KycProvider) {
    this.showDetailModal.set(true);
    this.detailLoading.set(false);
    this.detailError.set(null);
    this.selectedOnboarding.set(null);
    this.selectedProvider.set(p);
  }

  // ── Modal / actions ─────────────────────────────────────────────────
  closeDetailModal() {
    this.showDetailModal.set(false);
    this.selectedOnboarding.set(null);
    this.selectedProvider.set(null);
    this.detailError.set(null);
    this.successMessage.set(null);
  }

  openActionModal(action: 'approve' | 'reject') {
    this.actionType.set(action);
    this.actionReason.set('');
    this.actionNote.set('');
    this.actionError.set(null);
    this.showActionModal.set(true);
  }

  closeActionModal() {
    this.showActionModal.set(false);
    this.actionReason.set('');
    this.actionNote.set('');
    this.actionError.set(null);
  }

  confirmAction() {
    if (this.actionType() === 'reject' && !this.actionReason().trim()) {
      this.actionError.set('سبب الرفض مطلوب');
      return;
    }

    this.processing.set(true);
    this.actionError.set(null);

    const isClient = this.activeTab() === 'clients';
    const onboarding = this.selectedOnboarding();
    const provider = this.selectedProvider();

    if (isClient && onboarding) {
      if (this.actionType() === 'approve') {
        this.kycService.approveOnboarding(onboarding.id, this.actionNote().trim() ? { adminNote: this.actionNote().trim() } : undefined).subscribe({
          next: () => this.onActionSuccess('تمت الموافقة على الطلب بنجاح'),
          error: (err) => this.onActionError(err),
        });
      } else {
        this.kycService.rejectOnboarding(onboarding.id, { rejectionReason: this.actionReason().trim() }).subscribe({
          next: () => this.onActionSuccess('تم رفض الطلب'),
          error: (err) => this.onActionError(err),
        });
      }
    } else if (!isClient && provider) {
      if (this.actionType() === 'approve') {
        this.kycService.approveKycProvider(provider.userId, this.actionNote().trim() ? { adminNote: this.actionNote().trim() } : undefined).subscribe({
          next: () => this.onActionSuccess('تم توثيق مقدم الخدمة بنجاح'),
          error: (err) => this.onActionError(err),
        });
      } else {
        this.kycService.rejectKycProvider(provider.userId, { rejectionReason: this.actionReason().trim() }).subscribe({
          next: () => this.onActionSuccess('تم رفض توثيق مقدم الخدمة'),
          error: (err) => this.onActionError(err),
        });
      }
    }
  }

  private onActionSuccess(msg: string) {
    this.processing.set(false);
    this.showActionModal.set(false);
    this.successMessage.set(msg);
    // Refresh current tab list
    if (this.activeTab() === 'clients') {
      this.loadOnboarding();
    } else {
      this.loadProviders();
    }
    // Close detail modal after action
    setTimeout(() => {
      this.showDetailModal.set(false);
      this.selectedOnboarding.set(null);
      this.selectedProvider.set(null);
    }, 800);
  }

  private onActionError(err: any) {
    this.processing.set(false);
    this.actionError.set(err?.error?.message || err?.message || 'تعذر تنفيذ الإجراء');
  }

  // ── Helpers ─────────────────────────────────────────────────────────
  getOnboardingStatusLabel(status?: OnboardingStatus): string {
    const map: Record<string, string> = {
      PENDING: 'قيد المراجعة',
      APPROVED: 'مقبول',
      REJECTED: 'مرفوض',
    };
    return map[status as string] || status || 'غير محدد';
  }

  getOnboardingStatusClass(status?: OnboardingStatus): string {
    const map: Record<string, string> = {
      PENDING: 'st-pending',
      APPROVED: 'st-approved',
      REJECTED: 'st-rejected',
    };
    return map[status as string] || 'st-pending';
  }

  getKycStatusLabel(status?: KycStatus): string {
    const map: Record<string, string> = {
      UNVERIFIED: 'غير موثق',
      PENDING: 'قيد المراجعة',
      VERIFIED: 'موثق',
      REJECTED: 'مرفوض',
    };
    return map[status as string] || status || 'غير محدد';
  }

  getKycStatusClass(status?: KycStatus): string {
    const map: Record<string, string> = {
      UNVERIFIED: 'st-unverified',
      PENDING: 'st-pending',
      VERIFIED: 'st-verified',
      REJECTED: 'st-rejected',
    };
    return map[status as string] || 'st-unverified';
  }

  getShortId(id?: string): string {
    if (!id) return '—';
    return id.length > 8 ? id.substring(0, 8) : id;
  }

  formatDate(date?: string | null): string {
    if (!date) return '—';
    try {
      return new Date(date).toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return date;
    }
  }

  getWaitDuration(createdAt?: string | null): string {
    if (!createdAt) return '—';
    try {
      const created = new Date(createdAt).getTime();
      const now = Date.now();
      const diffMs = now - created;
      if (diffMs < 0) return '—';
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      if (hours < 1) return 'أقل من ساعة';
      if (hours < 24) return `${hours} ساعة`;
      const days = Math.floor(hours / 24);
      return `${days} يوم`;
    } catch {
      return '—';
    }
  }

  getDocTypeLabel(type?: string): string {
    const map: Record<string, string> = {
      national_id: 'هوية وطنية',
      passport: 'جواز سفر',
      iqama: 'إقامة',
      commercial_register: 'سجل تجاري',
      license: 'ترخيص',
    };
    return map[type || ''] || type || '—';
  }

  getCertCount(urls?: string[] | null): number {
    return Array.isArray(urls) ? urls.length : 0;
  }

  getPagesArray(total: number): number[] {
    const pages: number[] = [];
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
    return pages;
  }
}
