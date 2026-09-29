import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NotificationPreferencesResponse {
	success: boolean;
	data?: { settings: Record<string, boolean> };
	message?: string;
}

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
