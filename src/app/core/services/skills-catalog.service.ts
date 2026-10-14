import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SkillsCatalogResponse { success: boolean; data: { category: string | null; skills: string[] } }
export interface SkillsCatalogCategory { slug: string; nameAr: string; skills: string[] }
export interface SkillsCatalogAllResponse { success: boolean; data: { categories: SkillsCatalogCategory[] } }
export interface ProviderMineSpecialty { specialtyId: string; slug: string; nameAr: string; categorySlug: string; subSpecialties: string[] }
export interface ProviderMineResponse {
	success: boolean;
	data: { skills: string[]; mainSpecialty: string | null; subSpecialties: string[]; specialties: ProviderMineSpecialty[] };
}

/**
 * The ONE source of skills in the app: the backend skills catalog (per marketplace category) and the provider's own saved
 * skills / specialties. Every skills UI (profile, marketplace wizard, request form, add-account) reads through here so the
 * names are identical everywhere. Catalog reads are cached per category for the session; failures are not cached.
 */
@Injectable({ providedIn: 'root' })
export class SkillsCatalogService {
	private readonly http = inject(HttpClient);
	private readonly base = `${environment.url_api}/skills`;
	private readonly byCategory = new Map<string, Observable<SkillsCatalogResponse>>();
	private all$: Observable<SkillsCatalogAllResponse> | null = null;

	/** Skills of one category (slug, id or Arabic name). Cached per category. */
	getCatalog(category: string): Observable<SkillsCatalogResponse> {
		const key = (category || '').trim();
		let cached = this.byCategory.get(key);
		if (!cached) {
			cached = this.http.get<SkillsCatalogResponse>(`${this.base}/catalog`, { params: { category: key } }).pipe(
				catchError(err => { this.byCategory.delete(key); return throwError(() => err); }),
				shareReplay({ bufferSize: 1, refCount: false })
			);
			this.byCategory.set(key, cached);
		}
		return cached;
	}

	/** Every category with its skills. Cached. */
	getAll(): Observable<SkillsCatalogAllResponse> {
		if (!this.all$) {
			this.all$ = this.http.get<SkillsCatalogAllResponse>(`${this.base}/catalog/all`).pipe(
				catchError(err => { this.all$ = null; return throwError(() => err); }),
				shareReplay({ bufferSize: 1, refCount: false })
			);
		}
		return this.all$;
	}

	/** The signed-in provider's saved skills and specialties (not cached: it changes when the provider edits the profile). */
	getProviderMine(): Observable<ProviderMineResponse> {
		return this.http.get<ProviderMineResponse>(`${this.base}/provider-mine`);
	}

	clearCache(): void { this.byCategory.clear(); this.all$ = null; }
}
