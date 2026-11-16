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
 * (the message stays under the field). A name / number / date remark does not reject the picture: the owner may simply have typed the data differently.
 */
export function identityImageRejected(d: any): boolean {
  return !!d && (d.isIdentityDocument === false || d.status === 'NOT_ID_DOCUMENT' || d.status === 'UNREADABLE' || d.readability === 'UNREADABLE' || d.sideMatchesExpected === false || d.documentTypeMatches === false);
}
