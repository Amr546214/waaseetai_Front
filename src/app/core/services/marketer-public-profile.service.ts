import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MarketerPublicProfileApiResponse } from '../models/marketer-public-profile.model';

@Injectable({
  providedIn: 'root',
})
export class MarketerPublicProfileService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  /**
   * Public, unauthenticated read of a real marketer's profile by their User id.
   * GET /api/marketer/profile/public/:id
   */
  getPublicProfile(id: string): Observable<MarketerPublicProfileApiResponse> {
    return this.http.get<MarketerPublicProfileApiResponse>(`${this.baseUrl}/marketer/profile/public/${id}`);
  }
}
