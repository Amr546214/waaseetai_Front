import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Subject, catchError, map, merge, of, switchMap } from 'rxjs';
import { PlatformReportsApi, REPORT_STATUSES, REPORT_TARGETS, ReportPage, ReportQuery, ReportTarget } from './platform-reports.api';

function readQuery(params: ParamMap): ReportQuery {
  const status = params.get('status');
  const targetType = params.get('targetType');
  const page = Number(params.get('page'));
  return {
    status: status === 'ALL' || status === 'RESOLVED' || status === 'DISMISSED' ? status : 'OPEN',
    targetType: targetType === 'ACCOUNT' || targetType === 'SERVICE' ? targetType : undefined,
    search: params.get('search')?.trim().slice(0, 100) || undefined,
    page: Number.isSafeInteger(page) && page > 0 && page <= 100_000 ? page : 1,
  };
}

@Component({
  selector: 'app-sa-reports',
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './sa-reports.html',
  styleUrls: ['./platform-reports.css'],
})
export class SaReports implements OnInit {
  private readonly api = inject(PlatformReportsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reload = new Subject<void>();
  readonly statuses = REPORT_STATUSES;
  readonly targets = REPORT_TARGETS;
  readonly tabs: { label: string; key: ReportQuery['status'] }[] = [
    { label: 'بانتظار المراجعة', key: 'OPEN' }, { label: 'تمت المعالجة', key: 'RESOLVED' },
    { label: 'مرفوضة', key: 'DISMISSED' }, { label: 'الكل', key: 'ALL' },
  ];
  readonly query = signal<ReportQuery>({ status: 'OPEN', page: 1 });
  readonly page = signal<ReportPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  search = '';
  targetType: ReportTarget | '' = '';

  ngOnInit() {
    const navigation = this.route.queryParamMap.pipe(map(params => {
      const query = readQuery(params);
      this.query.set(query);
      this.search = query.search ?? '';
      this.targetType = query.targetType ?? '';
      return query;
    }));
    merge(navigation, this.reload.pipe(map(() => this.query()))).pipe(
      switchMap(query => {
        this.busy.set(true);
        this.error.set('');
        return this.api.list(query).pipe(map(({ data }) => data), catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(data => {
      this.page.set(data);
      if (!data) this.error.set('تعذّر تحميل البلاغات.');
      this.busy.set(false);
    });
  }

  setFilter(status: ReportQuery['status']) { this.navigate({ ...this.query(), status, page: 1 }); }
  applyFilters() { this.navigate({ ...this.query(), search: this.search.trim().slice(0, 100), targetType: this.targetType || undefined, page: 1 }); }
  resetFilters() { this.navigate({ status: 'OPEN', page: 1 }); }
  load(page: number) { this.navigate({ ...this.query(), page }); }
  retry() { this.reload.next(); }

  private navigate(query: ReportQuery) {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {
      status: query.status === 'OPEN' ? null : query.status,
      targetType: query.targetType ?? null,
      search: query.search || null,
      page: query.page === 1 ? null : query.page,
    } });
  }
}
