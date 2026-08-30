import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface AdminSpecialtyStats {
	totalSpecialties: number;
	totalCategories: number;
	activeSpecialtiesCount: number;
	activeProvidersCount: number;
	monthlyAccreditationRequests: number;
}

export interface AdminSpecialty {
	id: string;
	nameAr: string;
	nameEn?: string;
	isActive: boolean;
	providersCount: number;
	monthlyRequests: number;
	// ... other fields
}

export interface AdminCategory {
	id: string;
	nameAr: string;
	nameEn?: string;
	isActive?: boolean;
	specialties: AdminSpecialty[];
}

@Injectable({
	providedIn: 'root'
})
export class SaSpecialtiesService {
	private http = inject(HttpClient);
	private apiUrl = `${environment.url_api}/admin/specialties`;

	getStats(): Observable<{ success: boolean; data: AdminSpecialtyStats }> {
		return this.http.get<{ success: boolean; data: AdminSpecialtyStats }>(`${this.apiUrl}/stats`);
	}

	getTree(search: string = ''): Observable<{ success: boolean; data: AdminCategory[] }> {
		return this.http.get<{ success: boolean; data: AdminCategory[] }>(`${this.apiUrl}/tree?search=${search}`);
	}

	createCategory(data: any): Observable<any> {
		return this.http.post(`${this.apiUrl}/categories`, data);
	}

	updateCategory(id: string, data: any): Observable<any> {
		return this.http.put(`${this.apiUrl}/categories/${id}`, data);
	}

	toggleCategoryStatus(id: string): Observable<any> {
		return this.http.patch(`${this.apiUrl}/categories/${id}/toggle-status`, {});
	}

	deleteCategory(id: string): Observable<any> {
		return this.http.delete(`${this.apiUrl}/categories/${id}`);
	}

	createSpecialty(data: any): Observable<any> {
		return this.http.post(`${this.apiUrl}`, data);
	}

	updateSpecialty(id: string, data: any): Observable<any> {
		return this.http.put(`${this.apiUrl}/${id}`, data);
	}

	toggleSpecialtyStatus(id: string): Observable<any> {
		return this.http.patch(`${this.apiUrl}/${id}/toggle-status`, {});
	}

	deleteSpecialty(id: string): Observable<any> {
		return this.http.delete(`${this.apiUrl}/${id}`);
	}
}
