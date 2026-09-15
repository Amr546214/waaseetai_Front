import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NewsletterSubscribeResponse {
  success: boolean;
  data?: { email: string; subscribedAt: string };
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NewsletterService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.url_api}/newsletter`;

  subscribe(email: string, source?: string): Observable<NewsletterSubscribeResponse> {
    return this.http.post<NewsletterSubscribeResponse>(`${this.apiUrl}/subscribe`, { email, source });
  }
}
