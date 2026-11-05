import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export type IdentityParty = 'CLIENT' | 'PROVIDER';
export type IdentityCheckState = 'NOT_CHECKED' | 'QUEUED' | 'RUNNING' | 'DONE' | 'UNAVAILABLE' | 'SKIPPED';
export type IdentityFieldStatus = 'MATCH' | 'MISMATCH' | 'COULD_NOT_VERIFY';
export interface IdentityFieldResult { status: IdentityFieldStatus; reason?: string | null }
export interface IdentityCheckFields { fullName: IdentityFieldResult; birthDate: IdentityFieldResult; nationalId: IdentityFieldResult }

/** Admin read model of the automatic ID field check. ADVISORY only: it never approves or rejects anything. */
export interface IdentityCheckAdmin {
	userId: string;
	party: IdentityParty;
	autoCheckEnabled: boolean;
	state: IdentityCheckState;
	stateReason: string | null;
	manualReviewRequired: boolean;
	advisory: boolean;
	imageVersion: { version: number; digest: string; submittedAt: string } | null;
	stale: boolean;
	startedAt: string | null;
	checkedAt: string | null;
	model: { name: string; version: string } | null;
	fields: IdentityCheckFields | null;
	notExamined: { faceMatch: string; liveness: string; documentAuthenticity: string };
}

@Injectable({ providedIn: 'root' })
export class IdentityCheckService {
	private http = inject(HttpClient);
	private base = environment.url_api;

	/** Needs the `identity.review` admin permission; anyone else gets 403. */
	getAdminCheck(userId: string, party: IdentityParty): Observable<IdentityCheckAdmin> {
		return this.http
			.get<{ success: boolean; data: IdentityCheckAdmin }>(`${this.base}/admin/onboarding/identity-check/${encodeURIComponent(userId)}`, { params: new HttpParams().set('party', party) })
			.pipe(map((r) => r.data));
	}

	/** Owner-facing and neutral: only «IN_REVIEW» or «NONE», never a field result. */
	getMyState(party: IdentityParty): Observable<'IN_REVIEW' | 'NONE'> {
		return this.http
			.get<{ success: boolean; data: { state: 'IN_REVIEW' | 'NONE' } }>(`${this.base}/identity-check/me`, { params: new HttpParams().set('party', party) })
			.pipe(map((r) => r.data.state));
	}
}
