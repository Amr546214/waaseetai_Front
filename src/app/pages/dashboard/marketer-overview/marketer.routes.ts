import { Routes } from '@angular/router';
import { marketerSetupGuard } from './profile/profile-setup/profile-setup.guard';

export const MARKETER_ROUTES: Routes = [
	{
		path: '',
		loadComponent: () => import('./marketing-broker-overview/marketing-broker-overview').then(m => m.MarketingBrokerOverview),
		data: { title: "لوحة التحكم" }
	},
	{
		path: 'referrals',
		loadComponent: () => import('./referrals/referrals').then(m => m.Referrals),
		data: { title: "الإحالات" }
	},
	{
		path: 'ref-links',
		loadComponent: () => import('./ref-links/ref-links').then(m => m.RefLinks),
		data: { title: "روابط الإحالة" }
	},
	{
		path: 'commissions',
		loadComponent: () => import('./commissions/commissions').then(m => m.Commissions),
		data: { title: "العمولات" }
	},
	{
		path: 'withdraw',
		loadComponent: () => import('./withdraw/withdraw').then(m => m.Withdraw),
		data: { title: "السحب" }
	},
	{
		path: 'profile',
		children: [
			{
				path: 'data',
				loadComponent: () => import('./profile/data/data').then(m => m.Data),
				data: { title: "ملفي التسويقي" }
			},
			{
				path: 'public',
				loadComponent: () => import('./profile/public/public').then(m => m.Public),
				data: { title: "الملف العام" }
			},
			{
				path: 'requests',
				loadComponent: () => import('./profile/requests/requests').then(m => m.Requests),
				data: { title: "طلبات التعديل" }
			},
			{
				path: 'add-account',
				loadComponent: () => import('./profile/add-account/add-account').then(m => m.AddAccount),
				data: { title: "إضافة حساب" }
			}
		]
	},
	{
		path: 'profile-setup',
		canActivate: [marketerSetupGuard],
		loadComponent: () => import('./profile/profile-setup/profile-setup').then(m => m.ProfileSetup),
		data: { title: "استكمال البيانات" }
	},
	{
		path: 'notifications',
		loadComponent: () => import('./notifications/notifications').then(m => m.Notifications),
		data: { title: "الإشعارات" }
	},
	{
		path: 'messages',
		loadComponent: () => import('./messages/messages').then(m => m.MarketerMessages),
		data: { title: "الرسائل" }
	},
	{
		path: 'help',
		loadComponent: () => import('./help/help').then(m => m.Help),
		data: { title: "المساعدة" }
	},
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة", hideAssistant: true, embedded: true }
	}
];
