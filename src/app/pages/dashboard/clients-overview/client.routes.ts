import { Routes } from "@angular/router";

export const CLIENT_OVERVIEW_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./client-overview/client-overview.component').then(m => m.ClientOverviewComponent),
		data: { title: "Client Dashboard" }
	},
	{
		path: 'create-request',
		loadComponent: () => import('./create-request/create-request').then(m => m.CreateRequest),
		data: { title: "Create New Request", assistantLift: true }
	},
	{
		path: 'my-requests',
		loadComponent: () => import('./my-request/my-request').then(m => m.MyRequest),
		data: { title: "My Requests" }
	},
	{
		path: 'my-requests/:id',
		loadComponent: () => import('./my-request/request-details/request-details').then(m => m.RequestDetails),
		data: { title: "Request Details", assistantLift: true }
	},
	{
		path: 'my-requests/:id/contract',
		loadComponent: () => import('./my-request/contract-signature/contract-signature').then(m => m.ContractSignature),
		data: { title: "توقيع العقد" }
	},
	{
		path: 'my-requests/:id/deposit',
		loadComponent: () => import('./my-request/escrow-deposit/escrow-deposit').then(m => m.EscrowDeposit),
		data: { title: "إيداع الضمان", assistantLift: true }
	},
	// projects
	{
		path: 'projects/active',
		loadComponent: () => import('./project/active-project/active-project').then(m => m.ActiveProject),
		data: { title: "Active Projects" }
	},
	// Batch 6 — these two routes used to be a fully mock, separate "employee
	// projects" sub-system. Investigation confirmed Employee Projects was
	// never meant to be a second project backend (design code
	// P-SK-014-موظفين-شركة is a company-mode VARIANT of the ordinary active
	// projects list, not a new surface) — real employee assignment is now
	// integrated into the canonical projects/active + projects/:id pages
	// (see active-project.ts / project-details.ts). These routes redirect
	// rather than disappear, so any existing bookmark/deep-link still lands
	// somewhere real and correct instead of 404ing.
	{
		path: 'projects/employee',
		redirectTo: 'projects/active'
	},
	{
		path: 'projects/employee/:id',
		redirectTo: (redirectData) => `/client-overview/projects/${redirectData.params['id']}`
	},
	//   help
	{
		path: 'help',
		loadComponent: () => import('./help/help').then(m => m.HelpComponent),
		data: { title: "مركز المساعدة" }
	},
	{
		path: 'help/ai-assistant',
		loadComponent: () => import('./help/ai-assistant/ai-assistant').then(m => m.AiAssistantComponent),
		data: { title: "المساعد الذكي" }
	},
	{
		path: 'help/live-support',
		loadComponent: () => import('./help/live-support/live-support').then(m => m.LiveSupportComponent),
		data: { title: "الدعم المباشر" }
	},
	{
		path: 'help/tickets',
		loadComponent: () => import('./help/tickets/tickets').then(m => m.TicketsComponent),
		data: { title: "تذاكر الدعم" }
	},
	{
		path: 'help/tickets/new',
		loadComponent: () => import('./help/new-ticket/new-ticket').then(m => m.NewTicketComponent),
		data: { title: "فتح تذكرة دعم" }
	},
	{
		path: 'help/tickets/:id',
		loadComponent: () => import('./help/ticket-detail/ticket-detail').then(m => m.TicketDetailComponent),
		data: { title: "تفاصيل التذكرة" }
	},
	{
		path: 'projects/review',
		loadComponent: () => import('./project/review-list/review-list').then(m => m.ReviewList),
		data: { title: "مراجعة التسليم" }
	},
	{
		path: 'projects/amendments',
		loadComponent: () => import('./project-modifications/project-modifications.component').then(m => m.ProjectModificationsComponent),
		data: { title: "طلبات تعديل المشاريع" }
	},
	{
		path: 'settings/account',
		loadComponent: () => import('./settings/account/account').then(m => m.Account),
		data: { title: "إعدادات الحساب" }
	},
	{
		path: 'projects/archived',
		loadComponent: () => import('./project/archived-projects/archived-projects').then(m => m.ArchivedProjects),
		data: { title: "Archived Projects" }
	},
	{
		path: 'projects/:id',
		loadComponent: () => import('./project/project-details/project-details').then(m => m.ProjectDetails),
		data: { title: "Project Details" }
	},
	{
		path: 'projects/:id/final-approval',
		loadComponent: () => import('./project/final-approval/final-approval').then(m => m.FinalApproval),
		data: { title: "الاعتماد النهائي وإغلاق المشروع" }
	},
	{
		path: 'projects/:id/rating',
		loadComponent: () => import('./project/rating-page/rating-page').then(m => m.RatingPage),
		data: { title: "تقييم مقدم الخدمة" }
	},
	{
		path: 'projects/:id/stages/:stageId/rating',
		loadComponent: () => import('./project/rating-page/rating-page').then(m => m.RatingPage),
		data: { title: "تقييم المرحلة" }
	},
	{
		path: 'projects/:id/delivery-review/:stageId',
		loadComponent: () => import('./project/delivery-review/delivery-review').then(m => m.DeliveryReview),
		data: { title: "مراجعة التسليم" }
	},
	{
		path: 'market',
		loadComponent: () => import('./market/market').then(m => m.Market),
		data: { title: "Market" }
	},
	{
		path: 'reports',
		loadComponent: () => import('./reports/reports').then(m => m.Reports),
		data: { title: "Reports" }
	},
	// finance
	{
		path: 'finance/wallet',
		loadComponent: () => import('./finance/wallet/wallet').then(m => m.Wallet),
		data: { title: "Wallet" }
	},
	{
		path: 'finance/transactions',
		redirectTo: 'finance/wallet'
	},
	{
		path: 'finance/transactions/:id',
		loadComponent: () => import('./finance/transaction-details/transaction-details').then(m => m.TransactionDetails),
		data: { title: "تفاصيل المعاملة" }
	},
	{
		path: 'finance/invoices',
		loadComponent: () => import('./finance/invoices/invoices').then(m => m.Invoices),
		data: { title: "Invoices" }
	},
	{
		path: 'finance/invoices/:id',
		loadComponent: () => import('./finance/invoice-details/invoice-details').then(m => m.InvoiceDetails),
		data: { title: "Invoice Details" }
	},

	// team management
	{
		path: 'team',
		loadComponent: () => import('./team/team-management.component').then(m => m.TeamManagementComponent),
		data: { title: "إدارة الفريق" }
	},
	{
		path: 'spending-limits',
		loadComponent: () => import('./spending-limits/spending-limits.component').then(m => m.SpendingLimitsComponent),
		data: { title: "نظام العقوبات وحدود الإنفاق" }
	},
	{
		path: 'project-modifications',
		loadComponent: () => import('./project-modifications/project-modifications.component').then(m => m.ProjectModificationsComponent),
		data: { title: "طلبات تعديل المشاريع" }
	},
	{
		path: 'request-approvals',
		loadComponent: () => import('./request-approvals/request-approvals.component').then(m => m.RequestApprovalsComponent),
		data: { title: "اعتماد الطلبات" }
	},
	// disputes
	{
		path: 'disputes',
		loadComponent: () => import('./disputes/disputes').then(m => m.Disputes),
		data: { title: "النزاعات" }
	},

	// profile
	{
		path: 'profile',
		loadComponent: () => import('./profile/profile').then(m => m.Profile),
		data: { title: "Profile" }
	},
	{
		path: 'profile/edit',
		loadComponent: () => import('./profile/profile-edit/profile-edit').then(m => m.ProfileEdit),
		data: { title: "تعديل الملف الشخصي" }
	},
	{
		path: 'profile-setup',
		loadComponent: () => import('./profile/profile-setup/profile-setup').then(m => m.ProfileSetupDashboard),
		data: { title: "استكمال البيانات" }
	},
	{
		path: 'profile/requests',
		loadComponent: () => import('./profile/profile-requests/profile-requests').then(m => m.ProfileRequests),
		data: { title: "طلبات تعديل الملف" }
	},
	{
		path: 'profile/logs',
		loadComponent: () => import('./profile/profile-logs/profile-logs').then(m => m.ProfileLogs),
		data: { title: "سجل إجراءات الحساب" }
	},
	{
		path: 'profile/level',
		loadComponent: () => import('./profile/profile-level/profile-level').then(m => m.ProfileLevel),
		data: { title: "مستوى التصنيف" }
	},
	{
		path: 'profile/add-account',
		loadComponent: () => import('./profile/add-account/add-account').then(m => m.AddAccount),
		data: { title: "إضافة حساب" }
	},
	// notifications
	{
		path: 'notifications',
		loadComponent: () => import('./notifications/notifications-center/notifications-center').then(m => m.NotificationsCenter),
		data: { title: "Notifications Center" }
	},
	{
		path: 'notifications/settings',
		loadComponent: () => import('./notifications/notifications-settings/notifications-settings').then(m => m.NotificationsSettings),
		data: { title: "Notifications Settings" }
	},
	// messages
	{
		path: 'messages',
		loadComponent: () => import('./messages/messages').then(m => m.ClientMessages),
		data: { title: "Messages" }
	},
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة" }
	}
];
