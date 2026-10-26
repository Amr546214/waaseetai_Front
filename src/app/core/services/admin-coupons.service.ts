import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AdminCouponStatus = 'active' | 'expired' | 'exhausted' | 'inactive';
export type AdminOfferStatus = 'active' | 'expired' | 'inactive';

export interface AdminProviderRef { id: string; name: string | null; email: string; accountType: string }

export interface AdminCoupon {
	id: string;
	code: string;
	provider: AdminProviderRef | null;
	discountType: 'percentage' | 'fixed' | string;
	discountValue: number;
	minimumAmount: number | null;
	maxDiscount: number | null;
	maxUses: number | null;
	usedCount: number;
	maxUsesPerUser: number;
	active: boolean;
	status: AdminCouponStatus;
	approvalStatus: string;
	rejectionReason: string | null;
	startAt: string;
	expiresAt: string | null;
	// empty = applies to all of the provider's services
	services: { id: string; title: string | null }[];
	excludedServiceIds: string[];
	createdAt: string;
	updatedAt: string;
}

export interface AdminCouponRedemption {
	id: string;
	orderId: string;
	orderNumber: string | null;
	orderStatus: string | null;
	customer: { id: string; name: string | null } | null;
	orderValue: number | null;
	discountApplied: number;
	netValue: number | null;
	createdAt: string;
}

export interface AdminCouponDetail extends AdminCoupon {
	internalNote: string | null;
	redemptionCount: number;
	redemptions: AdminCouponRedemption[];
}

export interface AdminPage<T> { items: T[]; page: number; pageSize: number; total: number; totalPages: number }
export interface AdminCouponList extends AdminPage<AdminCoupon> { summary: { totalRedemptions: number; totalDiscountGiven: number; totalDiscountGivenBy?: Record<string, number> } }

export interface AdminSpecialOffer {
	id: string;
	type: 'BUNDLE' | 'DIRECT_DISCOUNT';
	name: string;
	badgeText: string;
	provider: AdminProviderRef | null;
	discountValue: number;
	validityDays: number | null;
	primaryService: { id: string; title: string } | null;
	beneficiaryService: { id: string; title: string } | null;
	targetService: { id: string; title: string } | null;
	active: boolean;
	status: AdminOfferStatus;
	approvalStatus: string;
	rejectionReason: string | null;
	usedCount: number;
	startAt: string;
	expiresAt: string | null;
	createdAt: string;
}

export interface AdminCouponFilters { status?: string; q?: string; providerId?: string; page?: number; pageSize?: number; type?: string }

function params(f: AdminCouponFilters): HttpParams {
	let p = new HttpParams();
	for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== null && String(v).trim() !== '') p = p.set(k, String(v));
	return p;
}

// Admin oversight of provider coupons / special offers. Coupons are created by
// providers; the admin can list, inspect usage, and deactivate / reactivate.
// Special offers are read-only.
@Injectable({ providedIn: 'root' })
export class AdminCouponsService {
	private http = inject(HttpClient);
	private readonly baseUrl = environment.url_api;

	list(filters: AdminCouponFilters = {}): Observable<{ success: boolean; data: AdminCouponList }> {
		return this.http.get<{ success: boolean; data: AdminCouponList }>(`${this.baseUrl}/admin/coupons`, { params: params(filters) });
	}

	get(id: string): Observable<{ success: boolean; data: AdminCouponDetail }> {
		return this.http.get<{ success: boolean; data: AdminCouponDetail }>(`${this.baseUrl}/admin/coupons/${id}`);
	}

	// `reason` is mandatory when deactivating (server answers 400 without it).
	setActive(id: string, active: boolean, reason?: string): Observable<{ success: boolean; data: AdminCoupon }> {
		return this.http.patch<{ success: boolean; data: AdminCoupon }>(`${this.baseUrl}/admin/coupons/${id}/active`, { active, reason: reason ?? null });
	}

	listSpecialOffers(filters: AdminCouponFilters = {}): Observable<{ success: boolean; data: AdminPage<AdminSpecialOffer> }> {
		return this.http.get<{ success: boolean; data: AdminPage<AdminSpecialOffer> }>(`${this.baseUrl}/admin/special-offers`, { params: params(filters) });
	}
}
