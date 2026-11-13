import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LegalNameView { status: 'MISSING' | 'PROVIDED'; legalName: string | null; changeNeedsReview: boolean; pendingRequest: { id: string; requestedValue: string | null; createdAt: string } | null }
export interface LegalNameSaveResult { outcome: 'SAVED' | 'UNCHANGED' | 'REQUEST_CREATED'; view: LegalNameView }

/** The signed-in user's own LEGAL name (the name on the identity document). Private: shown only to its owner here. Separate from the display name. */
@Injectable({ providedIn: 'root' })
export class LegalNameService {
	private readonly http = inject(HttpClient);
	get(): Observable<{ success: boolean; data: LegalNameView }> { return this.http.get<{ success: boolean; data: LegalNameView }>(`${environment.url_api}/legal-name`); }
	save(legalName: string): Observable<{ success: boolean; message?: string; data: LegalNameSaveResult }> { return this.http.put<{ success: boolean; message?: string; data: LegalNameSaveResult }>(`${environment.url_api}/legal-name`, { legalName }); }
}
