import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output } from '@angular/core';
import { LAST_RATE_LIMIT_SCOPE, WaitHandle, WaitTimerService } from '../../core/wait/wait-timer.service';
import { rateLimitSentence } from '../../core/wait/wait-format';
import { RATE_LIMIT_MESSAGE } from '../../core/utils/rate-limit.util';

/**
 * A 429 hit while the page already shows data: the data stays, and this strip says «طلبات كثيرة، يمكنك إعادة المحاولة بعد m:ss» (ticking, from the stored end
 * timestamp of the rate-limited request). The optional refresh button is disabled until the end; reaching zero reloads NOTHING by itself.
 * No stored end (the server stated no wait) = the honest sentence without a number.
 */
@Component({
	selector: 'app-rate-limit-note',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="flex items-center justify-between gap-3 flex-wrap py-2 px-4 mb-3 rounded-xl text-xs font-bold" role="status" data-testid="rate-limit-note" dir="rtl" style="background:rgba(255,140,105,.10);color:#FF8C69">
			<span data-testid="rate-limit-note-text">{{ text() }}</span>
			@if (showRetry()) {
				<button type="button" (click)="retry.emit()" [disabled]="wait.active()" data-testid="rate-limit-note-btn" style="background:none;border:none;font:inherit;color:inherit;text-decoration:underline;cursor:pointer;opacity:1" [style.opacity]="wait.active() ? .5 : 1">تحديث@if (wait.active()) { <span data-testid="rate-limit-note-wait"> {{ wait.label() }}</span> }</button>
			}
		</div>`,
})
export class RateLimitNoteComponent implements OnInit {
	private readonly waits = inject(WaitTimerService);
	private readonly destroyRef = inject(DestroyRef);
	readonly waitScope = input<string>(LAST_RATE_LIMIT_SCOPE);
	readonly showRetry = input<boolean>(false);
	readonly retry = output<void>();
	wait!: WaitHandle;
	readonly text = computed(() => (this.wait?.active() ? rateLimitSentence(this.wait.remainingSeconds(), true) : RATE_LIMIT_MESSAGE));

	ngOnInit() { this.wait = this.waits.track(this.waitScope(), this.destroyRef); }
}
