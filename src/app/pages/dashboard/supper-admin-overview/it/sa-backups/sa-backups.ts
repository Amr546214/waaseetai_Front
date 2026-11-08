import { Component } from '@angular/core';
import { SaMetricsPanel } from '../../shared/sa-metrics-panel/sa-metrics-panel';

// Wired to GET /admin/system-settings/technical-metrics: only measured values are shown, each with its reading time; the rest say «غير متاح» with the reason.
@Component({
  selector: 'app-sa-backups',
  standalone: true,
  imports: [SaMetricsPanel],
  templateUrl: './sa-backups.html',
})
export class SaBackups {}
