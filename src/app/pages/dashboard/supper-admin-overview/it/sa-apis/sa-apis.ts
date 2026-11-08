import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SaMetricsPanel } from '../../shared/sa-metrics-panel/sa-metrics-panel';
import { environment } from '../../../../../../environments/environment';

// Wired to GET /admin/system-settings/technical-metrics (process readings and a rolling request window; measured only) plus the liveness probe GET /api/health.
@Component({
  selector: 'app-sa-apis',
  standalone: true,
  imports: [SaMetricsPanel],
  templateUrl: './sa-apis.html',
})
export class SaApis implements OnInit {
  private http = inject(HttpClient);

  readonly health = signal<'checking' | 'ok' | 'down'>('checking');

  ngOnInit(): void {
    this.http.get<{ status?: string }>(`${environment.url_api}/health`).subscribe({
      next: (res) => this.health.set(res?.status === 'ok' ? 'ok' : 'down'),
      error: () => this.health.set('down'),
    });
  }
}
