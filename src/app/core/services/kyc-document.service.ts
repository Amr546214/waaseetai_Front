import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { KycAccessLink, KycAccessRequest } from '../models/kyc-document.model';

@Injectable({ providedIn: 'root' })
export class KycDocumentService {
	private readonly http = inject(HttpClient);

	/**
	 * Asks the backend for a short-lived link (about 2 minutes) to a stored KYC document. The link is used once, by the caller, to open the
	 * document; it is never stored. Owners omit `userId`; only admins send it.
	 */
	createAccessLink(request: KycAccessRequest): Observable<KycAccessLink> {
		const body: Record<string, unknown> = { document: request.document };
		if (request.userId) body['userId'] = request.userId;
		if (request.id) body['id'] = request.id;
		if (typeof request.index === 'number') body['index'] = request.index;
		return this.http.post<{ success: boolean; data: KycAccessLink }>(`${environment.url_api}/kyc-documents/access-link`, body).pipe(map(res => res.data));
	}
}

/** Arabic, user-facing message for a failed access-link call. */
export function kycAccessErrorMessage(err: unknown): string {
	const status = (err as { status?: number } | null)?.status;
	if (status === 401) return 'انتهت الجلسة، سجّل الدخول مجددًا';
	if (status === 403) return 'لا تملك صلاحية لفتح هذه الوثيقة';
	if (status === 404) return 'لا توجد وثيقة مرفوعة';
	return 'تعذر فتح الوثيقة';
}
