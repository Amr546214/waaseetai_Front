import { Component } from '@angular/core';
import { SaMetricsPanel } from '../../shared/sa-metrics-panel/sa-metrics-panel';

// Process-level readings come from technical-metrics (shared store); host/container/network metrics have no source and are listed as «غير متاح» with the missing integration.
@Component({
  selector: 'app-sa-servers',
  standalone: true,
  imports: [SaMetricsPanel],
  templateUrl: './sa-servers.html',
})
export class SaServers {}
