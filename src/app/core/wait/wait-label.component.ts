import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { waitLabel } from './wait-format';

/** The ticking «بعد 1:23» next to / inside a disabled action. Renders nothing at zero. Feed it `handle.remainingSeconds()`. */
@Component({
	selector: 'app-wait-label',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: '@if (text()) { <span class="ws-wait-label" data-testid="wait-label" dir="rtl">{{ text() }}</span> }',
})
export class WaitLabelComponent {
	readonly seconds = input<number>(0);
	readonly text = computed(() => (this.seconds() > 0 ? waitLabel(this.seconds()) : ''));
}
