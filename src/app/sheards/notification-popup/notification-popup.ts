import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { NotificationEngineService } from '../../core/services/notification-engine.service';
import { NotificationNavigator } from '../../core/services/notification-navigator.service';
import { normalizeLegacyNotificationUrl } from '../../core/routing/notification-links';

/**
 * The real-time notification popup (one component for the public navbar and the dashboard top bar).
 * Showing it, its timer ending, or closing it with × never reads the notification: only the "الانتقال" button does,
 * through NotificationNavigator, and only after the page really opened.
 */
@Component({
	selector: 'app-notification-popup',
	standalone: true,
	imports: [NgClass],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (engine.showToast() && n(); as nt) {
			<div class="np" dir="rtl" role="status" aria-live="polite" data-testid="notification-popup">
				<div class="np-ico" [ngClass]="nt.iconBgClass + ' ' + nt.iconColorClass" [innerHTML]="nt.svgIcon" aria-hidden="true"></div>
				<div class="np-body">
					<div class="np-title">{{ nt.title }}</div>
					<div class="np-msg">{{ nt.message }}</div>
					@if (nt.actionUrl) {
						<button type="button" class="np-go" data-testid="notification-popup-go" (click)="go()">
							<span>الانتقال</span>
							<svg data-ws-icon="pl-shared-chevron-left" class="np-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>
						</button>
					}
				</div>
				<button type="button" class="np-x" data-testid="notification-popup-close" aria-label="إغلاق الإشعار" (click)="engine.closeToast()">
					<svg data-ws-icon="pl-shared-x" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
				</button>
			</div>
		}
	`,
	styles: [`
		:host { display: contents; }
		.np {
			position: fixed; z-index: var(--ws-popup-z, 2147482000);
			top: var(--ws-toast-top, 76px); inset-inline-end: 24px;
			width: 400px; max-width: calc(100vw - 24px); box-sizing: border-box;
			display: flex; align-items: flex-start; gap: 14px;
			padding: 16px 16px 16px 14px;
			background: var(--surface-solid, #0b1437); color: var(--txt, #fff);
			border: 1px solid rgba(var(--teal-rgb, 43, 212, 199), .45); border-radius: 16px;
			box-shadow: 0 12px 32px rgba(0, 0, 0, .35); animation: np-in .22s ease-out;
		}
		.np-ico { flex: none; width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
		.np-ico :is(svg) { width: 22px; height: 22px; }
		.np-body { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
		.np-title { font-size: 15px; font-weight: 800; line-height: 1.5; overflow-wrap: anywhere; padding-inline-end: 4px; }
		.np-msg { font-size: 14px; line-height: 1.7; color: var(--txt-2, #a8b2d1); overflow-wrap: anywhere; white-space: pre-line;
			display: -webkit-box; -webkit-line-clamp: 5; line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
		.np-go {
			margin-top: 6px; align-self: stretch; min-height: 44px; padding: 0 16px;
			display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
			font: inherit; font-size: 14px; font-weight: 700; cursor: pointer;
			color: var(--teal-txt, #2bd4c7); background: rgba(var(--teal-rgb, 43, 212, 199), .12);
			border: 1px solid rgba(var(--teal-rgb, 43, 212, 199), .4); border-radius: 12px;
		}
		.np-go:hover { background: rgba(var(--teal-rgb, 43, 212, 199), .2); }
		.np-arrow, .np-x svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
		.np-x { flex: none; width: 36px; height: 36px; margin: -6px -6px 0 -6px; display: inline-flex; align-items: center; justify-content: center;
			background: transparent; border: 0; border-radius: 10px; cursor: pointer; color: var(--txt-3, #6b7699); }
		.np-x:hover { color: var(--txt, #fff); background: rgba(128, 128, 128, .16); }
		.np-go:focus-visible, .np-x:focus-visible { outline: 2px solid var(--teal, #2bd4c7); outline-offset: 2px; }
		@media (max-width: 640px) { .np { inset-inline: 12px; width: auto; max-width: none; padding: 14px; gap: 12px; } .np-ico { width: 40px; height: 40px; } }
		@keyframes np-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
		@media (prefers-reduced-motion: reduce) { .np { animation: none; } }
	`],
})
export class NotificationPopupComponent {
	protected readonly engine = inject(NotificationEngineService);
	private readonly navigator = inject(NotificationNavigator);

	/** Same mapping the bell uses: its icon per type and the current stored link normalized. */
	protected readonly n = computed(() => {
		const raw = this.engine.latestNotification();
		if (!raw) return null;
		const mapped = this.engine.mapToAppNotification({ ...raw, actionUrl: normalizeLegacyNotificationUrl(raw.actionUrl) });
		return { ...mapped, actionUrl: raw.actionUrl ? normalizeLegacyNotificationUrl(raw.actionUrl) : mapped.actionUrl, id: raw.id ?? '' };
	});

	protected go(): void {
		const nt = this.n();
		if (!nt) return;
		this.engine.closeToast(); // hides only; the row stays unread until the navigation below succeeds
		void this.navigator.open(
			{ id: nt.id, isUnread: !!nt.id, actionUrl: nt.actionUrl },
			{ onMarkedRead: () => this.engine.onPopupMarkedRead(nt.id) },
		);
	}
}
