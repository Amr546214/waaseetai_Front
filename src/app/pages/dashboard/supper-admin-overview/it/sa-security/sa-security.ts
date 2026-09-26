import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminSecurityApiService, SecurityEventItem } from '../../../../../core/services/admin-security-api.service';

type SecTab = 'all' | 'SECURITY_CHANGE' | 'SYSTEM_AUDIT' | 'PROFILE_COMPLETION' | 'ROLE_ADDITION';

// Implementation Batch 7 — this page used to render 5 fully fabricated
// security events (a fake brute-force attempt, a fake SQL injection
// attempt, invented IPs/timestamps) and fabricated KPIs ("847 محاولات
// فاشلة", "124 IPs محجوبة", "24,812 Audit Logs اليوم", "Threat Score:
// LOW"). It now reads AccountAuditLog via GET /admin/security/events — a
// real, already-populated model (auth.service.ts, session.service.ts,
// provider-profile.service.ts, etc. all write real rows with real
// ipAddress/severity/source). There is no real automatic IP-blocking
// system anywhere in the backend, so the "blocked-ips" tab and the
// "حجب تلقائي" (automatic blocking) claim are removed rather than faked —
// building real IP blocking is a separate infrastructure capability.
@Component({
  selector: 'app-sa-security',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-security.html',
  styleUrl: './sa-security.css',
})
export class SaSecurity implements OnInit {
  private api = inject(AdminSecurityApiService);

  readonly tabs: { key: SecTab; label: string }[] = [
    { key: 'all', label: 'كل الأحداث' },
    { key: 'SECURITY_CHANGE', label: 'أمان الحساب' },
    { key: 'SYSTEM_AUDIT', label: 'تدقيق النظام' },
    { key: 'PROFILE_COMPLETION', label: 'تعديلات الملف' },
    { key: 'ROLE_ADDITION', label: 'الأدوار' },
  ];

  readonly activeTab = signal<SecTab>('all');
  readonly isLoading = signal<boolean>(true);
  readonly events = signal<SecurityEventItem[]>([]);
  readonly kpis = signal({ totalEventsToday: 0, criticalOrWarningToday: 0, failedLoginAttemptsToday: 0 });

  ngOnInit(): void {
    this.api.getSecurityEvents().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.events.set(res.data.events);
          this.kpis.set(res.data.kpis);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  readonly filteredEvents = computed<SecurityEventItem[]>(() => {
    const tab = this.activeTab();
    if (tab === 'all') return this.events();
    return this.events().filter((e) => e.category === tab);
  });

  setTab(tab: SecTab): void {
    this.activeTab.set(tab);
  }

  severityLabel(s: string): string {
    switch (s) {
      case 'CRITICAL': return 'خطيرة';
      case 'WARNING': return 'متوسطة';
      default: return 'معلومات';
    }
  }

  severityStyle(s: string): { bg: string; color: string } {
    switch (s) {
      case 'CRITICAL': return { bg: 'rgba(255,140,105,.15)', color: '#FF8C69' };
      case 'WARNING': return { bg: 'rgba(255,180,0,.1)', color: '#FFB400' };
      default: return { bg: 'rgba(43,127,255,.1)', color: '#5DA0FF' };
    }
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'REJECTED': return 'مرفوض';
      case 'APPROVED': return 'مقبول';
      case 'IN_REVIEW': return 'قيد المراجعة';
      default: return 'مكتمل';
    }
  }

  isRejected(status: string): boolean {
    return status === 'REJECTED';
  }
}
