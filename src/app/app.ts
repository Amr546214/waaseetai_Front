import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationCancellationCode, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthStore } from './core/store/auth.store';
import { ConfirmModalComponent } from './sheards/confirm-modal/confirm-modal.component';
import { NotificationHostComponent } from './shared/forms/notification-host.component';
import { FormA11ySyncService } from './shared/forms/form-a11y-sync.service';
import { AssistantWidgetComponent } from './sheards/assistant-widget/assistant-widget';
import { assistantLiftPx, isAssistantHidden } from './sheards/assistant-widget/assistant-visibility';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, AsyncPipe, NgIf, ConfirmModalComponent, NotificationHostComponent, AssistantWidgetComponent],
	styleUrl: './app.css',
	template: `
		<ng-container *ngIf="authStore.isInitialized$ | async">
			<router-outlet />
		</ng-container>

		<!-- Kept up until the FIRST navigation has ended: after sign-in the area's lazy chunk can take seconds on a cold start and the screen used to be blank meanwhile. -->
		<div *ngIf="showLoader() || !firstRouteDone()" class="global-app-loader" [class.fade-out]="(authStore.isInitialized$ | async) && firstRouteDone()">
			<div class="loader-content">
				<img src="/images/waseet-mark.png" alt="Waseet AI Logo" class="loader-logo" />
				<div class="waseet-spinner"></div>
				<h2 class="loader-text">جاري تهيئة بيئة العمل...</h2>
			</div>
		</div>

		@if (navigating() && firstRouteDone()) {
			<div class="nav-progress" role="progressbar" aria-label="جارٍ التحميل" aria-busy="true"><span></span></div>
		}

		<app-confirm-modal />
		<app-notification-host />

		<!-- The ONE floating assistant (Bebo) for the whole site: signed-in users get the
		     full assistant, visitors get the robot + a login prompt, and routes flagged
		     data.hideAssistant (auth, errors) get nothing. Mounted nowhere else.
		     Lazy-loaded after the page is idle; browser-only. -->
		@if ((authStore.isInitialized$ | async) && !assistantHidden()) {
			@defer (on idle) {
				<app-assistant-widget [lift]="assistantLift()" />
			}
		}
	`,
})
export class App implements OnInit {
	authStore = inject(AuthStore);
	showLoader = signal(true);
	/** A navigation is in progress (guards running or a lazy chunk loading). */
	readonly navigating = signal(false);
	/** The first navigation has ended: from then on the page itself is on screen. */
	readonly firstRouteDone = signal(false);
	private readonly router = inject(Router);
	/** True on routes that opt out of the floating assistant (`data.hideAssistant`). */
	readonly assistantHidden = signal(false);
	/** Extra px the assistant floats above the viewport floor on pages with a bottom action bar. */
	readonly assistantLift = signal(0);

	constructor() {
		// aria-invalid / aria-describedby for every invalid form control, site wide (browser only).
		if (typeof document !== 'undefined') inject(FormA11ySyncService).start(document);
		this.router.events
			.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
			.subscribe(() => this.syncAssistantRoute());
		this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((e) => {
			if (e instanceof NavigationStart) this.navigating.set(true);
			// A redirect (guard returned a UrlTree) is followed by a new NavigationStart: the loader stays up through it.
			else if (e instanceof NavigationCancel && e.code === NavigationCancellationCode.Redirect) return;
			else if (e instanceof NavigationEnd || e instanceof NavigationCancel || e instanceof NavigationError || e instanceof NavigationSkipped) {
				this.navigating.set(false);
				this.firstRouteDone.set(true);
			}
		});
	}

	ngOnInit() {
		this.syncAssistantRoute();
		this.authStore.isInitialized$.subscribe(isInit => {
			if (isInit) {
				// Wait 500ms for the CSS fade-out transition to complete before removing from DOM
				setTimeout(() => {
					this.showLoader.set(false);
				}, 500);
			}
		});
	}

	private syncAssistantRoute(): void {
		const root = this.router.routerState.snapshot.root;
		this.assistantHidden.set(isAssistantHidden(root));
		this.assistantLift.set(assistantLiftPx(root));
	}
}
