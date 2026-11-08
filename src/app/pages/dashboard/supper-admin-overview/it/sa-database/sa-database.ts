import { Component } from '@angular/core';
import { SaMetricsPanel } from '../../shared/sa-metrics-panel/sa-metrics-panel';

// Wired to GET /admin/system-settings/technical-metrics: only measured values are shown, each with its reading time; the rest say «غير متاح» with the reason.
@Component({
  selector: 'app-sa-database',
  standalone: true,
  imports: [SaMetricsPanel],
  templateUrl: './sa-database.html',
})
export class SaDatabase {}
