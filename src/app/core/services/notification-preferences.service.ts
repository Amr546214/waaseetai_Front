import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NotificationPreferencesResponse {
	success: boolean;
	/** `platform.emailEnabled === false`: the platform switched OPTIONAL e-mail off (platform setting `channelEmail`); the stored choice is kept, the option cannot be changed */
	data?: { settings: Record<string, boolean>; platform?: { emailEnabled?: boolean } };
	message?: string;
}

/** The exact wording shown next to the e-mail option while the platform has optional e-mail switched off. */
export const EMAIL_DISABLED_BY_PLATFORM = 'معطّل بواسطة إدارة المنصة';
/** Explains why login / activation / reset mail still arrives when the option is off or disabled. */
export const CODE_MAIL_ALWAYS_NOTE = 'إيصالات العمليات ودعوات العقود ورموز الدخول والتفعيل والاستعادة تصل دائمًا على بريدك، فهي رسائل مطلوبة لإتمام العمليات ولا يغيّرها هذا الخيار.';
/** The stable server code of the 409 sent when the option is switched ON while the platform has it OFF. */
export const EMAIL_DISABLED_CODE = 'EMAIL_CHANNEL_DISABLED_BY_PLATFORM';
/** true only when the server SAID the platform switched optional e-mail off (an old / missing field keeps today's behaviour: editable). */
export const emailDisabledByPlatform = (res: { data?: { platform?: { emailEnabled?: boolean } } } | null | undefined): boolean => res?.data?.platform?.emailEnabled === false;
export const isEmailDisabledError = (err: unknown): boolean => (err as { error?: { code?: string } } | null)?.error?.code === EMAIL_DISABLED_CODE;

// Shared across every role (client/provider/marketer) — GET returns the
// full stored map, PATCH merges a partial map server-side without wiping
// keys another role's page owns. See backend NotificationPreference model
// doc comment (schema.prisma) for the full rationale.
@Injectable({ providedIn: 'root' })
export class NotificationPreferencesService {
	private http = inject(HttpClient);
	private apiUrl = `${environment.url_api}/notifications/preferences`;

	getPreferences(): Observable<NotificationPreferencesResponse> {
		return this.http.get<NotificationPreferencesResponse>(this.apiUrl);
	}

	updatePreferences(settings: Record<string, boolean>): Observable<NotificationPreferencesResponse> {
		return this.http.patch<NotificationPreferencesResponse>(this.apiUrl, { settings });
	}
}
