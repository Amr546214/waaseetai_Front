import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AsyncPipe, NgIf } from '@angular/common';
import { AuthStore } from './core/store/auth.store';
import { ConfirmModalComponent } from './sheards/confirm-modal/confirm-modal.component';

@Component({
	selector: 'app-root',
	standalone: true,
	imports: [RouterOutlet, AsyncPipe, NgIf, ConfirmModalComponent],
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
	`,
})
export class App implements OnInit {
	authStore = inject(AuthStore);
	showLoader = signal(true);

	ngOnInit() {
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
