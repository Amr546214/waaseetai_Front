import { Component } from '@angular/core';
import { SaUnavailable } from '../shared/sa-unavailable/sa-unavailable';

// Admin sweep (D3): this page used to render hardcoded mock data with no backend source.
// It now shows an honest "not available" state (see shared/sa-unavailable); the route and
// component are kept so the page can be wired to real data once a backend exists.
@Component({
  selector: 'app-sa-team',
  standalone: true,
  imports: [SaUnavailable],
  templateUrl: './sa-team.html',
})
export class SaTeam {}
