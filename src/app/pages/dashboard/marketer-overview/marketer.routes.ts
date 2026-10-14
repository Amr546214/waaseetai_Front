import { Routes } from '@angular/router';
import { marketerPrefsGuard } from '../../../core/services/marketer-prefs.store';
import { marketerSetupGuard } from './profile/profile-setup/profile-setup.guard';

const MARKETER_PAGES: Routes = [
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
		path: 'assets',
		loadComponent: () => import('./assets/assets').then(m => m.MarketerAssets),
		data: { title: "المواد التسويقية" }
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
		path: 'help/tickets',
		redirectTo: 'help',
		pathMatch: 'full'
	},
	{
		path: 'help/tickets/:id',
		loadComponent: () => import('./help/ticket-detail/ticket-detail').then(m => m.MarketerTicketDetail),
		data: { title: "تفاصيل التذكرة" }
	},
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة", hideAssistant: true, embedded: true }
	}
];

// Every marketer page opens through the prefs guard (it loads the saved timezone once)
export const MARKETER_ROUTES: Routes = [
	{ path: '', canActivateChild: [marketerPrefsGuard], children: MARKETER_PAGES }
];
