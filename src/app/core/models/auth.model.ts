export enum AccountType {
	CLIENT_INDIVIDUAL = 'CLIENT_INDIVIDUAL',
	CLIENT_COMPANY = 'CLIENT_COMPANY',
	PROVIDER_INDIVIDUAL = 'PROVIDER_INDIVIDUAL',
	PROVIDER_COMPANY = 'PROVIDER_COMPANY',
	MARKETING_BROKER = 'MARKETING_BROKER',
	SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
	PENDING_VERIFICATION = 'PENDING_VERIFICATION',
	ACTIVE = 'ACTIVE',
	SUSPENDED = 'SUSPENDED'
}

export enum UserRole {
	CLIENT = 'CLIENT',
	PROVIDER = 'PROVIDER',
	AFFILIATE = 'AFFILIATE',
	ADMIN = 'ADMIN',
	SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface User {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	phoneNumber?: string;
	phoneCountryCode?: string;
	accountType: AccountType;
	activeRole?: UserRole;
	roles?: UserRole[];
	status?: UserStatus;
	avatarUrl?: string | null;
	profileCompletionPercent?: number;
	currentLevel?: string;
	pointsToNextLevel?: number;
	currentPoints?: number;
	idNumber?: string;
	idExpiryDate?: Date;
	commercialRegistration?: string;
	alternativePhone?: string;
	address?: string;
	city?: string;
	region?: string;
	ibanNumber?: string;
	bankName?: string;
	accountHolderName?: string;
}

export interface AuthResponse {
	success: boolean;
	message: string;
	data: {
		verified: boolean;
		userId?: string; // Present if verified: false
		token?: string;  // Present if verified: true
		user?: User;     // Present if verified: true
		// Present when POST /auth/google is called with intent 'register' for a
		// brand-new email: the identity is verified but no user/session/token is
		// created yet — the frontend must collect the rest of the registration
		// form and submit it to /auth/register with googleIdToken.
		registrationRequired?: boolean;
		googleProfile?: {
			email: string;
			firstName: string;
			lastName: string;
		};
		// Present on /auth/login and /auth/google (intent 'login') when
		// verified is false: the password/Google identity was correct, but the
		// account requires a phone OTP (see /auth/login/verify-otp) before a
		// session is issued.
		phoneOtpRequired?: boolean;
		// Active account, correct password: a login code was e-mailed (purpose LOGIN_EMAIL). Confirm it at /auth/login/verify-otp for the session.
		loginOtpRequired?: boolean;
		// Activation-code delivery (register, resend-otp, unverified login): true only when the email really went out.
		emailSent?: boolean;
		// Unverified login whose send was throttled: seconds until a new code may be sent (the earlier code stays valid).
		retryAfterSeconds?: number;
	};
	// resend-otp mirrors the delivery result at the top level as well (success is false when nothing was sent).
	emailSent?: boolean;
}

export interface RegisterInput {
	accountType: AccountType;
	firstName: string;
	lastName: string;
	email: string;
	phoneCountryCode: string;
	phoneNumber: string;
	password?: string;
	googleIdToken?: string;
	agreedToTerms: boolean;
	// Single-tier direct referral attribution (P-LG-012) — an affiliate's
	// referralSlug or raw id, from either manual entry or name search.
	// Omitted entirely (never sent as '' or null) when the user picked none.
	affiliateIdentifier?: string;
}

export interface VerifyOtpInput {
	userId: string;
	code: string;
}

export interface LoginInput {
	email: string;
	password?: string;
}

export interface ForgotPasswordInput {
	email: string;
}

export interface VerifyResetCodeInput {
	email: string;
	code: string;
}

export interface ResetPasswordInput {
	email: string;
	code: string;
	newPassword: string;
}

export interface GenericMessageResponse {
	success: boolean;
	message: string;
}
