import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SaUnavailable } from '../../shared/sa-unavailable/sa-unavailable';
import { environment } from '../../../../../../environments/environment';

// Admin sweep (D3): the endpoint list, request rates, latencies, error rates and
// integration statuses on this page were hardcoded. The only real signal the backend
// exposes is the liveness probe GET /api/health, which is kept below as a real check.
@Component({
  selector: 'app-sa-apis',
  standalone: true,
  imports: [SaUnavailable],
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
