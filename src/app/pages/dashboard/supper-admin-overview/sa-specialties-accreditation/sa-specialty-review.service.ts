import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { FilterKey, SpecialtyDecision, SpecialtyReviewDetail, SpecialtyReviewList } from './sa-specialties-accreditation.data';

interface Api<T> { success: boolean; message?: string; data: T }

/** Admin specialty review: GET /admin/accreditation/specialties (+/:id) and POST .../:id/decision. */
@Injectable({ providedIn: 'root' })
export class SaSpecialtyReviewService {
  private http = inject(HttpClient);
  private readonly base = `${environment.url_api}/admin/accreditation/specialties`;

  list(q: { status: FilterKey; search?: string; page?: number; limit?: number }): Observable<Api<SpecialtyReviewList>> {
    let params = new HttpParams().set('status', q.status);
    if (q.search) params = params.set('search', q.search);
    if (q.page) params = params.set('page', q.page);
    if (q.limit) params = params.set('limit', q.limit);
    return this.http.get<Api<SpecialtyReviewList>>(this.base, { params });
  }

  get(id: string): Observable<Api<SpecialtyReviewDetail>> {
    return this.http.get<Api<SpecialtyReviewDetail>>(`${this.base}/${id}`);
  }

  decide(id: string, decision: SpecialtyDecision, reason: string): Observable<Api<{ providerSpecialtyId: string; status: SpecialtyDecision; decidedAt: string }>> {
    return this.http.post<Api<{ providerSpecialtyId: string; status: SpecialtyDecision; decidedAt: string }>>(`${this.base}/${id}/decision`, { decision, reason });
  }
}
