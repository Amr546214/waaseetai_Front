import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminAccessService } from '../../../../core/services/admin-access.service';
import { ConfirmModalService } from '../../../../core/services/confirm-modal.service';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminSecurityApiService, FlaggedAccountItem } from '../../../../core/services/admin-security-api.service';

// Implementation Batch 7 — this page used to render entirely fictional
// data: hardcoded riskAccounts with invented per-account "risk scores"
// (89/76/62) and fabricated fraud accusations attributed to real-sounding
// names, a hardcoded "أنماط الاحتيال المكتشفة" (fraud patterns) list, a
// fake live "3 حسابات على نفس الجهاز" alert, and a client-side-only
// "blocked IPs" list that never persisted anywhere. None of it was backed
// by any real model — there is no fraud-detection engine, no per-user risk
// score (User.aiRiskScore exists in the schema but is never computed
// anywhere — see admin-users.service.ts), and no IP-blocking mechanism
// anywhere in the backend. Building real fraud detection or IP blocking is
// a new capability, not something to fake here (and this platform does not
// build autonomous AI fraud/security decision systems in any case — every
// suspension here was a human admin's own decision). This page now shows
// only what is real: accounts a human admin has actually suspended, and
// their real open-dispute counts.
@Component({
  selector: 'app-sa-risk-center',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-risk-center.html',
  styleUrl: './sa-risk-center.css',
})
export class SaRiskCenter implements OnInit {
  private api = inject(AdminSecurityApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmModal = inject(ConfirmModalService);
  readonly access = inject(AdminAccessService);
  readonly busyUserId = signal<string | null>(null);
  readonly actionError = signal('');
  readonly actionNotice = signal('');

  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<boolean>(false);
  readonly flaggedAccounts = signal<FlaggedAccountItem[]>([]);

  readonly kpis = computed(() => {
    const list = this.flaggedAccounts();
    return {
      suspendedCount: list.length,
      withOpenDisputes: list.filter((a) => a.openDisputesAgainst > 0).length,
    };
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.api.getFlaggedAccounts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.flaggedAccounts.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  async reactivate(account: FlaggedAccountItem): Promise<void> {
    if (!this.access.can('users.suspend') || this.busyUserId()) return;
    this.busyUserId.set(account.userId);
    this.actionError.set(''); this.actionNotice.set('');
    const approved = await this.confirmModal.confirm({ title: 'إعادة تفعيل الحساب', type: 'warning', confirmText: 'إعادة التفعيل',
      message: `هل تريد إعادة تفعيل حساب «${account.name}»؟ سيتمكن من الدخول مجددًا. النزاعات القائمة ومراجعة الهوية لا تتغير بهذا الإجراء.` });
    if (!approved || this.destroyRef.destroyed) { this.busyUserId.set(null); return; }
    this.api.reactivateAccount(account.userId).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busyUserId.set(null))).subscribe({
      next: res => {
        if (!res.success || res.data?.status !== 'ACTIVE') { this.actionError.set('لم يؤكد الخادم إعادة التفعيل. حدّث القائمة للتحقق من الحالة.'); return; }
        this.flaggedAccounts.update(rows => rows.filter(row => row.userId !== account.userId));
        this.actionNotice.set(`أُعيد تفعيل حساب «${account.name}» وسُجّل الإجراء.`);
      },
      error: err => { this.actionError.set(err?.status === 403 ? 'ليست لديك صلاحية إعادة تفعيل هذا الحساب.' : err?.status === 409 ? 'تغيّرت حالة الحساب. حدّث القائمة قبل المحاولة مرة أخرى.' : 'تعذّرت إعادة التفعيل. حدّث القائمة للتحقق من الحالة قبل إعادة المحاولة.'); },
    });
  }

  readonly accountTypeLabels: Record<string, string> = {
    CLIENT: 'طالب خدمة',
    CLIENT_INDIVIDUAL: 'طالب خدمة (فرد)',
    CLIENT_COMPANY: 'طالب خدمة (شركة)',
    PROVIDER_INDIVIDUAL: 'مقدم خدمة (فرد)',
    PROVIDER_COMPANY: 'مقدم خدمة (شركة)',
    AFFILIATE: 'وسيط تسويقي',
  };

  accountTypeLabel(type: string): string {
    return this.accountTypeLabels[type] || type;
  }

  statusLabel(status: string): string {
    return status === 'SUSPENDED_REVIEW' ? 'موقوف قيد المراجعة' : 'موقوف';
  }
}
