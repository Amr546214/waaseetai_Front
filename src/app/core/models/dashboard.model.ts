export type ProjectStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISPUTED';
export type ProposalStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface DashboardStatsPayload {
  summary: {
    activeProjectsCount: number;
    newOffersCount: number;
    pendingOffersCount?: number;
    monthlyEarnings?: number;
    availableEarnings?: number;
    totalEscrowAmount: number;
    totalSpent: number;
    aiRating: number;
    humanRating: number;
    providerRating?: number;
    profileCompletionPercent: number;
    profileSetupCompleted?: boolean;
    setupTestCompleted?: boolean;
    hasApprovedSpecialties?: boolean;
    currentLevel: string;
    pointsToNextLevel: number;
    currentPoints: number;
  };
  // Batch 7: deterministic aggregate of the client's own proposals' real,
  // already-Gemini-computed aiPriceTag field — never fabricated, null when
  // the client has no proposals with AI price data yet.
  priceFairnessInsight?: {
    fairPricePercentage: number;
    evaluatedOffersCount: number;
    summaryText: string;
  } | null;
  topSteps: {
    step1_escrowRequiredCount: number;
    step2_pendingApprovalCount: number;
    step3_pendingProposalsCount: number;
  };
  latestProjects: Array<{
    id: string;
    title: string;
    budget: number;
    status: ProjectStatus;
    createdAt: Date;
  }>;
  aiMatchingProjects?: Array<{
    id: string;
    title: string;
    budget: number;
    specialty: string;
    // Batch 5: null — this /dashboard/stats list has no real score.
    aiMatchScore: number | null;
    matchReasons?: string[];
    aiAnalysis?: string;
    deliveryDays?: number;
    clientName?: string;
    createdAt: Date;
  }>;
  latestProposals: Array<{
    id: string;
    projectId: string;
    projectTitle: string;
    price: number;
    deliveryDays: number;
    aiMatchScore: number | null;
    providerName: string;
    // Batch 5 — the real gamification-derived provider level (same
    // resolver/source marketplace uses), never an accreditation badge.
    // null when the provider genuinely has no progression data.
    providerLevel?: string | null;
    status: ProposalStatus;
    createdAt: Date;
  }>;
}

export interface DashboardApiResponse {
  success: boolean;
  message: string;
  data: DashboardStatsPayload;
}
