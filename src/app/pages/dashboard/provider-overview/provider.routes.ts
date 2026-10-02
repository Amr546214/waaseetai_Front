import { Routes } from "@angular/router";
import { quizLockGuard } from "../../../core/guards/quiz-lock.guard";
import { companyAccountGuard } from "../../../core/guards/company-account.guard";

export const PROVIDER_OVERVIEW_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./provider-overview/provider-overview').then(m => m.ProviderOverview),
		data: { title: "لوحة التحكم", allowIncompleteProfile: true }
	},
	{
		path: 'messages',
		loadComponent: () => import('./messages/messages').then(m => m.ProviderMessages),
		data: { title: "الرسائل" }
	},
	{
		path: 'explore-requests',
		loadComponent: () => import('./explore-requests/explore-requests').then(m => m.ExploreRequests),
		data: { title: "تصفح الطلبات" }
	},
	{
		path: 'explore-requests/:id/apply',
		loadComponent: () => import('./explore-requests/applay-request/applay-request').then(m => m.ApplayRequest),
		data: { title: "تقديم عرض", assistantLift: true }
	},
	{
		path: 'disputes',
		loadComponent: () => import('./disputes/disputes').then(m => m.Disputes),
		data: { title: "النزاعات" }
	},
	{
		path: 'reports',
		loadComponent: () => import('./reports/reports').then(m => m.Reports),
		data: { title: "تقاريري" }
	},
	{
		path: 'offers',
		loadComponent: () => import('./offers/offers').then(m => m.Offers),
		data: { title: "عروضي" }
	},
	{
		path: 'offers/:id/sign-contract',
		loadComponent: () => import('./offers/sign-contract/sign-contract').then(m => m.SignContract),
		data: { title: "توقيع العقد" }
	},
	{
		path: 'offers/:id/negotiate',
		loadComponent: () => import('./offers/negotiate/negotiate').then(m => m.OfferNegotiate),
		data: { title: "التفاوض على العرض" }
	},
	{
		path: 'projects/progress/:id',
		loadComponent: () => import('./projects/active/progress/progress').then(m => m.Progress),
		data: { title: "متابعة المشروع" }
	},
	{
		path: 'projects/:id/rating',
		loadComponent: () => import('./projects/rating-page/provider-rating-page').then(m => m.ProviderRatingPage),
		data: { title: "تقييم العميل" }
	},
	{
		path: 'projects/active',
		loadComponent: () => import('./projects/active/active').then(m => m.Active),
		data: { title: "المشاريع النشطة" }
	},
	{
		path: 'projects/archived',
		loadComponent: () => import('./projects/archived/archived').then(m => m.Archived),
		data: { title: "المشاريع المكتملة والأرشيف" }
	},
	{
		path: 'projects/active/progress/:id',
		loadComponent: () => import('./projects/active/progress/progress').then(m => m.Progress),
		data: { title: "متابعة المشروع" }
	},
	{
		path: 'projects/active/delivery-review/:id',
		loadComponent: () => import('./projects/active/delivery-review/delivery-review').then(m => m.DeliveryReview),
		data: { title: "مراجعة التسليم والإغلاق" }
	},
	{
		path: 'projects/phases',
		redirectTo: 'projects/active',
		pathMatch: 'full'
	},
	{
		path: 'finance/wallet',
		loadComponent: () => import('./finance/wallet/wallet').then(m => m.Wallet),
		data: { title: "محفظتي" }
	},
	{
		path: 'finance/withdraw',
		loadComponent: () => import('./finance/withdraw/withdraw').then(m => m.Withdraw),
		data: { title: "سحب الأرباح" }
	},
	{
		path: 'finance/transactions',
		loadComponent: () => import('./finance/transactions/transactions').then(m => m.Transactions),
		data: { title: "سجل المعاملات" }
	},
	{
		path: 'finance/transactions/:id',
		loadComponent: () => import('./finance/transaction-details/transaction-details').then(m => m.TransactionDetails),
		data: { title: "تفاصيل المعاملة" }
	},
	{
		path: 'finance/invoices',
		loadComponent: () => import('./finance/invoices/invoices').then(m => m.InvoicesComponent),
		data: { title: "فواتير مشاريعي" }
	},
	{
		path: 'business-models/center',
		loadComponent: () => import('./business-models/center/center').then(m => m.Center),
		data: { title: "مركز النماذج والخدمات" }
	},
	{
		path: 'business-models/new-project',
		loadComponent: () => import('./business-models/new-project/new-project').then(m => m.NewProject),
		data: { title: "رفع مشروع للسوق", assistantLift: true }
	},
	{
		path: 'business-models/market',
		loadComponent: () => import('./business-models/market/market').then(m => m.Market),
		data: { title: "نماذجي في السوق" }
	},
	{
		path: 'business-models/market/:id',
		loadComponent: () => import('./business-models/market/model-details/model-details').then(m => m.ModelDetails),
		data: { title: "تفاصيل النموذج" }
	},
	{
		path: 'business-models/accreditation/new',
		loadComponent: () => import('./business-models/accreditation/new/new').then(m => m.New),
		data: { title: "رفع نموذج للاعتماد", assistantLift: true }
	},
	// AccreditationDetails by id
	{
		path: 'business-models/center/accreditation-details/:id',
		loadComponent: () => import('./business-models/center/accreditation-details/accreditation-details').then(m => m.AccreditationDetails),
		data: { title: "تفاصيل الاعتماد" }
	},
	{
		path: 'business-models/accreditation/list',
		loadComponent: () => import('./business-models/accreditation/list/list').then(m => m.List),
		data: { title: "طلبات الاعتماد" }
	},
	{
		path: 'disputes',
		loadComponent: () => import('./disputes/disputes').then(m => m.Disputes),
		data: { title: "النزاعات" }
	},
	{
		path: 'disputes/:id',
		loadComponent: () => import('./disputes/dispute-details/dispute-details').then(m => m.DisputeDetails),
		data: { title: "تفاصيل النزاع" }
	},
	{
		path: 'profile/public',
		loadComponent: () => import('./profile/public/public').then(m => m.Public),
		data: { title: "الملف العام" }
	},
	{
		path: 'profile/data',
		loadComponent: () => import('./profile/data/data').then(m => m.Data),
		data: { title: "تعديل الملف المهني" }
	},
	{
		path: 'profile/requests',
		loadComponent: () => import('./profile/requests/requests').then(m => m.Requests),
		data: { title: "طلبات تعديل الملف" }
	},
	{
		path: 'profile/specialties',
		loadComponent: () => import('./profile/specialties/specialties').then(m => m.Specialties),
		canDeactivate: [quizLockGuard],
		data: { title: "إدارة التخصصات" }
	},
	{
		path: 'profile/setup',
		loadComponent: () => import('./profile/profile-setup/profile-setup').then(m => m.ProfileSetupDashboard),
		data: { title: "استكمال البيانات", allowIncompleteProfile: true }
	},
	{
		path: 'profile/level',
		loadComponent: () => import('./profile/level/level').then(m => m.Level),
		data: { title: "مستوى التصنيف" }
	},
	{
		path: 'profile/logs',
		loadComponent: async () => (await import('./profile/logs/logs')).Logs,
		data: { title: "سجل إجراءات الحساب" }
	},
	{
		path: 'profile/add-account',
		loadComponent: () => import('./profile/add-account/add-account').then(m => m.AddAccount),
		data: { title: "إضافة حساب" }
	},
	{
		path: 'notifications',
		loadComponent: () => import('./notifications/notifications').then(m => m.Notifications),
		data: { title: "مركز الإشعارات" }
	},
	{
		path: 'notifications/favorite',
		loadComponent: () => import('./notifications/favorite/favorite').then(m => m.Favorite),
		data: { title: "المفضلة" }
	},
	{
		path: 'settings/account',
		loadComponent: () => import('./settings/account/account').then(m => m.Account),
		data: { title: "إعدادات الحساب" }
	},
	{
		path: 'help',
		loadComponent: () => import('./help/help').then(m => m.Help),
		data: { title: "مركز المساعدة" }
	},
	{
		path: 'help/ai-assistant',
		loadComponent: () => import('./help/ai-assistant/ai-assistant').then(m => m.ProviderAiAssistantComponent),
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
	// business-models extensions
	{
		path: 'business-models/service-edit',
		loadComponent: () => import('./business-models/service-edit/service-edit.component').then(m => m.ServiceEditComponent),
		data: { title: "تعديل الخدمة" }
	},
	{
		path: 'business-models/negotiation',
		loadComponent: () => import('./business-models/negotiation/negotiation.component').then(m => m.NegotiationComponent),
		data: { title: "تفاوض طلب خدمة" }
	},
	{
		path: 'business-models/customer-requests',
		loadComponent: () => import('./business-models/customer-requests/customer-requests.component').then(m => m.CustomerRequestsComponent),
		data: { title: "طلبات العملاء" }
	},
	{
		path: 'business-models/sales-tracking',
		loadComponent: () => import('./business-models/sales-tracking/sales-tracking.component').then(m => m.SalesTrackingComponent),
		data: { title: "متابعة المبيعات" }
	},
	// Marketing (P-PR-039..041 / P-CO-MK-005..008) — sibling of business-models,
	// one component per screen shared by individual + company accounts.
	{
		path: 'marketing',
		redirectTo: 'marketing/center',
		pathMatch: 'full'
	},
	{
		path: 'marketing/center',
		loadComponent: () => import('./marketing/center/center').then(m => m.MarketingCenter),
		data: { title: "مركز التسويق" }
	},
	{
		path: 'marketing/coupons',
		loadComponent: () => import('./marketing/coupons/coupons').then(m => m.MarketingCoupons),
		data: { title: "كوبونات الخصم" }
	},
	{
		path: 'marketing/coupons/new',
		loadComponent: () => import('./marketing/coupon-form/coupon-form').then(m => m.MarketingCouponForm),
		data: { title: "كوبون خصم جديد" }
	},
	{
		path: 'marketing/coupons/:id/edit',
		loadComponent: () => import('./marketing/coupon-form/coupon-form').then(m => m.MarketingCouponForm),
		data: { title: "تعديل الكوبون" }
	},
	{
		path: 'marketing/coupons/:id',
		loadComponent: () => import('./marketing/coupon-details/coupon-details').then(m => m.MarketingCouponDetails),
		data: { title: "إحصائيات الكوبون" }
	},
	{
		path: 'marketing/offers',
		loadComponent: () => import('./marketing/offers/offers').then(m => m.MarketingOffers),
		data: { title: "العروض الخاصة" }
	},
	{
		path: 'marketing/offers/new',
		loadComponent: () => import('./marketing/offer-form/offer-form').then(m => m.MarketingOfferForm),
		data: { title: "عرض خاص جديد" }
	},
	{
		path: 'marketing/offers/:id/edit',
		loadComponent: () => import('./marketing/offer-form/offer-form').then(m => m.MarketingOfferForm),
		data: { title: "تعديل العرض" }
	},
	{
		path: 'marketing/offers/:id',
		loadComponent: () => import('./marketing/offer-details/offer-details').then(m => m.MarketingOfferDetails),
		data: { title: "إحصائيات العرض" }
	},
	{
		path: 'marketing/approvals',
		// Company accounts only — individual providers are redirected to the marketing center.
		canActivate: [companyAccountGuard],
		loadComponent: () => import('./marketing/approvals/approvals').then(m => m.MarketingApprovals),
		data: { title: "طلبات الموافقة", companyFallback: '/provider-overview/marketing/center' }
	},
	// HR management
	{
		path: 'hr',
		loadComponent: () => import('./hr/provider-hr.component').then(m => m.ProviderHrComponent),
		data: { title: "إدارة الموارد البشرية" }
	},
	// Company screens
	{
		path: 'company/official-invoices',
		loadComponent: () => import('./company/official-invoices/official-invoices.component').then(m => m.OfficialInvoicesComponent),
		data: { title: "الفواتير الرسمية" }
	},
	{
		path: 'company/incoming-requests',
		loadComponent: () => import('./company/incoming-requests/incoming-requests.component').then(m => m.IncomingRequestsComponent),
		data: { title: "طلبات السوق الواردة" }
	},
	{
		path: 'company/sales-stats',
		loadComponent: () => import('./company/sales-stats/sales-stats.component').then(m => m.SalesStatsComponent),
		data: { title: "إحصائيات المبيعات" }
	},
	{
		path: 'company/change-orders',
		loadComponent: () => import('./company/change-orders/change-orders.component').then(m => m.ChangeOrdersComponent),
		data: { title: "أوامر التغيير" }
	},
	{
		path: 'company/team-management',
		loadComponent: () => import('./company/team-management/team-management.component').then(m => m.CompanyTeamManagementComponent),
		data: { title: "إدارة الفريق" }
	},
	{
		path: 'company/roles-permissions',
		loadComponent: () => import('./company/roles-permissions/roles-permissions.component').then(m => m.RolesPermissionsComponent),
		data: { title: "الأدوار والصلاحيات" }
	},
	{
		path: 'company/models',
		loadComponent: () => import('./company/company-models/company-models').then(m => m.CompanyModels),
		data: { title: "نماذج الشركة" }
	},
	{
		path: 'company/team-deliveries',
		loadComponent: () => import('./company/team-deliveries/team-deliveries').then(m => m.TeamDeliveries),
		data: { title: "سجل تسليمات الفريق" }
	},
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة", hideAssistant: true, embedded: true }
	}
];
