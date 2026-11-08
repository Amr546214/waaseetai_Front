import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, EMPTY, Subject, catchError, exhaustMap, map, merge, of, switchMap, timeout, timer } from 'rxjs';
import { EscalationReadiness, HealthItem, SystemSettingsApi } from '../../../../../core/services/system-settings.store';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

const LABELS: Record<HealthItem['status'], string> = {
  ok: 'يستجيب', down: 'لا يستجيب', configured: 'مُهيّأ',
  unconfigured: 'غير مُهيّأ', unavailable: 'غير مراقَب',
};
const CHECK_EVERY_MS = 60_000;
const HISTORY_LIMIT = 10;
type Snapshot = { checkedAt: string; items: HealthItem[] };
type Check = { id: number; checkedAt: string; status: string };

@Component({
  selector: 'app-sa-monitoring',
  imports: [RouterLink, WsDatePipe],
  templateUrl: './sa-monitoring.html',
  styleUrl: './sa-monitoring.css',
})
export class SaMonitoring implements OnInit {
  private readonly api = inject(SystemSettingsApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly refresh = new Subject<void>();
  private readonly automatic = new BehaviorSubject(false);
  private nextCheckId = 0;
  readonly automaticEnabled = signal(false);
  readonly snapshot = signal<Snapshot | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly history = signal<Check[]>([]);
  readonly escalation = signal<EscalationReadiness | null>(null);
  readonly escalationError = signal('');
  readonly labels = LABELS;
  readonly measured = computed(() => this.snapshot()?.items.filter(i => i.key === 'app' || i.key === 'database') ?? []);
  readonly configured = computed(() => this.snapshot()?.items.filter(i => i.key !== 'app' && i.key !== 'database') ?? []);

  ngOnInit() {
    this.loadEscalation();
    merge(of(undefined), this.refresh, this.automatic.pipe(
      switchMap(enabled => enabled ? timer(CHECK_EVERY_MS, CHECK_EVERY_MS) : EMPTY),
    )).pipe(
      exhaustMap(() => {
        this.busy.set(true);
        this.error.set('');
        return this.api.health().pipe(
          timeout(12_000),
          map(result => {
            if (!result.success || !result.data || !Array.isArray(result.data.items) || !Number.isFinite(Date.parse(result.data.checkedAt))) {
              throw new Error('Invalid health response');
            }
            return { snapshot: result.data, error: '' };
          }),
          catchError(error => of({ snapshot: null, error: error?.status === 403
            ? 'ليست لديك صلاحية لقراءة فحص الصحة.'
            : 'تعذّر إكمال الفحص. حاول مرة أخرى.' })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ snapshot, error }) => {
      this.busy.set(false);
      this.error.set(error);
      if (snapshot) {
        this.snapshot.set(snapshot);
        const db = snapshot.items.find(item => item.key === 'database');
        const status = db?.status === 'ok' ? 'قاعدة البيانات استجابت'
          : db?.status === 'down' ? 'قاعدة البيانات لم تستجب' : 'نتيجة قاعدة البيانات غير متاحة';
        this.addCheck(snapshot.checkedAt, status);
      }
      // A browser/network error is not a measured outage of the database.
      else this.addCheck(new Date().toISOString(), 'تعذّر إكمال الفحص');
    });
  }

  refreshNow() { this.refresh.next(); }

  loadEscalation() {
    this.escalationError.set('');
    this.api.escalationReadiness().pipe(timeout(12_000), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => { if (r.success && r.data && Array.isArray(r.data.preconditions)) this.escalation.set(r.data); else this.escalationError.set('تعذّر قراءة جاهزية التصعيد.'); },
      error: () => this.escalationError.set('تعذّر قراءة جاهزية التصعيد.'),
    });
  }

  toggleAutomatic() {
    const enabled = !this.automaticEnabled();
    this.automaticEnabled.set(enabled);
    this.automatic.next(enabled);
  }

  private addCheck(checkedAt: string, status: string) {
    const entry = { id: ++this.nextCheckId, checkedAt, status };
    this.history.update(rows => [entry, ...rows].slice(0, HISTORY_LIMIT));
  }
}
