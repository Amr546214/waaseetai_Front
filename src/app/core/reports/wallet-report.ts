import { WalletBreakdown, MISSING_DETAILS_TEXT, netMeaningLabel } from '../models/wallet-unify.model';
import { ReportSection, reportMoney } from './report-document';

/** Present only recorded amounts; a missing breakdown is never treated as zero deductions. */
export function walletReportSections(breakdown: WalletBreakdown | null | undefined): ReportSection[] {
  if (!breakdown) return [{ title: 'تفاصيل المبلغ', text: MISSING_DETAILS_TEXT }];
  const money = (amount: number | null) => amount == null ? 'غير مسجّل' : reportMoney(amount, breakdown.currency);
  const sections: ReportSection[] = [{ title: 'تفاصيل المبلغ', facts: [
    ['العملية', breakdown.operationLabel], ['الإجمالي المسجل', money(breakdown.gross)],
    [netMeaningLabel(breakdown.netMeaning), money(breakdown.net)],
  ], text: [breakdown.detailsRecorded ? '' : breakdown.missingNote || MISSING_DETAILS_TEXT, breakdown.note].filter(Boolean).join('\n') }];
  if (breakdown.deductions.length) sections.push({ title: 'الخصومات المسجلة', columns: ['البند', 'المبلغ والعملة', 'النسبة %', 'المستوى', 'السبب'], rows: breakdown.deductions.map(d => [d.label, money(d.amount), d.ratePercent, d.levelRecorded ? d.level : 'غير مسجّل', d.reason]) });
  return sections;
}
