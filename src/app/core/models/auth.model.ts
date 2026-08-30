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
	};
}

export interface RegisterInput {
	accountType: AccountType;
	firstName: string;
	lastName: string;
	email: string;
	phoneCountryCode: string;
	phoneNumber: string;
	password?: string;
	agreedToTerms: boolean;
}

export interface VerifyOtpInput {
	userId: string;
	code: string;
}

export interface LoginInput {
	email: string;
	password?: string;
}
