import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthStore } from './core/store/auth.store';
import { ConfirmModalComponent } from './sheards/confirm-modal/confirm-modal.component';
import { AssistantWidgetComponent } from './sheards/assistant-widget/assistant-widget';
import { isAssistantHidden } from './sheards/assistant-widget/assistant-visibility';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, AsyncPipe, NgIf, ConfirmModalComponent, AssistantWidgetComponent],
	styleUrl: './app.css',
	template: `
		<ng-container *ngIf="authStore.isInitialized$ | async">
			<router-outlet />
		</ng-container>

		<div *ngIf="showLoader()" class="global-app-loader" [class.fade-out]="authStore.isInitialized$ | async">
			<div class="loader-content">
				<img src="/images/waseet-mark.png" alt="Waseet AI Logo" class="loader-logo" />
				<div class="waseet-spinner"></div>
				<h2 class="loader-text">جاري تهيئة بيئة العمل...</h2>
			</div>
		</div>

		<app-confirm-modal />

		<!-- The ONE floating assistant (Bebo) for the whole site: signed-in users get the
		     full assistant, visitors get the robot + a login prompt, and routes flagged
		     data.hideAssistant (auth, errors) get nothing. Mounted nowhere else.
		     Lazy-loaded after the page is idle; browser-only. -->
		@if ((authStore.isInitialized$ | async) && !assistantHidden()) {
			@defer (on idle) {
				<app-assistant-widget />
			}
		}
	`,
})
export class App implements OnInit {
	authStore = inject(AuthStore);
	showLoader = signal(true);
	private readonly router = inject(Router);
	/** True on routes that opt out of the floating assistant (`data.hideAssistant`). */
	readonly assistantHidden = signal(false);

	constructor() {
		this.router.events
			.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
			.subscribe(() => this.assistantHidden.set(isAssistantHidden(this.router.routerState.snapshot.root)));
	}

	ngOnInit() {
		this.assistantHidden.set(isAssistantHidden(this.router.routerState.snapshot.root));
		this.authStore.isInitialized$.subscribe(isInit => {
			if (isInit) {
				// Wait 500ms for the CSS fade-out transition to complete before removing from DOM
				setTimeout(() => {
					this.showLoader.set(false);
				}, 500);
			}
		});
	}
}
