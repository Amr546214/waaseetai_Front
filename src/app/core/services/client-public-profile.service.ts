import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ClientPublicProfileApiResponse } from '../models/client-public-profile.model';

@Injectable({
  providedIn: 'root',
})
export class ClientPublicProfileService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.url_api;

  /**
   * Public, unauthenticated read of a real client's profile by their User id.
   * GET /api/client/profile/public/:id
   */
  getPublicProfile(id: string): Observable<ClientPublicProfileApiResponse> {
    return this.http.get<ClientPublicProfileApiResponse>(`${this.baseUrl}/client/profile/public/${id}`);
  }
}
