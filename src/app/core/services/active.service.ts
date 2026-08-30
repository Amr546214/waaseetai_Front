import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
	providedIn: 'root'
})
export class ActiveProjectsService {
	private http = inject(HttpClient);

	getActiveProjects(): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/active`);
	}

	getArchivedProjects(): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/archived`);
	}

	getProjectProgress(projectId: string): Observable<any> {
		return this.http.get<any>(`${environment.url_api}/provider/projects/${projectId}/progress`);
	}

	submitDelivery(projectId: string, stageId: string, payload: { note: string; files: string[] }): Observable<any> {
		return this.http.post<any>(`${environment.url_api}/provider/projects/${projectId}/stages/${stageId}/deliveries`, payload);
	}
}
