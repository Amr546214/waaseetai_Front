import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface GamificationLevelResponse {
	currentStats: {
		points: number;
		completedProjects: number;
		avgRating: number;
		commissionRate: number;
	};
	currentLevel: {
		index: number;
		title: string;
	};
	nextLevelProgress: {
		title: string;
		pointsGap: number;
		projectsGap: number;
		ratingGap: number;
		pointsPercent: number;
		projectsPercent: number;
		ratingPercent: number;
		nextCommission: number;
	};
	aiRecommendation: string;
	roadmap: Array<{
		index: number;
		title: string;
		reqPoints: number;
		reqProjects: number;
		reqRating: number;
		commission: number;
		isCurrent: boolean;
		/** brand station colour pair from the backend (single ladder) */
		color?: { dark: string; light: string };
		station?: number;
		state?: 'completed' | 'current' | 'next' | 'upcoming';
	}>;
	pointRules: {
		gainRules: Array<{ label: string; points: string }>;
		lossRules: Array<{ label: string; points: string }>;
	};
}

/** GET /profiles/level-details: the client's own level view (cashback ladder). `limitations` lists what is not live yet. */
export interface ClientLevelResponse {
	currentStats: { points: number; completedProjects: number; avgRating: number | null; cashbackRate: number };
	currentLevel: { index: number; title: string };
	nextLevelProgress: { title: string; pointsGap: number; projectsGap: number; ratingRequired: number; pointsPercent: number; projectsPercent: number; nextCashbackRate: number };
	roadmap: Array<{ index: number; title: string; reqPoints: number; reqProjects: number; reqRating: number; rate: number; station: number; color: { dark: string; light: string }; isCurrent: boolean }>;
	limitations: string[];
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
	private apiUrl = environment.url_api;

	constructor(private http: HttpClient) { }

	getClientLevelDetails(): Observable<{ success: boolean; data: ClientLevelResponse }> {
		return this.http.get<{ success: boolean; data: ClientLevelResponse }>(`${this.apiUrl}/profiles/level-details`);
	}

	getLevelDetails(): Observable<{ success: boolean; data: GamificationLevelResponse }> {
		return this.http.get<{ success: boolean; data: GamificationLevelResponse }>(`${this.apiUrl}/provider/gamification/level-details`);
	}
}
