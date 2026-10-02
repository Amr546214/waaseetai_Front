import { Component } from '@angular/core';

// AI Cleanup Batch 3: this page used to render hardcoded infrastructure metrics
// (uptime 99.98%, CPU/memory per server, AWS regions, request rates) and a
// "refresh" button that added ±4 random jitter to those static numbers to fake a
// live update, plus a footer claiming auto-refresh every 30 seconds. The backend
// only exposes a liveness probe (GET /api/health) — no per-server CPU, memory,
// queue or load-balancer metrics — so the page now shows an honest
// "not available" state and the fake refresh is removed.
@Component({
  selector: 'app-sa-servers',
  standalone: true,
  imports: [],
  templateUrl: './sa-servers.html',
  styleUrl: './sa-servers.css',
})
export class SaServers {}
