/** Display the backend advisory contract; this never approves identity. */
export function identityInspectionResult(d: any): { status: 'valid' | 'warning'; message: string } {
  const fields = Object.values(d?.fields || {});
  const valid = d?.status === 'CLEAR_VALID' && d.isIdentityDocument === true
    && d.readability === 'CLEAR' && d.sideMatchesExpected === true
    && !fields.includes('MISMATCH') && !(d.warningsAr?.length);
  const messages = [d?.summaryAr, ...(Array.isArray(d?.warningsAr) ? d.warningsAr : [])]
    .filter((s): s is string => typeof s === 'string' && Boolean(s.trim()));
  return {
    status: valid ? 'valid' : 'warning',
    message: [...new Set(messages)].join(' — ') || 'تعذر تأكيد وضوح الوثيقة؛ ما زالت تحتاج مراجعة بشرية.'
  };
}

/**
 * The picture itself is not accepted: not an identity document, unreadable, the wrong side, or another document kind than the one chosen. Such a picture is removed from the form
 * (the message stays under the field). A document NUMBER that differs from the typed one rejects it too (the number is the key of the identity, and the owner is told to fix it);
 * a name / date remark does not reject the picture: the owner may simply have typed those differently.
 */
export function identityNumberMismatch(d: any): boolean { return d?.fields?.nationalId === 'MISMATCH'; }

export const NUMBER_MISMATCH_MESSAGE = 'الرقم المكتوب لا يطابق الرقم الظاهر في الوثيقة. صحّح الرقم ثم أعد رفع الصورة.';

export function identityImageRejected(d: any): boolean {
  return !!d && (identityNumberMismatch(d) || d.isIdentityDocument === false || d.status === 'NOT_ID_DOCUMENT' || d.status === 'UNREADABLE' || d.readability === 'UNREADABLE' || d.sideMatchesExpected === false || d.documentTypeMatches === false);
}

/** The document kind the AI recognised in the picture, as the app's document-type code (null = not recognised / «other»): the owner no longer picks the type, it comes from the document. */
export function detectedDocumentCode(d: any): 'NATIONAL_ID' | 'PASSPORT' | 'RESIDENCE_PERMIT' | 'DRIVING_LICENCE' | null {
	const kind = String(d?.documentKind ?? '').toUpperCase();
	return kind === 'NATIONAL_ID' || kind === 'PASSPORT' || kind === 'RESIDENCE_PERMIT' || kind === 'DRIVING_LICENCE' ? (kind as any) : null;
}
