import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, switchMap, timer } from 'rxjs';
import { TechIndicator } from '../../../../../core/services/system-settings.store';
import { SaIndicatorCard } from './sa-indicator-card';
import { TechnicalMetricsStore } from './technical-metrics.store';

const POLL_MS = 60_000;
type Group = TechIndicator['group'];

/**
 * One honest panel for the technical IT pages (APIs, database, backups, CDN). A number appears ONLY when the server says it was measured,
 * always with the time of that reading; everything else shows «غير متاح» with the server's reason. Automatic refresh is opt-in and never faster than 60 seconds.
 * Data comes from the shared TechnicalMetricsStore (same one the monitoring home uses).
 */
@Component({
  selector: 'app-sa-metrics-panel',
  standalone: true,
  imports: [SaIndicatorCard],
  templateUrl: './sa-metrics-panel.html',
  styleUrl: './sa-metrics-panel.css',
})
export class SaMetricsPanel implements OnInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly group = input<Group | null>(null);
  /** explicit indicator keys (in this order) for pages that mix groups; otherwise every indicator of `group` */
  readonly keys = input<string[] | null>(null);

  private readonly store = inject(TechnicalMetricsStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly automatic = new BehaviorSubject(false);
  readonly automaticEnabled = signal(false);
  readonly busy = this.store.busy;
  readonly error = this.store.error;
  readonly data = this.store.data;
  readonly items = computed(() => {
    const all = this.data()?.indicators ?? [], keys = this.keys();
    return keys ? keys.map(k => all.find(i => i.key === k)).filter((i): i is TechIndicator => !!i) : all.filter(i => i.group === this.group());
  });
  readonly unavailableCount = computed(() => this.items().filter(i => i.status !== 'measured').length);

  ngOnInit() {
    this.store.load();
    this.automatic.pipe(switchMap(on => (on ? timer(POLL_MS, POLL_MS) : EMPTY)), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.store.load(true));
  }

  retry() { this.store.load(true); }
  toggleAutomatic() { const on = !this.automaticEnabled(); this.automaticEnabled.set(on); this.automatic.next(on); }
}
