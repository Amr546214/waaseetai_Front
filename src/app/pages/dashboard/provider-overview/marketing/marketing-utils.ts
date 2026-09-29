import { signal } from '@angular/core';
import {
  MarketingApprovalStatus,
  MarketingToolStatus,
  ProviderCoupon,
  ProviderSpecialOffer,
} from '../../../../core/models/marketing.model';

/**
 * Shared helpers for the marketing screens (P-PR-039..041 / P-CO-MK-005..008).
 * Status rules mirror the backend's `toolStatus()` in
 * marketing-center.service.ts so list pages agree with the center KPIs.
 */

/** Company approval threshold — mirrors COMPANY_APPROVAL_DISCOUNT_THRESHOLD in the backend. */
export const COMPANY_APPROVAL_THRESHOLD = 30;

/** List-level status. `CONSUMED` is a coupon that hit its maxUses (shown as «مستهلك بالكامل»). */
export type ToolDisplayStatus = MarketingToolStatus | 'CONSUMED';

export function toolStatus(tool: { active: boolean; expiresAt: string | null; approvalStatus: MarketingApprovalStatus }, now = new Date()): MarketingToolStatus {
  if (tool.approvalStatus === 'PENDING') return 'PENDING';
  if (tool.approvalStatus === 'REJECTED') return 'REJECTED';
  if (tool.expiresAt && new Date(tool.expiresAt) < now) return 'EXPIRED';
  return tool.active ? 'ACTIVE' : 'PAUSED';
}

export function couponStatus(c: ProviderCoupon): ToolDisplayStatus {
  const base = toolStatus(c);
  if ((base === 'ACTIVE' || base === 'PAUSED') && c.maxUses !== null && c.usedCount >= c.maxUses) return 'CONSUMED';
  return base;
}

export function offerStatus(o: ProviderSpecialOffer): ToolDisplayStatus {
  return toolStatus(o);
}

export const STATUS_LABELS: Record<ToolDisplayStatus, string> = {
  ACTIVE: 'نشط',
  PAUSED: 'متوقف',
  EXPIRED: 'منتهي',
  CONSUMED: 'مستهلك بالكامل',
  PENDING: 'بانتظار الموافقة',
  REJECTED: 'مرفوض',
};

export const STATUS_PILL: Record<ToolDisplayStatus, string> = {
  ACTIVE: 'pill-ok',
  PAUSED: 'pill-off',
  EXPIRED: 'pill-bad',
  CONSUMED: 'pill-used',
  PENDING: 'pill-warn',
  REJECTED: 'pill-bad',
};

/** Can the activate switch be flipped? Expired / consumed / pending / rejected tools cannot. */
export function isToggleable(status: ToolDisplayStatus): boolean {
  return status === 'ACTIVE' || status === 'PAUSED';
}

export function couponNeedsApproval(v: { discountType: string; discountValue: number | null; maxUses: number | null }): boolean {
  const uncapped = v.maxUses === null || v.maxUses === undefined;
  const high = v.discountType === 'percentage' && (v.discountValue ?? 0) > COMPANY_APPROVAL_THRESHOLD;
  return uncapped || high;
}

export function offerNeedsApproval(v: { discountValue: number | null }): boolean {
  return (v.discountValue ?? 0) > COMPANY_APPROVAL_THRESHOLD;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return `${formatNumber(n)} ريال`;
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function formatDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`;
}

/** "2026-09" → "سبتمبر". */
export function monthLabel(key: string): string {
  const m = Number(key.split('-')[1]);
  return AR_MONTHS[(m || 1) - 1] ?? key;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'منذ يوم';
  if (days === 2) return 'منذ يومين';
  if (days < 7) return `منذ ${days} أيام`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return 'منذ أسبوع';
  if (days < 30) return `منذ ${weeks} أسابيع`;
  return formatDay(iso);
}

/** Validity column copy: «حتى 30 سبتمبر» / «انتهى 31 أغسطس» / «يبدأ 1 أكتوبر» / «بدون تاريخ انتهاء». */
export function validityLabel(startAt: string | null, expiresAt: string | null): string {
  const now = new Date();
  if (startAt && new Date(startAt) > now) return `يبدأ ${formatDay(startAt)}`;
  if (!expiresAt) return 'بدون تاريخ انتهاء';
  return new Date(expiresAt) < now ? `انتهى ${formatDay(expiresAt)}` : `حتى ${formatDay(expiresAt)}`;
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '؟';
  return parts[0].slice(0, 2);
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#A56BE0,#7B2FBE)',
  'linear-gradient(135deg,#2B7FFF,#1A5FCC)',
  'linear-gradient(135deg,#0FA99A,#0D8A7E)',
  'linear-gradient(135deg,#FFB400,#D98A0B)',
  'linear-gradient(135deg,#E05B6B,#C0394A)',
  'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
];

export function avatarGradient(seed: string | null | undefined): string {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

/** `YYYY-MM-DD` (date input) → ISO. `endOfDay` pins expiry dates to 23:59:59 local. */
export function dateInputToIso(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59) : new Date(y, m - 1, d, 0, 0, 0);
  return date.toISOString();
}

/** ISO → `YYYY-MM-DD` for a date input (local time). */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayInput(): string {
  return isoToDateInput(new Date().toISOString());
}

/** Minimal shape of a provider's own ServiceCatalog row (from /business-models/my-market-models). */
export interface ProviderModelOption {
  id: string;
  title: string;
}

export function httpErrorMessage(err: any, fallback: string): string {
  return err?.error?.message || fallback;
}

/** Human description of an offer, shared by the list / details / approvals screens. */
export function describeOffer(o: ProviderSpecialOffer, names: Map<string, string>): { meta: string; description: string } {
  const n = (id: string | null) => (id ? names.get(id) ?? 'نموذج غير منشور حالياً' : '—');
  if (o.type === 'BUNDLE') {
    return {
      meta: `باقة مرتبطة · ${n(o.primaryServiceId)} ← ${n(o.beneficiaryServiceId)}`,
      description: `إذا طلب العميل «${n(o.primaryServiceId)}» يحصل على خصم ${o.discountValue}% على «${n(o.beneficiaryServiceId)}» عند طلبه ضمن ${o.validityDays ?? '—'} يوماً.`,
    };
  }
  return {
    meta: `خصم نسبة · ${n(o.targetServiceId)}`,
    description: `خصم ${o.discountValue}% مباشر على نموذج «${n(o.targetServiceId)}».`,
  };
}

/** Tiny transient toast used by the marketing screens (`.toast` in marketing-shared.css). */
export class Flash {
  readonly message = signal<{ text: string; error: boolean } | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, error = false): void {
    this.message.set({ text, error });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.message.set(null), 3500);
  }
}

/** Provider's own marketplace models (ServiceCatalog rows) — the scope for coupons/offers. */
export function mapProviderModels(res: any): ProviderModelOption[] {
  const models = res?.data?.models;
  return Array.isArray(models) ? models.map((m: any) => ({ id: String(m.id), title: String(m.title ?? '') })) : [];
}
