import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export type MarketingAssetKind = 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LINK' | 'TEXT';

export interface MarketingAsset {
	id: string;
	title: string;
	description: string | null;
	kind: MarketingAssetKind;
	fileUrl: string | null;
	fileName: string | null;
	mimeType: string | null;
	fileBytes: number | null;
	linkUrl: string | null;
	text: string | null;
	audience: 'MARKETER' | 'ALL';
	active: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface MarketingAssetList { items: MarketingAsset[]; pagination: { page: number; limit: number; total: number; pages: number } }

@Injectable({ providedIn: 'root' })
export class SaMarketingAssetsService {
	private http = inject(HttpClient);
	private base = `${environment.url_api}/admin/marketing-assets`;

	list(f: { kind?: string; active?: string; search?: string } = {}): Observable<{ success: boolean; data: MarketingAssetList }> {
		let params = new HttpParams();
		for (const [k, v] of Object.entries(f)) if (v) params = params.set(k, v);
		return this.http.get<{ success: boolean; data: MarketingAssetList }>(this.base, { params });
	}
	create(form: FormData): Observable<{ success: boolean; data: MarketingAsset }> {
		return this.http.post<{ success: boolean; data: MarketingAsset }>(this.base, form);
	}
	setActive(id: string, active: boolean): Observable<{ success: boolean; data: MarketingAsset }> {
		return this.http.patch<{ success: boolean; data: MarketingAsset }>(`${this.base}/${id}`, { active });
	}
}
