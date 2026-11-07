import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PlatformReportsApi, REPORT_STATUSES, REPORT_TARGETS, ReportPage, ReportStatus } from './platform-reports.api';

@Component({
  selector: 'app-sa-reports',
  imports: [RouterLink, DatePipe],
  templateUrl: './sa-reports.html',
  styleUrls: ['./sa-reports.css', './platform-reports.css'],
})
export class SaReports implements OnInit {
  private readonly api = inject(PlatformReportsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly statuses = REPORT_STATUSES;
  readonly targets = REPORT_TARGETS;
  readonly tabs: { label: string; key?: ReportStatus }[] = [
    { label: 'بانتظار المراجعة', key: 'OPEN' }, { label: 'تمت المعالجة', key: 'RESOLVED' },
    { label: 'مرفوضة', key: 'DISMISSED' }, { label: 'الكل' },
  ];
  readonly filter = signal<ReportStatus | undefined>('OPEN');
  readonly page = signal<ReportPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  ngOnInit() { this.load(1); }

  setFilter(key?: ReportStatus) {
    if (this.busy()) return;
    this.filter.set(key);
    this.load(1);
  }

  load(page: number) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.list(page, this.filter()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.page.set(data); this.busy.set(false); },
      error: () => { this.page.set(null); this.error.set('تعذّر تحميل البلاغات.'); this.busy.set(false); },
    });
  }
}
