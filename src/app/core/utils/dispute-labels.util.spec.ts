import { disputeResolutionText, resolutionLabelAr, FINANCIAL_OUTCOME_LABELS_AR } from './dispute-labels.util';

describe('dispute resolution labels', () => {
  it('translates exact codes to Arabic (any case / separators) and never prints the raw code', () => {
    for (const code of ['MUTUAL_CLOSE', 'mutual_close', ' Mutual-Close ']) {
      const out = resolutionLabelAr(code);
      expect(out).toContain('إغلاق ودّي');
      expect(out).not.toContain('MUTUAL');
    }
    expect(resolutionLabelAr('NO_FINANCIAL_CHANGE')).toContain('دون أي تغيير مالي');
    expect(resolutionLabelAr('REJECTED_INSUFFICIENT_EVIDENCE')).toContain('عدم كفاية الأدلة');
  });

  it('financial codes are labelled as executed only when a financial outcome really exists', () => {
    expect(resolutionLabelAr('REFUND_CLIENT', true)).toBe(FINANCIAL_OUTCOME_LABELS_AR.REFUND_CLIENT);
    expect(resolutionLabelAr('SPLIT', true)).toBe('تقسيم المبلغ المحتجز بين الطرفين');
    expect(resolutionLabelAr('REFUND_CLIENT', false)).toContain('لم يُنفَّذ ماليًا');
    expect(resolutionLabelAr('RELEASE_TO_PROVIDER')).toContain('لم يُنفَّذ ماليًا');
    expect(resolutionLabelAr('PARTIAL_REFUND')).toContain('لم يُنفَّذ ماليًا');
  });

  it('admin free text is preserved verbatim, even when it contains a code', () => {
    const free = 'اتفق الطرفان — MUTUAL_CLOSE في الاجتماع';
    expect(resolutionLabelAr(free)).toBe(free);
    expect(resolutionLabelAr('')).toBe('');
    expect(resolutionLabelAr(null)).toBe('');
  });

  it('disputeResolutionText prefers the server label, else translates locally', () => {
    expect(disputeResolutionText({ resolution: 'MUTUAL_CLOSE', resolutionLabel: 'نص الخادم' })).toBe('نص الخادم');
    expect(disputeResolutionText({ resolution: 'MUTUAL_CLOSE' })).toContain('إغلاق ودّي');
    expect(disputeResolutionText({ resolution: 'REFUND_CLIENT', financialOutcome: {} })).toBe(FINANCIAL_OUTCOME_LABELS_AR.REFUND_CLIENT);
    expect(disputeResolutionText(null)).toBe('');
  });
});
