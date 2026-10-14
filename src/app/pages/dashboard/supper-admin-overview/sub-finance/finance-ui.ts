import { AdminFinanceOverview, AdminTransaction } from '../../../../core/services/admin-ops-api.service';

/** Shared, data-free helpers for the admin finance pages (all figures come from the API). */

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function usd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  return `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} $`;
}

/** 'YYYY-MM' -> month name + year. */
export function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  const i = Number(mo) - 1;
  return AR_MONTHS[i] ? `${AR_MONTHS[i]} ${y}` : m;
}
export function monthShort(m: string): string {
  const i = Number(m.split('-')[1]) - 1;
  return AR_MONTHS[i] ?? m;
}

export function fmtDate(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export const TX_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: 'إيداع',
  ESCROW_LOCK: 'حجز ضمان',
  ESCROW_RELEASE: 'تحرير ضمان',
  REFUND: 'استرداد',
};
export function txTypeLabel(t: string): string {
  return TX_TYPE_LABELS[t] ?? t;
}
export const TX_STATUS_LABELS: Record<string, string> = { COMPLETED: 'مكتمل', PENDING: 'قيد المعالجة', FAILED: 'فشل' };
export function txStatusLabel(s: string): string {
  return TX_STATUS_LABELS[s] ?? s;
}
export function txStatusClass(s: string): string {
  return s === 'COMPLETED' ? 'paid' : s === 'PENDING' ? 'pending' : 'refunded';
}
export function txParty(t: AdminTransaction): string {
  return t.user?.name || t.user?.email || '—';
}

export interface SeriesBar { month: string; label: string; deposits: number; releasedGross: number; withdrawalsPaid: number; affiliateCommissions: number }

/** Bars heights (%) normalised on the biggest real value in the series; 0 when everything is 0. */
export function seriesBars(o: AdminFinanceOverview | null): { rows: SeriesBar[]; max: number } {
  const rows = (o?.series ?? []).map((s) => ({ ...s, label: monthShort(s.month) }));
  const max = Math.max(0, ...rows.flatMap((r) => [r.deposits, r.releasedGross, r.withdrawalsPaid]));
  return { rows, max };
}
export function pct(v: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
}
export function bucket(rec: Record<string, { count: number; amount: number }> | undefined, key: string): { count: number; amount: number } {
  return rec?.[key] ?? { count: 0, amount: 0 };
}
export function errMsg(err: unknown, fallback: string): string {
  return (err as { error?: { message?: string } })?.error?.message || fallback;
}
