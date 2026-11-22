import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, defer, filter, finalize, map, of, switchMap, take } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LegalNameView { status: 'MISSING' | 'PROVIDED'; legalName: string | null; changeNeedsReview: boolean; pendingRequest: { id: string; requestedValue: string | null; createdAt: string } | null }
export interface LegalNameSaveResult { outcome: 'SAVED' | 'UNCHANGED' | 'REQUEST_CREATED'; view: LegalNameView }

/** The signed-in user's own LEGAL name (the name on the identity document). Private: shown only to its owner here. Separate from the display name. */
@Injectable({ providedIn: 'root' })
export class LegalNameService {
	private readonly http = inject(HttpClient);
	/** true while a save is in flight: the document check waits for it, so a name typed a moment ago is the one it compares with */
	private readonly saving$ = new BehaviorSubject(false);
	get(): Observable<{ success: boolean; data: LegalNameView }> { return this.http.get<{ success: boolean; data: LegalNameView }>(`${environment.url_api}/legal-name`); }
	/** The name to compare with the identity document: the owner's LEGAL name only. The display name is never a substitute (it is not what the document says): none -> '' (no name comparison). */
	declaredName(): Observable<string> { return this.saving$.pipe(filter(busy => !busy), take(1), switchMap(() => this.get()), map(r => (r?.data?.status === 'PROVIDED' ? r.data.legalName?.trim() ?? '' : '')), catchError(() => of(''))); }
	save(legalName: string): Observable<{ success: boolean; message?: string; data: LegalNameSaveResult }> {
		return defer(() => {
			this.saving$.next(true);
			return this.http.put<{ success: boolean; message?: string; data: LegalNameSaveResult }>(`${environment.url_api}/legal-name`, { legalName }).pipe(finalize(() => this.saving$.next(false)));
		});
	}
	/** The owner withdraws the name-change request that still waits for review (a typo): the current name stays and a new request can be sent. */
	cancelRequest(): Observable<{ success: boolean; message?: string; data: LegalNameView }> {
		return this.http.post<{ success: boolean; message?: string; data: LegalNameView }>(`${environment.url_api}/legal-name/request/cancel`, {});
	}
}
