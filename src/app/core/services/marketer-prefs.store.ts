import { Injectable, inject, signal } from '@angular/core';
import { CanActivateChildFn } from '@angular/router';
import { MarketerOverviewService, MarketerSettings } from './marketer-overview.service';
import { ProviderPrefsStore } from './provider-prefs.store';

/**
 * The marketer's saved display settings. The timezone feeds the SAME app-wide date formatting the provider area uses (the default date-pipe options + providerTimeZone()),
 * so every date in the marketer area follows it. A marketer with no saved timezone keeps the browser's own zone; a saved one is applied when the marketer area opens
 * (an account that is both marketer and provider shares the one formatter, so the zone of the side being used wins).
 */
@Injectable({ providedIn: 'root' })
export class MarketerPrefsStore {
	private api = inject(MarketerOverviewService);
	private dates = inject(ProviderPrefsStore);
	settings = signal<MarketerSettings | null>(null);
	private loaded = false;

	/** Applies a settings snapshot (after a load or a save). */
	apply(s: MarketerSettings) {
		this.settings.set(s);
		if (s.timezone) { this.dates.setTimezone(s.timezone); this.applied = true; }
		else if (this.applied) { this.dates.setTimezone(null); this.applied = false; } // "حسب جهازي": back to the browser's zone
	}
	private applied = false;

	ensureLoaded() {
		if (this.loaded) return;
		this.loaded = true;
		this.api.getSettings().subscribe({
			next: (res) => { if (res.success && res.data) this.apply(res.data); },
			error: () => { this.loaded = false; }
		});
	}
}

/** Loads the marketer's settings (timezone) once when any marketer page opens; never blocks navigation. */
export const marketerPrefsGuard: CanActivateChildFn = () => {
	inject(MarketerPrefsStore).ensureLoaded();
	return true;
};
