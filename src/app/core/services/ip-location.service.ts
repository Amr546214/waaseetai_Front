
import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export interface IpLocation {
  country: string;
  countryCode: string;
  city: string;
}

interface IpApiResponse {
  country_name?: string;
  country_code?: string;
  city?: string;
}

@Injectable({
  providedIn: 'root',
})
export class IpLocationService {
  // Bypass application interceptors so no auth token is attached.
  private readonly http = new HttpClient(inject(HttpBackend));

  getLocation(): Observable<IpLocation | null> {
    return this.http.get<IpApiResponse>('https://ipapi.co/json/').pipe(
      map((response) => {
        if (!response.country_name || !response.country_code) {
          return null;
        }

        return {
          country: response.country_name,
          countryCode: response.country_code,
          city: response.city ?? '',
        };
      }),
      catchError(() => of(null)),
    );
  }
}
