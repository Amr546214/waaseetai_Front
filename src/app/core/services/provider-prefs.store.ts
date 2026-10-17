import { Injectable, inject, signal } from '@angular/core';
import { ProfileApiService } from './profile-api.service';
import { AuthStore } from '../store/auth.store';
import { UserRole } from '../models/auth.model';

/** The IANA zones the provider can pick (same list as PUT /provider/profile/preferences). */
export const PROVIDER_TIMEZONES = ['Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Africa/Cairo', 'Asia/Amman', 'GMT'] as const;

/** DatePipe takes an offset ("+0300"), not an IANA name: the offset the zone has right now. */
export function timezoneOffset(zone: string, at: Date = new Date()): string | undefined {
	try {
		const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? '';
		const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
		return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : '+0000';
	} catch { return undefined; }
}

let activeZone: string | undefined;
/** The provider's saved IANA zone for hand-formatted dates (Intl `timeZone`); undefined = the browser's own zone. */
export const providerTimeZone = (): string | undefined => activeZone;

/** The provider's saved display preferences; the timezone drives every date the provider area shows through DatePipe (see app.routes.ts). */
@Injectable({ providedIn: 'root' })
export class ProviderPrefsStore {
	private api = inject(ProfileApiService);
	private auth = inject(AuthStore);
	timezone = signal<string | null>(null);

	/** Sets the zone for both DatePipe (via the signal) and hand-formatted dates (via providerTimeZone()). */
	setTimezone(zone: string | null) {
		activeZone = zone || undefined;
		this.timezone.set(zone);
	}
	private loaded = false;

	/** Offset for DatePipe, or undefined (= the browser's own zone) until a zone was saved. */
	get dateOffset(): string | undefined {
		const z = this.timezone();
		return z ? timezoneOffset(z) : undefined;
	}

	ensureLoaded() {
		if (this.loaded) return;
		// The route's environment initializer runs when /provider-overview is entered, BEFORE any guard: a client (or marketer / admin) opening that URL would call
		// the provider-only endpoint and get a 403. Only a user ACTING as a provider reads the provider preferences.
		if (this.auth.actingRole() !== UserRole.PROVIDER) return;
		this.loaded = true;
		this.api.getProviderProfileSetup().subscribe({
			next: (res: any) => { const tz = res?.data?.preferences?.timezone; if (typeof tz === 'string' && tz) this.setTimezone(tz); },
			error: () => { this.loaded = false; }
		});
	}
}
