import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  accountType: string;
  type: string;
  typeLabel: string;
  typeBg: string;
  typeColor: string;
  status: string;
  statusOriginal: string;
  last: string;
  lastActiveAt?: string;
  projects: number;
  // AI Cleanup Batch 3: risk / aiRiskScore / aiSuspiciousNotes are intentionally not
  // typed here. The API still sends them, but no risk engine populates them (the
  // values are schema defaults), so the UI must not display them.
  av: string;
  avBg: string;
  spending?: string;
  revenue?: string;
  monthlyBudget?: string;
  pendingCommission?: string;
  rating?: string;
  level?: string;
  requests?: number;
  lastReq?: string;
  manager?: string;
  teamSize?: string;
  specialty?: string;
  providerCount?: string;
  specialties?: string;
  activeProjects?: string;
  totalReferrals?: string;
  affiliateLevel?: string;
  role?: string;
  tasksCount?: string;
  createdAt: string;
}

export interface AdminUserDetailKpis {
  reports: number;
  disputes: number;
  avgRating: number | null;
  totalRevenue: string;
  completedProjects: number;
}

export interface AdminUserRevenuePoint {
  label: string;
  value: number;
}

export interface AdminUserLinkedAccount {
  email?: string;
  iban?: string;
}

export interface AdminUserPersonalInfo {
  fullName: string;
  email: string;
  phoneNumber?: string;
  city?: string;
  device?: string;
  bankAccountLast4?: string;
  bankAccountVerified?: boolean;
  nationalIdLast4?: string;
  nationalIdVerified?: boolean;
  registeredAt: string;
  lastLoginAt?: string;
}

export interface AdminUserDetail extends AdminUser {
  kpis: AdminUserDetailKpis;
  revenueHistory: AdminUserRevenuePoint[];
  linkedAccounts: AdminUserLinkedAccount[];
  personalInfo: AdminUserPersonalInfo;
}

export interface AdminUsersStats {
  totalUsers: { count: number; growth: string };
  activeThisMonth: { count: number; ratio: string };
  suspendedCount: { count: number; pendingReview: number };
  newThisWeek: { count: number; growth: string };
  tabCounts: Record<string, number>;
}

export interface GetAdminUsersResponse {
  success: boolean;
  data: AdminUser[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AdminUsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  accountType?: string;
  status?: string;
  financialRange?: string;
  rating?: string;
  joinedDate?: string;
  lastActive?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class SaUsersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.url_api}/admin/users`;

  getStats(): Observable<{ success: boolean; data: AdminUsersStats }> {
    return this.http.get<{ success: boolean; data: AdminUsersStats }>(`${this.apiUrl}/stats`);
  }

  getUserDetail(id: string): Observable<{ success: boolean; data: AdminUserDetail }> {
    return this.http.get<{ success: boolean; data: AdminUserDetail }>(`${this.apiUrl}/${id}`);
  }

  getUsers(params: AdminUsersQueryParams): Observable<GetAdminUsersResponse> {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.http.get<GetAdminUsersResponse>(`${this.apiUrl}`, { params: httpParams });
  }

  updateUserStatus(id: string, status: string): Observable<{ success: boolean; message: string; data: any }> {
    return this.http.patch<{ success: boolean; message: string; data: any }>(`${this.apiUrl}/${id}/status`, { status });
  }

  deleteUser(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  downloadCsv(params: AdminUsersQueryParams): void {
    let httpParams = new HttpParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    const exportUrl = `${this.apiUrl}/export-csv?${httpParams.toString()}`;
    window.open(exportUrl, '_blank');
  }
}
