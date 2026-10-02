import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

// AI Cleanup Batch 3: this page used to render a fully fabricated list of user
// reports (sa-reports.data.ts, now deleted) — invented reporters and reported
// accounts, fraud labels, AI risk scores, "suggested action" recommendations
// (e.g. "تعليق فوري") and KPIs — with "suspend"/"warn"/"dismiss" buttons that
// only changed local state and toasted success without doing anything. There is
// no user-report/complaint model or endpoint in the backend, so the page now
// shows an honest "not available" state instead.
@Component({
  selector: 'app-sa-reports',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sa-reports.html',
  styleUrl: './sa-reports.css',
})
export class SaReports {}
