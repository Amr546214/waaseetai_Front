import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output } from '@angular/core';
import { RATE_LIMIT_MESSAGE } from '../../core/utils/rate-limit.util';
import { LAST_RATE_LIMIT_SCOPE, WaitHandle, WaitTimerService } from '../../core/wait/wait-timer.service';
import { rateLimitSentence } from '../../core/wait/wait-format';

/**
 * Temporary-error notice with a retry button: what a list shows when a load hit a 429 and nothing was loaded yet (never an empty state).
 * While the server's wait runs (the end timestamp the rate-limit interceptor stored for the failed request) the button is disabled and shows «بعد m:ss»;
 * at zero it is enabled again but NOTHING is retried by itself. `waitScope` picks the endpoint (httpWaitScope(method, url)); by default the latest 429.
 */
@Component({
	selector: 'app-load-retry',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="flex flex-col items-center justify-center py-10 px-4 text-center" role="alert" data-testid="load-retry" dir="rtl">
			<div class="text-sm font-bold mb-3" data-testid="load-retry-msg">{{ text() }}</div>
			<button type="button" (click)="retry.emit()" data-testid="load-retry-btn" [disabled]="wait.active()"
				class="py-2 px-6 bg-gradient-to-r from-[#2BD4C7] to-[#2B7FFF] rounded-full text-xs font-black text-[#070D24] disabled:opacity-50">إعادة المحاولة@if (wait.active()) { <span data-testid="load-retry-wait"> {{ wait.label() }}</span> }</button>
		</div>`,
})
export class LoadRetryComponent implements OnInit {
	private readonly waits = inject(WaitTimerService);
	private readonly destroyRef = inject(DestroyRef);
	readonly message = input<string>(RATE_LIMIT_MESSAGE);
	/** httpWaitScope(method, url) of the failed request; omitted = the latest rate-limited GET. */
	readonly waitScope = input<string>(LAST_RATE_LIMIT_SCOPE);
	readonly retry = output<void>();
	wait!: WaitHandle;
	readonly text = computed(() => (this.wait?.active() ? rateLimitSentence(this.wait.remainingSeconds(), true) : this.message()));

	ngOnInit() { this.wait = this.waits.track(this.waitScope(), this.destroyRef); }
}
