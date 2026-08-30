import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardApiResponse } from '../models/dashboard.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardApiService {
  private http = inject(HttpClient);
  
  private readonly baseUrl = `${environment.url_api}/dashboard`;

  /**
   * Get unified dashboard stats
   */
  public getDashboardStats(): Observable<DashboardApiResponse> {
    return this.http.get<DashboardApiResponse>(`${this.baseUrl}/stats`);
  }
}
