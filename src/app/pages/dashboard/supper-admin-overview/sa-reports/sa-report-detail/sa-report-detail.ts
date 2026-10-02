import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// AI Cleanup Batch 3: this page used to look a report up in the fabricated
// sa-reports.data.ts array and show an AI risk score, an "AI detected a possible
// fraud pattern" alert, linked-account/IP "networks" and evidence — all invented —
// next to real-looking user names, with suspend/warn/dismiss buttons that only
// changed local state. No user-report backend exists, so the route stays
// reachable but shows an honest "not available" state.
@Component({
  selector: 'app-sa-report-detail',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sa-report-detail.html',
  styleUrls: ['../sa-reports.css', './sa-report-detail.css'],
})
export class SaReportDetail {}
