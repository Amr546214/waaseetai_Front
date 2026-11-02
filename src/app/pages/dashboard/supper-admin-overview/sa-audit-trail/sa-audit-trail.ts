import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { reportAdminProblems } from '../shared/admin-form-report';
import { AnomalySummaryComponent } from './anomaly-summary.component';
import { AdminAuditEntry, AdminConsoleApiService, AdminRosterItem } from '../../../../core/services/admin-console-api.service';

export const AUDIT_SEVERITY_LABELS: Record<string, string> = { INFO: 'معلومة', WARNING: 'تحذير', CRITICAL: 'حرج' };
export const AUDIT_SOURCE_LABELS: Record<string, string> = { USER: 'المستخدم', ADMIN: 'مسؤول', AI: 'الذكاء الاصطناعي', SYSTEM: 'النظام' };
const SEV_STYLE: Record<string, { color: string; bg: string }> = {
  INFO: { color: '#5DA0FF', bg: 'rgba(43,127,255,.12)' },
  WARNING: { color: '#FFB400', bg: 'rgba(255,180,0,.12)' },
  CRITICAL: { color: '#FF6B6B', bg: 'rgba(255,107,107,.14)' },
};

/** Audit trail: real AccountAuditLog rows from GET /admin/console/audit-log (server-side filters + pagination). No sample data. */
@Component({
  selector: 'app-sa-audit-trail',
  standalone: true,
  imports: [WsDatePipe, CommonModule, RouterLink, AnomalySummaryComponent, FormsModule, WsSelectComponent],
  templateUrl: './sa-audit-trail.html',
  styleUrl: './sa-audit-trail.css',
})
export class SaAuditTrail implements OnInit {
  readonly scopeOptions = [{ value: 'admin', label: 'أحداث الإدارة فقط' }, { value: 'all', label: 'كل المنصة' }];
  eventTypeOptions = computed(() => [{ value: '', label: 'كل الأحداث' }, ...this.eventTypes().map((t) => ({ value: t, label: t }))]);
  actorOptions = computed(() => [{ value: '', label: 'كل الحسابات الإدارية' }, ...this.admins().map((a) => ({ value: a.id, label: a.name }))]);
  get severityWsOptions() { return this.severityOptions.map((o) => ({ value: o.v, label: o.l })); }

  private readonly api = inject(AdminConsoleApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly severityOptions = [{ v: '', l: 'كل المستويات' }, ...Object.entries(AUDIT_SEVERITY_LABELS).map(([v, l]) => ({ v, l }))];
  readonly sourceLabels = AUDIT_SOURCE_LABELS;

  readonly eventTypeFilter = signal('');
  readonly severityFilter = signal('');
  readonly actorFilter = signal('');
  readonly scope = signal<'admin' | 'all'>('admin');
  readonly searchQuery = signal('');
  readonly fromDate = signal('');
  readonly toDate = signal('');
  readonly page = signal(1);

  readonly entries = signal<AdminAuditEntry[]>([]);
  readonly total = signal(0);
  readonly pages = signal(1);
  readonly eventTypes = signal<string[]>([]);
  readonly admins = signal<AdminRosterItem[]>([]);
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly filteredCount = computed(() => this.total());

  ngOnInit(): void {
    this.api.getAdmins().subscribe({ next: (r) => this.admins.set(r.data ?? []), error: () => this.admins.set([]) });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getAuditLog({
      page: this.page(), limit: 20, q: this.searchQuery().trim(), eventType: this.eventTypeFilter(), severity: this.severityFilter(),
      actorId: this.actorFilter(), from: this.fromDate(), to: this.toDate(), scope: this.scope(),
    }).subscribe({
      next: (r) => {
        this.entries.set(r.data.items);
        this.total.set(r.data.pagination.total);
        this.pages.set(r.data.pagination.pages);
        this.eventTypes.set(r.data.eventTypes);
        this.loading.set(false);
      },
      error: () => { this.entries.set([]); this.total.set(0); this.failed.set(true); this.loading.set(false); },
    });
  }

  /** Any filter change returns to page 1 and reloads from the server. */
  setFilter(sig: { set(v: string): void }, value: string): void {
    sig.set(value);
    const from = this.fromDate(), to = this.toDate();
    if (from && to && from > to) {
      // An inverted date range is explained next to the end date instead of silently returning nothing.
      void reportAdminProblems(this.host.nativeElement, [{ field: 'au-to', message: 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية أو مساويًا له' }]);
      return;
    }
    this.page.set(1);
    this.load();
  }
  setScope(v: 'admin' | 'all'): void { this.scope.set(v); this.page.set(1); this.load(); }
  goPage(p: number): void { if (p < 1 || p > this.pages() || p === this.page()) return; this.page.set(p); this.load(); }

  sev(e: AdminAuditEntry) { return SEV_STYLE[e.severity] ?? SEV_STYLE['INFO']; }
  sevLabel(e: AdminAuditEntry) { return AUDIT_SEVERITY_LABELS[e.severity] ?? e.severity; }
  actorName(e: AdminAuditEntry) { return e.account.name || e.actorLabel || '—'; }

  /** Exports the rows currently on screen (the filtered page) — not the whole log. */
  exportCsv() {
    const esc = (v: string | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = ['النوع,الحساب,المستوى,العنوان,الوصف,IP,التاريخ'];
    this.entries().forEach((e) => rows.push([esc(e.eventType), esc(this.actorName(e)), esc(this.sevLabel(e)), esc(e.title), esc(e.summary), esc(e.ipAddress), esc(e.occurredAt)].join(',')));
    const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
