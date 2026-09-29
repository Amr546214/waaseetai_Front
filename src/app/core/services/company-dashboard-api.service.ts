import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CompanyDashboardApiResponse } from '../models/company-dashboard.model';

@Injectable({
	providedIn: 'root'
})
export class CompanyDashboardApiService {
	private http = inject(HttpClient);

	private readonly baseUrl = `${environment.url_api}/client/company`;

	/**
	 * Company-mode client dashboard — distinct from the individual client's
	 * /dashboard/stats: budget/approval/team-activity data that only exists
	 * for CLIENT_COMPANY accounts (see P-SK-001-شركة in the design reference).
	 */
	public getCompanyDashboard(): Observable<CompanyDashboardApiResponse> {
		return this.http.get<CompanyDashboardApiResponse>(`${this.baseUrl}/dashboard`);
	}
}
