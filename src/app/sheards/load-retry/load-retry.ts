import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RATE_LIMIT_MESSAGE } from '../../core/utils/rate-limit.util';

/** Temporary-error notice with a retry button: what a list shows when a load hit a 429 and nothing was loaded yet (never an empty state). */
@Component({
	selector: 'app-load-retry',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="flex flex-col items-center justify-center py-10 px-4 text-center" role="alert" data-testid="load-retry" dir="rtl">
			<div class="text-sm font-bold mb-3">{{ message() }}</div>
			<button type="button" (click)="retry.emit()" data-testid="load-retry-btn"
				class="py-2 px-6 bg-gradient-to-r from-[#2BD4C7] to-[#2B7FFF] rounded-full text-xs font-black text-[#070D24]">إعادة المحاولة</button>
		</div>`,
})
export class LoadRetryComponent {
	readonly message = input<string>(RATE_LIMIT_MESSAGE);
	readonly retry = output<void>();
}
