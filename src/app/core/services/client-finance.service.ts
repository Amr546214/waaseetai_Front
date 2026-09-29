import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ClientWalletSummary {
	availableBalance: number;
	escrowBalance: number;
	totalDeposited: number;
	activeProjectsCount: number;
	currency: string;
	/** Company-mode only (P-SK-018-شركة): this quarter's total spend and the quarter's budget cap. */
	quarterSpend?: number;
	quarterBudget?: number;
}

export interface ClientWalletTransaction {
	id: string;
	type: string;
	amount: number;
	currency: string;
	status: string;
	paymentMethod?: string;
	referenceId?: string;
	description: string;
	createdAt: string;
	/** Company-mode only: which employee made/triggered this transaction. */
	employeeName?: string;
}

export interface ClientWalletEmployeeSpend {
	employeeName: string;
	department?: string;
	amount: number;
}

export interface ClientWalletData {
	summary: ClientWalletSummary;
	transactions: ClientWalletTransaction[];
	/** Company-mode only: per-employee spend breakdown for the current quarter. */
	employeeSpending?: ClientWalletEmployeeSpend[];
}

export interface ClientInvoice {
	id: string;
	sourceId: string;
	contractId: string;
	projectId: string;
	stageId: string;
	providerName: string;
	date: string;
	project: string;
	projectTitle: string;
	stageTitle: string;
	subtotal: number;
	total: number;
	tax: number;
	taxRate: number;
	status: 'paid' | 'due';
	paymentDate: string | null;
	verificationScore: number;
	taxDocumentAvailable: boolean;
	commercialRegistrationAvailable: boolean;
	/** Company-mode only: which employee's project/request this invoice belongs to. */
	employeeName?: string;
}

export interface ClientInvoicesData {
	summary: {
		totalCount: number;
		paidCount: number;
		dueCount: number;
		totalTax: number;
		averageVerificationScore: number;
		currency: string;
	};
	invoices: ClientInvoice[];
}

export interface DepositInitResponse {
	reference: string;
	amount: number;
	currency: string;
	publishableKey: string;
	paymentMethod: string;
	callbackUrl: string;
	metadata: {
		client_id: string;
		deposit_reference: string;
		purpose: 'wallet_deposit';
	};
}

@Injectable({
	providedIn: 'root'
})
export class ClientFinanceService {
	private http = inject(HttpClient);
	private baseUrl = `${environment.url_api}/client/finance`;

	getWallet(): Observable<{ success: boolean; data: ClientWalletData }> {
		return this.http.get<{ success: boolean; data: ClientWalletData }>(`${this.baseUrl}/wallet`);
	}

	getInvoices(): Observable<{ success: boolean; data: ClientInvoicesData }> {
		return this.http.get<{ success: boolean; data: ClientInvoicesData }>(`${this.baseUrl}/invoices`);
	}

	getInvoice(id: string): Observable<{ success: boolean; data: ClientInvoice }> {
		return this.http.get<{ success: boolean; data: ClientInvoice }>(`${this.baseUrl}/invoices/${encodeURIComponent(id)}`);
	}

	initiateDeposit(amount: number, paymentMethod: string = 'card'): Observable<{ success: boolean; data: DepositInitResponse }> {
		return this.http.post<{ success: boolean; data: DepositInitResponse }>(`${this.baseUrl}/deposit/init`, {
			amount,
			paymentMethod
		});
	}

	verifyDeposit(payload: {
		paymentId: string;
		amount?: number;
		paymentMethod?: string;
		description?: string;
	}): Observable<{ success: boolean; message: string; data: ClientWalletData }> {
		return this.http.post<{ success: boolean; message: string; data: ClientWalletData }>(`${this.baseUrl}/deposit/verify`, payload);
	}
}
