import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginInput, RegisterInput, VerifyOtpInput, ForgotPasswordInput, VerifyResetCodeInput, ResetPasswordInput, GenericMessageResponse } from '../models/auth.model';
import { AuthStore } from '../store/auth.store';
import { ApiResponse } from '../models/api.model';

@Injectable({
	providedIn: 'root'
})
export class AuthApiService {
	private http = inject(HttpClient);
	private authStore = inject(AuthStore);

	private readonly baseUrl = `${environment.url_api}/auth`;

	/**
	 * Register a new user
	 */
	public register(payload: RegisterInput): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload).pipe(
			tap((res) => {
				if (res.success && res.data?.userId) {
					// Route user into pending verification flow
					this.authStore.setPendingVerification(res.data.userId);
				}
			})
		);
	}

	/**
	 * Verify OTP code and login
	 */
	public verifyOtp(payload: VerifyOtpInput): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/verify-otp`, payload).pipe(
			tap((res) => {
				if (res.success && res.data?.token && res.data?.user) {
					// Commit full authentication session
					this.authStore.authenticate(res.data.token, res.data.user);
				}
			})
		);
	}

	/**
	 * Resend OTP code
	 */
	public resendOtp(userId: string): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/resend-otp`, { userId });
	}

	/**
	 * Verify the login-time phone OTP and commit the session
	 */
	public verifyLoginOtp(payload: VerifyOtpInput): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/login/verify-otp`, payload).pipe(
			tap((res) => {
				if (res.success && res.data?.token && res.data?.user) {
					this.authStore.authenticate(res.data.token, res.data.user);
				}
			})
		);
	}

	/**
	 * Resend the login-time phone OTP
	 */
	public resendLoginOtp(userId: string): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/login/resend-otp`, { userId });
	}

	/**
	 * Request a password-reset code by email
	 */
	public forgotPassword(payload: ForgotPasswordInput): Observable<GenericMessageResponse> {
		return this.http.post<GenericMessageResponse>(`${this.baseUrl}/forgot-password`, payload);
	}

	/**
	 * Verify a password-reset code (without consuming it)
	 */
	public verifyResetCode(payload: VerifyResetCodeInput): Observable<GenericMessageResponse> {
		return this.http.post<GenericMessageResponse>(`${this.baseUrl}/verify-reset-code`, payload);
	}

	/**
	 * Reset the password using a verified code
	 */
	public resetPassword(payload: ResetPasswordInput): Observable<GenericMessageResponse> {
		return this.http.post<GenericMessageResponse>(`${this.baseUrl}/reset-password`, payload);
	}

	/**
	 * Authenticate existing user
	 */
	public login(payload: LoginInput): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload).pipe(
			tap((res) => {
				if (res.success) {
					if (res.data?.verified && res.data?.token && res.data?.user) {
						this.authStore.authenticate(res.data.token, res.data.user);
					} else if (!res.data?.verified && res.data?.userId) {
						this.authStore.setPendingVerification(res.data.userId);
					}
				}
			})
		);
	}

	/**
	 * Authenticate using Google
	 */
	public googleAuth(idToken: string, accountType?: string): Observable<AuthResponse> {
		return this.http.post<AuthResponse>(`${this.baseUrl}/google`, { idToken, accountType }).pipe(
			tap((res) => {
				if (res.success && res.data?.token && res.data?.user) {
					this.authStore.authenticate(res.data.token, res.data.user);
				}
			})
		);
	}

	/**
	 * Revoke session and logout on backend
	 */
	public logout(): Observable<ApiResponse<null>> {
		return this.http.post<ApiResponse<null>>(`${this.baseUrl}/logout`, {});
	}
}
