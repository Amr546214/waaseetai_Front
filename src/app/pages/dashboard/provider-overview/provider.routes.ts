import { Routes } from "@angular/router";
import { ProviderOverview } from "./provider-overview/provider-overview";
import { quizLockGuard } from "../../../core/guards/quiz-lock.guard";

export const PROVIDER_OVERVIEW_ROUTES: Routes = [
	{
		path: '',
		component: ProviderOverview,
		data: { title: "لوحة التحكم" }
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
		data: { title: "تقديم عرض" }
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
		path: 'projects/progress/:id',
		loadComponent: () => import('./projects/active/progress/progress').then(m => m.Progress),
		data: { title: "متابعة المشروع" }
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
		path: 'business-models/center',
		loadComponent: () => import('./business-models/center/center').then(m => m.Center),
		data: { title: "مركز النماذج والخدمات" }
	},
	{
		path: 'business-models/new-project',
		loadComponent: () => import('./business-models/new-project/new-project').then(m => m.NewProject),
		data: { title: "رفع مشروع للسوق" }
	},
	{
		path: 'business-models/market',
		loadComponent: () => import('./business-models/market/market').then(m => m.Market),
		data: { title: "نماذجي في السوق" }
	},
	{
		path: 'business-models/accreditation/new',
		loadComponent: () => import('./business-models/accreditation/new/new').then(m => m.New),
		data: { title: "رفع نموذج للاعتماد" }
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
		data: { title: "استكمال البيانات" }
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
	}
];
