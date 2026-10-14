import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

// Admin sweep (D3): one shared honest "not available" state used by every admin page
// whose original content was hardcoded mock data with no backend source (subscriptions,
// IT infrastructure metrics, tasks, team performance, broadcast, etc.). It shows the page
// title, the honest Arabic reason, an optional link to the nearest REAL admin page and an
// optional disabled control that states why it is disabled. It never renders numbers.
@Component({
  selector: 'app-sa-unavailable',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './sa-unavailable.html',
  styleUrl: './sa-unavailable.css',
})
export class SaUnavailable {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly heading = input.required<string>();
  readonly reason = input.required<string>();
  readonly linkLabel = input<string>('');
  readonly linkTo = input<string>('');
  /** Label of a control kept visible but disabled; `disabledReason` explains why. */
  readonly disabledLabel = input<string>('');
  readonly disabledReason = input<string>('');
}
