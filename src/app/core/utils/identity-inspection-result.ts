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
