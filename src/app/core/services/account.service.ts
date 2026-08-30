import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { UserRole, User } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';

export interface AvailableAccountTypesResponse {
  success: boolean;
  data: {
    activeRole: UserRole;
    roles: UserRole[];
    ownedRoles: UserRole[];
    availableRoles: Array<{
      role: UserRole;
      label: string;
      color: string;
      description: string;
    }>;
    allRoles: Array<{
      role: UserRole;
      label: string;
      color: string;
      description: string;
    }>;
  };
}

export interface AccountMutationResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private http = inject(HttpClient);
  private authStore = inject(AuthStore);

  private readonly baseUrl = `${environment.url_api}/user`;

  /**
   * Fetch available account roles and owned roles
   */
  public getAvailableAccountTypes(): Observable<AvailableAccountTypesResponse> {
    return this.http.get<AvailableAccountTypesResponse>(`${this.baseUrl}/available-account-types`);
  }

  /**
   * Add a new account role type
   */
  public addAccountType(targetRole: UserRole, profileMetadata?: Record<string, any>): Observable<AccountMutationResponse> {
    return this.http.post<AccountMutationResponse>(`${this.baseUrl}/add-account-type`, {
      targetRole,
      profileMetadata
    }).pipe(
      tap((res) => {
        if (res.success && res.data?.token && res.data?.user) {
          this.authStore.authenticate(res.data.token, res.data.user);
        }
      })
    );
  }

  /**
   * Switch user's active role
   */
  public switchActiveRole(targetRole: UserRole): Observable<AccountMutationResponse> {
    return this.http.post<AccountMutationResponse>(`${this.baseUrl}/switch-active-role`, {
      targetRole
    }).pipe(
      tap((res) => {
        if (res.success && res.data?.token && res.data?.user) {
          this.authStore.authenticate(res.data.token, res.data.user);
        }
      })
    );
  }
}
