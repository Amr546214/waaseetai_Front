import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Subject, catchError, exhaustMap, map, merge, of, switchMap, timeout, timer } from 'rxjs';
import { SystemSettingsApi, TechIndicator, TechMetrics } from '../../../../../core/services/system-settings.store';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

const POLL_MS = 60_000;
type Group = TechIndicator['group'];

/**
 * One honest panel for the technical IT pages (APIs, database, backups, CDN). A number appears ONLY when the server says it was measured,
 * always with the time of that reading; everything else shows «غير متاح» with the server's reason. Automatic refresh is opt-in and never faster than 60 seconds.
 */
@Component({
  selector: 'app-sa-metrics-panel',
  standalone: true,
  imports: [WsDatePipe],
  templateUrl: './sa-metrics-panel.html',
  styleUrl: './sa-metrics-panel.css',
})
export class SaMetricsPanel implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly group = input.required<Group>();

  private readonly api = inject(SystemSettingsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  private readonly automatic = new BehaviorSubject(false);
  readonly automaticEnabled = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly data = signal<TechMetrics | null>(null);
  readonly items = computed(() => (this.data()?.indicators ?? []).filter(i => i.group === this.group()));
  readonly unavailableCount = computed(() => this.items().filter(i => i.status !== 'measured').length);

  ngOnInit() {
    merge(of(undefined), this.refresh, this.automatic.pipe(switchMap(on => (on ? timer(POLL_MS, POLL_MS) : EMPTY)))).pipe(
      exhaustMap(() => {
        this.busy.set(true); this.error.set('');
        return this.api.technicalMetrics().pipe(
          timeout(15_000),
          map(r => {
            if (!r.success || !r.data || !Array.isArray(r.data.indicators)) throw new Error('invalid');
            return { data: r.data, error: '' };
          }),
          catchError(e => of({ data: null as TechMetrics | null, error: e?.status === 403 ? 'ليست لديك صلاحية لقراءة المؤشرات الفنية.' : 'تعذّر قراءة المؤشرات. حاول مرة أخرى.' })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ data, error }) => { this.busy.set(false); this.error.set(error); if (data) this.data.set(data); });
  }

  retry() { this.refresh.next(); }
  toggleAutomatic() { const on = !this.automaticEnabled(); this.automaticEnabled.set(on); this.automatic.next(on); }
  display(i: TechIndicator): string { return i.value === null ? '' : i.value.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
}
