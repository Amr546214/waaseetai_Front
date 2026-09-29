import { ApiResponse } from './api.model';

/**
 * Marketing module (coupons, special offers, marketing center) — mirrors the
 * backend response shapes of:
 *   /api/provider/coupons           (provider-coupon.service.ts → format())
 *   /api/provider/special-offers    (provider-special-offer.service.ts → format())
 *   /api/provider/marketing/center  (marketing-center.service.ts → getCenter())
 */

/** Mirrors backend Prisma enum `MarketingApprovalStatus`. */
export type MarketingApprovalStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type CouponDiscountType = 'percentage' | 'fixed';

export interface ProviderCoupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumAmount: number | null;
  maxDiscount: number | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number;
  active: boolean;
  startAt: string;
  expiresAt: string | null;
  serviceIds: string[];
  excludedServiceIds: string[];
  internalNote: string | null;
  assignedToTeamMemberId: string | null;
  createdByTeamMemberId: string | null;
  approvalStatus: MarketingApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /provider/coupons (createCouponSchema). */
export interface CreateCouponPayload {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  serviceIds: string[];
  minimumAmount?: number | null;
  maxDiscount?: number | null;
  maxUses?: number | null;
  maxUsesPerUser?: number;
  startAt?: string;
  expiresAt?: string | null;
  excludedServiceIds?: string[];
  internalNote?: string | null;
  assignedToTeamMemberId?: string | null;
  createdByTeamMemberId?: string | null;
}

/** Body of PUT /provider/coupons/:id (updateCouponSchema — partial + active). */
export type UpdateCouponPayload = Partial<Omit<CreateCouponPayload, 'createdByTeamMemberId'>> & { active?: boolean };

export type SpecialOfferType = 'BUNDLE' | 'DIRECT_DISCOUNT';

export interface ProviderSpecialOffer {
  id: string;
  type: SpecialOfferType;
  name: string;
  primaryServiceId: string | null;
  beneficiaryServiceId: string | null;
  targetServiceId: string | null;
  discountValue: number;
  validityDays: number | null;
  startAt: string;
  expiresAt: string | null;
  badgeText: string;
  customerMessage: string | null;
  internalNote: string | null;
  active: boolean;
  usedCount: number;
  assignedToTeamMemberId: string | null;
  createdByTeamMemberId: string | null;
  approvalStatus: MarketingApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body of POST /provider/special-offers (createSpecialOfferSchema). */
export interface CreateSpecialOfferPayload {
  type: SpecialOfferType;
  name: string;
  primaryServiceId?: string | null;
  beneficiaryServiceId?: string | null;
  validityDays?: number | null;
  targetServiceId?: string | null;
  discountValue: number;
  startAt?: string;
  expiresAt?: string | null;
  badgeText: string;
  customerMessage?: string | null;
  internalNote?: string | null;
  assignedToTeamMemberId?: string | null;
  createdByTeamMemberId?: string | null;
}

export type UpdateSpecialOfferPayload = Partial<Omit<CreateSpecialOfferPayload, 'createdByTeamMemberId'>> & { active?: boolean };

/** Body of PATCH /provider/{coupons|special-offers}/:id/approval. */
export interface ApprovalDecisionPayload {
  decision: 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
}

// ---------------------------------------------------------------------------
// GET /provider/marketing/center
// ---------------------------------------------------------------------------

/** Mirrors `ToolStatus` in marketing-center.service.ts. */
export type MarketingToolStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'PENDING' | 'REJECTED';

export interface MarketingKpi {
  value: number;
  previousMonth: number;
  /** null when previous month is 0 (no baseline). */
  changePercent: number | null;
}

export interface MarketingToolSummary {
  total: number;
  active: number;
  paused: number;
  expired: number;
  pending: number;
  rejected: number;
}

export interface MarketingAssignee {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface MarketingTopTool {
  kind: 'COUPON' | 'OFFER';
  id: string;
  name: string;
  offerType: SpecialOfferType | null;
  maxUses: number | null;
  status: MarketingToolStatus;
  usageCount: number;
  discountedValue: number;
  lastUsedAt: string | null;
  /** Company accounts only. */
  assignedTo?: MarketingAssignee | null;
}

export interface MarketingTeamPerformanceRow {
  teamMemberId: string;
  name: string;
  avatarUrl: string | null;
  jobTitle: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE';
  activeCoupons: number;
  activeOffers: number;
  totalTools: number;
  usageCount: number;
  discountedValue: number;
}

export interface MarketingCompanyBlock {
  pendingApprovals: { count: number; coupons: number; offers: number };
  spendCap: {
    configured: boolean;
    cap: number | null;
    consumed: number;
    remaining: number | null;
    percentUsed: number | null;
    resetsAt: string;
  };
  teamPerformance: MarketingTeamPerformanceRow[];
}

export interface MarketingCenterData {
  accountType: string;
  period: { month: string; from: string; to: string };
  kpis: {
    activeTools: { count: number; coupons: number; offers: number; createdThisMonth: number };
    monthlyUsage: MarketingKpi;
    discountedValue: MarketingKpi;
    extraRevenue: MarketingKpi;
  };
  monthlyTrend: { month: string; usageCount: number; discountedValue: number; revenue: number }[];
  toolSummaries: { coupons: MarketingToolSummary; offers: MarketingToolSummary };
  topTools: MarketingTopTool[];
  /** Present only for PROVIDER_COMPANY accounts. */
  company?: MarketingCompanyBlock;
}

// ---------------------------------------------------------------------------
// GET /provider/coupons/:id/stats, GET /provider/special-offers/:id/stats,
// GET /provider/special-offers/summary (backend: marketing-stats.util.ts)
// ---------------------------------------------------------------------------

/** Rolling 7-day bucket, oldest first (6 buckets = "آخر 6 أسابيع"). */
export interface MarketingWeeklyPoint {
  weekStart: string;
  weekEnd: string;
  usageCount: number;
  discountedValue: number;
}

export interface MarketingStatsPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface MarketingRedemptionRow {
  redemptionId: string;
  orderId: string;
  orderNumber: string | null;
  orderStatus: string | null;
  customer: { id: string; name: string | null } | null;
  /** Order subtotal (before discount). */
  orderValue: number | null;
  discountApplied: number;
  /** Order total (after discount). */
  netValue: number | null;
  createdAt: string;
}

export interface CouponStats {
  id: string;
  totals: {
    usageCount: number;
    maxUses: number | null;
    discountedValue: number;
    /** Sum of linked order totals, each order once. */
    revenue: number;
    uniqueCustomers: number;
    repeatCustomers: number;
    /** Average order subtotal before discount; null when unused. */
    averageOrderValue: number | null;
    lastUsedAt: string | null;
  };
  weeklyTrend: MarketingWeeklyPoint[];
  redemptions: MarketingStatsPage<MarketingRedemptionRow>;
}

export interface OfferRedemptionRow extends MarketingRedemptionRow {
  /** The order's line item for the discounted model (Y for bundles, target for direct). */
  discountedItem: { serviceId: string | null; title: string; price: number } | null;
}

export interface SpecialOfferStats {
  id: string;
  type: SpecialOfferType;
  totals: {
    usageCount: number;
    discountedValue: number;
    revenue: number;
    /** Revenue of the discounted model's own line items on redeemed orders. */
    discountedServiceRevenue: number;
    uniqueCustomers: number;
    averageOrderValue: number | null;
    lastUsedAt: string | null;
  };
  weeklyTrend: MarketingWeeklyPoint[];
  redemptions: MarketingStatsPage<OfferRedemptionRow>;
  /** BUNDLE only (null for DIRECT_DISCOUNT). */
  bundle: {
    primaryServiceId: string;
    validityDays: number;
    primaryCustomers: number;
    convertedCustomers: number;
    /** Percent, one decimal; null when no customer ordered the primary model yet. */
    conversionRate: number | null;
  } | null;
}

export interface SpecialOffersSummary {
  bundleExtraRevenue: number;
  bundleOrders: number;
  bundleRedemptions: number;
}

export type CouponApiResponse = ApiResponse<ProviderCoupon>;
export type CouponListApiResponse = ApiResponse<ProviderCoupon[]>;
export type SpecialOfferApiResponse = ApiResponse<ProviderSpecialOffer>;
export type SpecialOfferListApiResponse = ApiResponse<ProviderSpecialOffer[]>;
export type MarketingCenterApiResponse = ApiResponse<MarketingCenterData>;
export type SpendCapApiResponse = ApiResponse<{ cap: number | null; configured: boolean }>;
export type CouponStatsApiResponse = ApiResponse<CouponStats>;
export type SpecialOfferStatsApiResponse = ApiResponse<SpecialOfferStats>;
export type SpecialOffersSummaryApiResponse = ApiResponse<SpecialOffersSummary>;
