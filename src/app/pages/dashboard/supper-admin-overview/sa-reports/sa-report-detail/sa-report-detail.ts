import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { PlatformReportsApi, REPORT_STATUSES, REPORT_TARGETS, ReportDetail } from '../platform-reports.api';

@Component({
  selector: 'app-sa-report-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './sa-report-detail.html',
  styleUrls: ['../sa-reports.css', '../platform-reports.css'],
})
export class SaReportDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PlatformReportsApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly access = inject(AdminAccessService);
  readonly report = signal<ReportDetail | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly statuses = REPORT_STATUSES;
  readonly targets = REPORT_TARGETS;
  resolution = '';
  decision: '' | 'RESOLVED' | 'DISMISSED' = '';
  ngOnInit() { this.load(); }

  load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.api.detail(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.report.set(data); this.busy.set(false); },
      error: (e) => { this.report.set(null); this.error.set(e.status === 404 ? 'البلاغ غير موجود.' : 'تعذّر تحميل البلاغ.'); this.busy.set(false); },
    });
  }

  confirm() {
    const r = this.report();
    const reason = this.resolution.trim();
    if (!r || r.status !== 'OPEN' || !this.access.can('reports.manage') || this.busy() || !this.decision || reason.length < 5) return;
    this.busy.set(true);
    this.error.set('');
    this.api.decide(r.id, this.decision, reason).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.report.set(data); this.busy.set(false); this.resolution = ''; this.decision = ''; },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e.status === 409 ? 'تم اتخاذ قرار في البلاغ بالفعل. حدّث التفاصيل.' : 'تعذّر حفظ القرار.');
      },
    });
  }
}
