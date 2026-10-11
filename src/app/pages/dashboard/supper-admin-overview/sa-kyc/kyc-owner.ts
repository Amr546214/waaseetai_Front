// The admin KYC lists must say who owns each request. The backend now sends flat userName / userEmail / userPhone, and older answers carry the same data
// in a nested `user`: this reads either, so a row is never shown as "—" while the owner is known.
type Nested = { firstName?: string | null; lastName?: string | null; email?: string | null; phoneNumber?: string | null; accountType?: string | null } | null | undefined;

export function withOwnerFields<T extends Record<string, any>>(item: T): T {
	const u: Nested = item?.['user'];
	const nestedName = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : '';
	return {
		...item,
		userName: item['userName'] || nestedName || undefined,
		userEmail: item['userEmail'] || u?.email || undefined,
		userPhone: item['userPhone'] || u?.phoneNumber || undefined,
		accountType: item['accountType'] || u?.accountType || undefined,
	};
}

/** Documents on file: the backend count when sent, else every document field present on the row. */
export function providerDocumentsCount(p: Record<string, any>): number {
	if (typeof p['documentsCount'] === 'number') return p['documentsCount'];
	const certs = Array.isArray(p['certUrls']) ? p['certUrls'].filter(Boolean).length : 0;
	return ['frontIdUrl', 'backIdUrl', 'selfieUrl', 'supportingDocsUrl'].filter((k) => !!p[k] || !!p[k + 'Access']?.private).length + certs;
}
