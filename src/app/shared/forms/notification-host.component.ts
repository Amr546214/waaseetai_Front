import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiNotification, UiNotificationService } from '../../core/services/ui-notification.service';

const TONE: Record<UiNotification['kind'], string> = {
	success: 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950 dark:text-emerald-100',
	info: 'border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950 dark:text-sky-100',
	warning: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100',
	error: 'border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950 dark:text-red-100',
};

/** Renders UiNotificationService: one sticky banner on top, a toast stack at the bottom. Mounted once in the app root. */
@Component({
	selector: 'app-notification-host',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (service.banner(); as b) {
			<div class="fixed inset-x-3 top-3 z-[1200] mx-auto max-w-xl" data-testid="ui-banner">
				<div [attr.role]="b.kind === 'error' || b.kind === 'warning' ? 'alert' : 'status'"
					class="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg" [class]="tone(b.kind)">
					<div class="grow leading-relaxed">
						@if (b.title) { <div class="font-bold">{{ b.title }}</div> }
						<div>{{ b.message }}</div>
					</div>
					<button type="button" class="shrink-0 rounded-lg px-2 text-lg leading-none opacity-70 hover:opacity-100"
						aria-label="إغلاق" (click)="service.dismissBanner(b.id)">×</button>
				</div>
			</div>
		}

		<div class="pointer-events-none fixed inset-x-3 bottom-4 z-[1200] mx-auto flex max-w-md flex-col gap-2" aria-live="polite">
			@for (t of service.toasts(); track t.id) {
				<div [attr.role]="t.kind === 'error' || t.kind === 'warning' ? 'alert' : 'status'" data-testid="ui-toast"
					class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg" [class]="tone(t.kind)">
					<div class="grow leading-relaxed">
						@if (t.title) { <div class="font-bold">{{ t.title }}</div> }
						<div>{{ t.message }}</div>
					</div>
					<button type="button" class="shrink-0 rounded-lg px-2 text-lg leading-none opacity-70 hover:opacity-100"
						aria-label="إغلاق" (click)="service.dismiss(t.id)">×</button>
				</div>
			}
		</div>
	`,
})
export class NotificationHostComponent {
	protected readonly service = inject(UiNotificationService);
	protected tone(kind: UiNotification['kind']): string { return TONE[kind]; }
}
