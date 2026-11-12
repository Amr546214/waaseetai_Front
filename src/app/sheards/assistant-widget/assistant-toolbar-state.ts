import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AssistantStore } from '../../core/store/assistant.store';
import { AuthStore } from '../../core/store/auth.store';

export type AssistantPanelTab = 'chat' | 'motions' | 'settings' | 'tour';
export const TOOLBAR_COLLAPSED_PREF_KEY = 'waseet_assistant_toolbar_collapsed';

/**
 * What Bebo's tool bar shows and does, in ONE place, so the same tools work wherever the bar is drawn: floating next to the robot (public pages) or inside the
 * dashboard's «بيبو» tab. The robot, its quick composer and its panel stay in the floating widget; the bar only drives them through this state and the assistant store.
 */
@Injectable({ providedIn: 'root' })
export class AssistantToolbarState {
	readonly store = inject(AssistantStore);
	private readonly router = inject(Router);
	private readonly authStore = inject(AuthStore);
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	/** the quick composer (input line above the bar) is open */
	readonly expanded = signal(false);
	readonly panelTab = signal<AssistantPanelTab>('chat');
	readonly toolbarCollapsed = signal(false);
	readonly bubbleDismissed = signal(false);
	/** bumps whenever a tool opens / closes a panel tab, so the widget can close its own tab menu */
	readonly tabActionTick = signal(0);
	readonly isGuest = computed(() => !this.authStore.token());
	readonly characterName = computed(() => this.store.characterName());
	readonly characterFullName = computed(() => this.store.characterFullName());

	constructor() {
		if (this.isBrowser) {
			// No saved choice: small screens start with the compact pill so the bar never covers the page's bottom actions.
			let saved: string | null = null;
			try { saved = localStorage.getItem(TOOLBAR_COLLAPSED_PREF_KEY); } catch { /* storage unavailable */ }
			this.toolbarCollapsed.set(saved === null ? typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 640px)').matches : saved === '1');
		}
	}

	openChatPage(): void { this.store.panelOpen.set(false); void this.router.navigateByUrl('/assistant'); }

	openTab(tab: AssistantPanelTab): void {
		this.tabActionTick.update(n => n + 1);
		if (this.store.panelOpen() && this.panelTab() === tab) {
			this.store.close();
		} else {
			this.panelTab.set(tab);
			this.expanded.set(false);
			if (!this.store.panelOpen()) this.store.open();
		}
	}

	toggleComposerOrChat(): void {
		if (this.isGuest()) { this.openTab('chat'); return; }
		if (this.store.panelOpen()) this.store.close();
		else this.expanded.update(v => !v);
	}

	toggleListening(): void {
		if (this.isGuest()) { this.openTab('chat'); return; }
		this.store.toggleListening();
	}

	toggleToolbar(): void {
		this.toolbarCollapsed.update(collapsed => !collapsed);
		if (this.isBrowser) {
			try { localStorage.setItem(TOOLBAR_COLLAPSED_PREF_KEY, this.toolbarCollapsed() ? '1' : '0'); } catch { /* storage unavailable */ }
		}
	}

	dismissAssistant(): void {
		this.store.dismiss();
		this.expanded.set(false);
		this.bubbleDismissed.set(true);
	}
}
