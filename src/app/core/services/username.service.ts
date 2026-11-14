import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UsernameView { username: string | null; displayName: string }
/** The signed-in user's username: the name shown on the platform. Separate from the legal name. */
@Injectable({ providedIn: 'root' })
export class UsernameService {
	private readonly http = inject(HttpClient);
	get(): Observable<{ success: boolean; data: UsernameView }> { return this.http.get<{ success: boolean; data: UsernameView }>(`${environment.url_api}/username`); }
	save(username: string): Observable<{ success: boolean; message?: string; data: UsernameView & { changed: boolean } }> { return this.http.put<{ success: boolean; message?: string; data: UsernameView & { changed: boolean } }>(`${environment.url_api}/username`, { username }); }
}
