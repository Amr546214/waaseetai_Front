import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LevelRole } from './level-colors';

export interface LevelIdentityRow {
	role: LevelRole; level: number; name: string; defaultName: string;
	color: { dark: string; light: string }; defaultColor: { dark: string; light: string };
	overridden: { name: boolean; dark: boolean; light: boolean };
}
export interface LevelIdentityView { version: number; nameMax: number; rows: LevelIdentityRow[] }
/** `null` = back to the default of that field */
export interface LevelIdentityChange { role: LevelRole; level: number; name?: string | null; dark?: string | null; light?: string | null }
export interface LevelIdentityEnvelope<T> { success: boolean; data: T; message?: string }

/** «هوية المستويات والشارات»: the name and the colour of each level, saved on the server for every user (GET / PUT /admin/level-identity). */
@Injectable({ providedIn: 'root' })
export class LevelIdentityAdminApi {
	private readonly http = inject(HttpClient);
	private readonly base = () => `${environment.url_api}/admin/level-identity`;
	view(): Observable<LevelIdentityEnvelope<LevelIdentityView>> { return this.http.get<LevelIdentityEnvelope<LevelIdentityView>>(this.base()); }
	save(expectedVersion: number, changes: LevelIdentityChange[]): Observable<LevelIdentityEnvelope<LevelIdentityView>> { return this.http.put<LevelIdentityEnvelope<LevelIdentityView>>(this.base(), { expectedVersion, changes }); }
}
