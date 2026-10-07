/** What the backend says about a stored KYC document (`<field>Access`). `private` = open it through the access-link endpoint; `legacy` = the old public URL still works. */
export interface KycAccess {
	private: boolean;
	legacy: boolean;
}

/** Keys accepted by POST /api/kyc-documents/access-link (contract: backend PR #41). */
export type KycDocumentKey =
	| 'client_front_id' | 'client_back_id' | 'client_supporting_docs'
	| 'provider_front_id' | 'provider_back_id' | 'provider_supporting_docs' | 'provider_certificate'
	| 'onboarding_document' | 'user_id_document' | 'user_vat_certificate'
	| 'specialty_proof' | 'accreditation_proof' | 'marketer_kyc_document';

export interface KycAccessRequest {
	document: KycDocumentKey;
	/** Admin only. Owners never send it. */
	userId?: string;
	/** Id-addressed documents (onboarding record, proof attachment, accreditation proof). */
	id?: string;
	/** Position inside `certUrls` for `provider_certificate`. */
	index?: number;
}

export interface KycAccessLink {
	url: string;
	expiresAt: string | null;
	expiresInSeconds: number | null;
	private: boolean;
	legacy: boolean;
}
