import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A failed LOAD is not an empty list: this block says what could not be loaded and why (the honest text of the failure), that the data is NOT gone,
 * and offers a retry. Pages hide their "nothing here yet" state while it is shown.
 */
@Component({
	selector: 'app-load-error',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div role="alert" data-testid="load-error" class="ws-note ws-note--warn" style="margin:0 0 16px">
			<div class="ws-note-body">
				<div class="ws-note-txt" data-testid="load-error-text">تعذّر تحميل {{ what() }}. {{ message() }} هذا لا يعني أنه لا توجد بيانات؛ لم يصلنا ردّ سليم من الخادم.</div>
				<button type="button" class="ws-btn" data-testid="load-error-retry" style="margin-top:8px;font-weight:700;text-decoration:underline;background:none;border:0;cursor:pointer;color:inherit" (click)="retry.emit()">إعادة المحاولة</button>
			</div>
		</div>
	`
})
export class LoadError {
	what = input.required<string>();
	message = input<string>('');
	retry = output<void>();
}
