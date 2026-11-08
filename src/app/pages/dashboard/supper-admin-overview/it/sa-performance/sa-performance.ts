import { Component } from '@angular/core';
import { SaMetricsPanel } from '../../shared/sa-metrics-panel/sa-metrics-panel';

// Wired to technical-metrics (shared store): request-window latency/error aggregates and measured database round-trip; the rest is listed as «غير متاح».
@Component({
  selector: 'app-sa-performance',
  standalone: true,
  imports: [SaMetricsPanel],
  templateUrl: './sa-performance.html',
})
export class SaPerformance {}
