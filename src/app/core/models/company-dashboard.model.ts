export interface CompanyDashboardKpis {
	remainingBudget: number;
	activeEmployees: number;
	activeEmployeesTotal: number;
	quarterSpend: number;
	activeTeamProjects: number;
	activeTeamProjectsMembers: number;
	pendingYourApproval: number;
}

export interface CompanyQuarterBudget {
	used: number;
	total: number;
	percent: number;
}

export interface CompanyActionCard {
	key: 'budget-overrun' | 'delivery-approval' | 'request-approval';
	count: number;
	label: string;
}

export interface CompanyLevelProgress {
	points: number;
	nextLevelPoints: number;
	currentLevel: number;
	levelLabel: string;
}

export interface CompanyEmployeeSpending {
	employeeName: string;
	amount: number;
}

export interface CompanyPendingApproval {
	id: string;
	title: string;
	requesterName: string;
	requesterInitials: string;
	amount: number;
	overBudget: boolean;
}

export interface CompanyTeamRequest {
	id: string;
	title: string;
	requesterName: string;
	department: string;
	amount: number;
	status: 'approved' | 'pending-approval' | 'new-offers' | 'completed';
	offersCount?: number;
}

export interface CompanyActivityItem {
	actorName: string;
	actorInitials: string;
	action: string;
	highlight?: string;
	timeLabel: string;
}

export interface CompanyDashboardData {
	companyName: string;
	companyBadge: string;
	profileCompletionPercent: number;
	kpis: CompanyDashboardKpis;
	quarterBudget: CompanyQuarterBudget;
	actionCards: CompanyActionCard[];
	levelProgress: CompanyLevelProgress;
	walletBalance: number;
	employeeSpending: CompanyEmployeeSpending[];
	aiInsight: string;
	pendingApprovals: CompanyPendingApproval[];
	recentTeamRequests: CompanyTeamRequest[];
	recentActivity: CompanyActivityItem[];
	pendingProfileCompletionRequired: boolean;
}

export interface CompanyDashboardApiResponse {
	success: boolean;
	data: CompanyDashboardData;
}
