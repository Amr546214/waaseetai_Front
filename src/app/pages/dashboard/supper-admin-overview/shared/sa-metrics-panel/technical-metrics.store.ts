import { Injectable, inject, signal } from '@angular/core';
import { timeout } from 'rxjs';
import { SystemSettingsApi, TechMetrics } from '../../../../../core/services/system-settings.store';

const FRESH_MS = 15_000;
/** ONE fetch and ONE cache behind every monitoring page (home cards and detail pages), so a card and its detail page always show the same reading. */
@Injectable({ providedIn: 'root' })
export class TechnicalMetricsStore {
  private readonly api = inject(SystemSettingsApi);
  readonly data = signal<TechMetrics | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  private at = 0;

  /** `force` skips the 15 s client cache (manual refresh / the 60 s poll); a request already in flight is never duplicated */
  load(force = false) {
    if (this.busy()) return;
    if (!force && this.data() && Date.now() - this.at < FRESH_MS) return;
    this.busy.set(true); this.error.set('');
    this.api.technicalMetrics().pipe(timeout(15_000)).subscribe({
      next: r => {
        this.busy.set(false);
        if (!r.success || !r.data || !Array.isArray(r.data.indicators)) { this.error.set('تعذّر قراءة المؤشرات. حاول مرة أخرى.'); return; }
        this.data.set(r.data); this.at = Date.now();
      },
      error: e => { this.busy.set(false); this.error.set(e?.status === 403 ? 'ليست لديك صلاحية لقراءة المؤشرات الفنية.' : 'تعذّر قراءة المؤشرات. حاول مرة أخرى.'); },
    });
  }
}
