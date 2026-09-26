import { Component, OnInit, computed, inject, signal } from '@angular/core';
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

  readonly isLoading = signal<boolean>(true);
  readonly flaggedAccounts = signal<FlaggedAccountItem[]>([]);

  readonly kpis = computed(() => {
    const list = this.flaggedAccounts();
    return {
      suspendedCount: list.length,
      withOpenDisputes: list.filter((a) => a.openDisputesAgainst > 0).length,
    };
  });

  ngOnInit(): void {
    this.api.getFlaggedAccounts().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.flaggedAccounts.set(res.data);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  statusLabel(status: string): string {
    return status === 'SUSPENDED_REVIEW' ? 'موقوف قيد المراجعة' : 'موقوف';
  }
}
