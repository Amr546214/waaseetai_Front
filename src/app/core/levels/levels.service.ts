import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LevelRow {
	level: number;
	name: string;
	percent: number;
	station: number;
	color: { dark: string; light: string };
	thresholds: { points: number; projects?: number; rating?: number; clients?: number; revenueUsd?: number };
}
export interface RoleLevels { label: string; percentKind: 'COMMISSION' | 'CASHBACK'; levels: LevelRow[] }
export interface LevelsPayload {
	version: number;
	thresholdRule: 'GREATER_OR_EQUAL';
	roles: { PROVIDER: RoleLevels; CLIENT: RoleLevels; MARKETER: RoleLevels };
	/** نسب الدفع.xlsx: the client's deposit fee by method and the marketer's withdrawal fee by method (percent) */
	payments: { clientDeposit: Record<string, number>; marketerWithdrawal: Record<string, number> };
}

export const DEPOSIT_METHOD_LABELS: Record<string, string> = { mada: 'مدى', visa_mastercard: 'فيزا/ماستر', paypal: 'PayPal', international_transfer: 'تحويل دولي', other: 'غير ذلك' };
export const WITHDRAWAL_METHOD_LABELS: Record<string, string> = { bank_transfer: 'تحويل بنكي', paypal: 'PayPal', usdt: 'USDT' };

/**
 * The level tables and the payment-percentage tables, read from the backend (GET /levels: the single source). Nothing is typed here: when the
 * request has not answered (or failed) every accessor returns null / empty, so a page shows no number rather than an invented one.
 */
@Injectable({ providedIn: 'root' })
export class LevelsService {
	private readonly http = inject(HttpClient);
	readonly payload = signal<LevelsPayload | null>(null);
	private requested = false;

	/** Fetches once (shared by every page); the payload signal updates when it arrives. */
	ensureLoaded(): void {
		if (this.requested) return;
		this.requested = true;
		this.http.get<{ success: boolean; data: LevelsPayload }>(`${environment.url_api}/levels`).subscribe({
			next: r => { if (r?.success && r.data) this.payload.set(r.data); },
			error: () => { this.requested = false; },
		});
	}

	load(): Observable<{ success: boolean; data: LevelsPayload }> {
		return this.http.get<{ success: boolean; data: LevelsPayload }>(`${environment.url_api}/levels`).pipe(tap(r => { if (r?.success && r.data) this.payload.set(r.data); }));
	}

	/** { min, max } percentage of a role's ladder, or null when not loaded. */
	range(role: 'PROVIDER' | 'CLIENT' | 'MARKETER') {
		return computed(() => {
			const levels = this.payload()?.roles[role]?.levels;
			if (!levels?.length) return null;
			const ps = levels.map(l => l.percent);
			return { min: Math.min(...ps), max: Math.max(...ps) };
		});
	}

	level(role: 'PROVIDER' | 'CLIENT' | 'MARKETER', n: number): LevelRow | null {
		return this.payload()?.roles[role]?.levels.find(l => l.level === n) ?? null;
	}
}
