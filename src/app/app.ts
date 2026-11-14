import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthStore } from './core/store/auth.store';
import { AssistantExamState } from './core/store/assistant-exam-state.service';
import { ConfirmModalComponent } from './sheards/confirm-modal/confirm-modal.component';
import { NotificationHostComponent } from './shared/forms/notification-host.component';
import { FormA11ySyncService } from './shared/forms/form-a11y-sync.service';
import { AssistantWidgetComponent } from './sheards/assistant-widget/assistant-widget';
import { PlatformBannerComponent } from './shared/platform-banner/platform-banner.component';
import { assistantLiftPx, isAssistantHidden, isAssistantToolbarInSidebar } from './sheards/assistant-widget/assistant-visibility';
import { UnderDeploymentComponent } from './shared/under-deployment/under-deployment.component';
import { PlatformInfoService } from './core/services/platform-info.service';
import { PlatformStateService } from './core/services/platform-state.service';
import { IdentityImgDirective } from './core/identity/identity-img.directive';

export const maintenanceAuthPath = (url: string) => ['/auth/login','/auth/verify-otp','/auth/forget-password','/auth/google','/auth/google/callback'].includes(url.split(/[?#]/)[0].replace(/\/$/, ''));

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [IdentityImgDirective, RouterOutlet, AsyncPipe, NgIf, ConfirmModalComponent, NotificationHostComponent, AssistantWidgetComponent, PlatformBannerComponent, UnderDeploymentComponent],
	styleUrl: './app.css',
	template: `
		<!-- Maintenance: the standalone Under Deployment page REPLACES the site (no navbar, no menus, no assistant behind it). A Super Admin and the login page itself pass. -->
		@if (maintenanceBlocked()) { <app-under-deployment /> }
        <div [hidden]="maintenanceBlocked()">
          <ng-container *ngIf="authStore.isInitialized$ | async"><router-outlet /></ng-container>
        </div>

		<div *ngIf="showLoader()" class="global-app-loader" [class.fade-out]="authStore.isInitialized$ | async">
			<div class="loader-content">
				<img [wsIdentityImg]="'logo.boot'" src="/assets/brand/waseet-mark.png" alt="Waseet AI Logo" class="loader-logo" />
				<div class="waseet-spinner"></div>
				<h2 class="loader-text">جاري تهيئة بيئة العمل...</h2>
			</div>
		</div>

		<app-confirm-modal />
		<app-notification-host />

		<!-- The ONE floating assistant (Bebo) for the whole site: signed-in users get the
		     full assistant, visitors get the robot + a login prompt, and routes flagged
		     data.hideAssistant (auth, errors) get nothing. Mounted nowhere else.
		     Lazy-loaded after the page is idle; browser-only. -->
		@if ((authStore.isInitialized$ | async) && !assistantHidden() && !maintenanceBlocked()) {
			@defer (on idle) {
				<app-assistant-widget [lift]="assistantLift()" [hideToolbar]="assistantToolbarInSidebar()" />
			}
		}
	`,
})
export class App implements OnInit {
	authStore = inject(AuthStore);
	private readonly assistantStore = inject(AssistantExamState);
	private readonly destroyRef = inject(DestroyRef);
	private readonly platformInfo = inject(PlatformInfoService);
	private readonly platformState = inject(PlatformStateService);
	private readonly url = signal('');
	/** maintenance is on AND this visitor may not pass: not a Super Admin, and not on the login page (the only way to reach the admin entry) */
	readonly maintenanceBlocked = computed(() => this.platformInfo.maintenance() !== null && String(this.authStore.currentUser()?.accountType) !== 'SUPER_ADMIN' && !maintenanceAuthPath(this.url()));
	showLoader = signal(true);
	private readonly router = inject(Router);
	private readonly routeHidden = signal(false);
	/** True on routes that opt out of the floating assistant (`data.hideAssistant`) or during active exams. */
	readonly assistantHidden = computed(() => (typeof window !== 'undefined' && window.parent !== window && new URL(window.location.href).searchParams.has('cmsPreview')) || this.routeHidden() || this.assistantStore.examActive());
	/** Extra px the assistant floats above the viewport floor on pages with a bottom action bar. */
	readonly assistantLift = signal(0);
	/** In dashboards Bebo's tool bar is the «بيبو» sidebar tab, so the widget does not float it. */
	readonly assistantToolbarInSidebar = signal(false);

	constructor() {
		// aria-invalid / aria-describedby for every invalid form control, site wide (browser only).
		if (typeof document !== 'undefined') {
			const a11ySync = inject(FormA11ySyncService);
			a11ySync.start(document);
			// the observer lives as long as the app does: when the root component is destroyed (a test tearing down) it stops, so it cannot leak onto the shared document of later specs
			inject(DestroyRef).onDestroy(() => a11ySync.stop());
		}
		this.router.events
			.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
			.subscribe(() => { this.url.set(this.router.url); this.syncAssistantRoute(); });
	}

	ngOnInit() {
		this.url.set(this.router.url);
		this.platformState.start(this.destroyRef);
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
		this.routeHidden.set(isAssistantHidden(root));
		this.assistantLift.set(assistantLiftPx(root));
		this.assistantToolbarInSidebar.set(isAssistantToolbarInSidebar(root));
	}
}
