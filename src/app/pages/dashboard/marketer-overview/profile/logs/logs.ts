import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { AccountLogsService } from '../../../../../core/services/account-logs.service';

interface ActivityRow { id: string; title: string; status: string; at: string }

/** The marketer's own account activity: the same audit log every role reads (GET /api/account/logs), newest first. */
@Component({
  selector: 'app-marketer-logs',
  standalone: true,
  imports: [CommonModule, WsDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="p-4" dir="rtl" data-testid="marketer-logs">
      <h2 style="font-size:var(--font-size-h3);font-weight:800;margin-bottom:4px">سجل النشاط والأمان</h2>
      <p class="txt-muted" style="font-size:var(--font-size-small);margin-bottom:16px">آخر الأحداث على حسابك – تُحدَّث تلقائيًا.</p>
      @switch (state()) {
        @case ('loading') { <div class="txt-muted" data-testid="logs-loading">جارٍ تحميل السجل...</div> }
        @case ('error') {
          <div role="alert" data-testid="logs-error">تعذر تحميل سجل النشاط.
            <button type="button" style="text-decoration:underline;margin-inline-start:8px" (click)="load()">إعادة المحاولة</button>
          </div>
        }
        @default {
          @if (rows().length) {
            @for (row of rows(); track row.id) {
              <div class="activity-row" data-testid="logs-row" style="display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)">
                <span>{{ row.title }}@if (row.status) { <span class="txt-muted"> · {{ row.status }}</span> }</span>
                <span class="txt-muted" style="font-size:var(--font-size-small)">{{ row.at | wsDate:'datetime' }}</span>
              </div>
            }
          } @else {
            <div class="txt-muted" data-testid="logs-empty">لا توجد أنشطة حديثة للعرض</div>
          }
        }
      }
    </section>
  `,
})
export class Logs implements OnInit {
  private logs = inject(AccountLogsService);
  state = signal<'loading' | 'error' | 'ready'>('loading');
  rows = signal<ActivityRow[]>([]);

  ngOnInit() { this.load(); }

  load() {
    this.state.set('loading');
    this.logs.getUserLogs({ limit: 30 }).subscribe({
      next: (res) => {
        if (!res?.success) { this.state.set('error'); return; }
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        this.rows.set(items.map((log: any) => ({ id: String(log.id), title: String(log.summary || log.title || log.actionText || 'إجراء في الحساب'), status: String(log.statusText || ''), at: String(log.occurredAt || log.createdAt || '') })));
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }
}
