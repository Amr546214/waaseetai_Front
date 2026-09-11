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
		color?: string;
		state?: 'completed' | 'current' | 'next' | 'upcoming';
	}>;
	pointRules: {
		gainRules: Array<{ label: string; points: string }>;
		lossRules: Array<{ label: string; points: string }>;
	};
}

@Injectable({ providedIn: 'root' })
export class GamificationService {
	private apiUrl = environment.url_api;

	constructor(private http: HttpClient) { }

	getLevelDetails(): Observable<{ success: boolean; data: GamificationLevelResponse }> {
		return this.http.get<{ success: boolean; data: GamificationLevelResponse }>(`${this.apiUrl}/provider/gamification/level-details`);
	}
}
