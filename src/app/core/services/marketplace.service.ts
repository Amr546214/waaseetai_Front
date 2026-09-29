import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MarketplaceModel {
  id: string;
  title: string;
  description?: string;
  category: string;
  categorySlug?: string;
  specialtySlug?: string;
  status: string;
  totalAmount: number;
  totalDays: number;
  aiScore: number;
  aiClarityScore?: number;
  aiFeasibilityScore?: number;
  viewsCount?: number;
  salesCount?: number;
  rating: number;
  reviewsCount?: number;
  isVerified?: boolean;
  isFeatured?: boolean;
  discountPercentage?: number | null;
  offerEndsAt?: string | null;
  level?: string;
  levelBg?: string;
  levelColor?: string;
  gallery?: string[];
  coverImage?: string;
  provider: {
    id: string;
    name: string;
    avatar?: string;
    initials: string;
  };
  stages?: any[];
  tags?: string[];
  aiRecommendationReason?: string;
  aiMatchPercentage?: number;
  reviews?: Array<{ id: string; rating: number; comment?: string; createdAt: string; client?: { name: string; avatar?: string } | null }>;
}

@Injectable({
  providedIn: 'root'
})
export class MarketplaceService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.url_api}/marketplace`;

  /**
   * Get published business models with category filter, search, and pagination
   */
  public getPublishedModels(filters: any = {}): Observable<any> {
    let params = new HttpParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params = params.set(key, filters[key]);
      }
    });
    return this.http.get<any>(`${this.baseUrl}/models`, { params });
  }

  /**
   * Get a single published model by ID
   */
  public getPublishedModelById(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/models/${id}`);
  }

  /**
   * Get dynamic categories with counts & sub-specialties
   */
  public getCategories(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/categories`);
  }

  /**
   * Get personalized AI Match recommendations
   */
  public getAiRecommendations(payload: any = {}): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/ai-recommendations`, payload);
  }

  /**
   * Get public profile data of a provider by ID
   */
  public getProviderPublicProfile(id: string): Observable<any> {
    return this.http.get<any>(`${environment.url_api}/provider/profile/public/${id}`);
  }

  public getFavorites(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/favorites`);
  }

  public setFavorite(id: string, favorite: boolean): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/models/${id}/favorite`, { favorite });
  }

  /**
   * Phase 4 — the signed-in user's own active (contract-backed, not yet
   * completed/cancelled) purchase of this service, if any. Backed by
   * GET /marketplace/models/:id/my-purchase — the same rule the backend
   * enforces on cart add / order create / wallet payment.
   */
  public getMyPurchaseStatus(id: string): Observable<{ success: boolean; data: { serviceId: string; active: boolean; projectId: string | null; projectStatus: string | null; contractStatus: string | null } }> {
    return this.http.get<any>(`${this.baseUrl}/models/${id}/my-purchase`);
  }

  public requestService(id: string, payload: { mode: 'order' | 'negotiation'; message?: string }): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/models/${id}/request`, payload);
  }
}
