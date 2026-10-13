import { Injectable, inject, signal } from '@angular/core';
import { ProfileApiService } from './profile-api.service';

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

/** The provider's saved display preferences; the timezone drives every date the provider area shows through DatePipe (see app.routes.ts). */
@Injectable({ providedIn: 'root' })
export class ProviderPrefsStore {
	private api = inject(ProfileApiService);
	timezone = signal<string | null>(null);
	private loaded = false;

	/** Offset for DatePipe, or undefined (= the browser's own zone) until a zone was saved. */
	get dateOffset(): string | undefined {
		const z = this.timezone();
		return z ? timezoneOffset(z) : undefined;
	}

	ensureLoaded() {
		if (this.loaded) return;
		this.loaded = true;
		this.api.getProviderProfileSetup().subscribe({
			next: (res: any) => { const tz = res?.data?.preferences?.timezone; if (typeof tz === 'string' && tz) this.timezone.set(tz); },
			error: () => { this.loaded = false; }
		});
	}
}
