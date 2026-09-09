import { Routes } from "@angular/router";
import { ClientOverviewComponent } from "./client-overview/client-overview.component";
import { CreateRequest } from "./create-request/create-request";
import { MyRequest } from "./my-request/my-request";
import { ActiveProject } from "./project/active-project/active-project";
import { Market } from "./market/market";
import { Wallet } from "./finance/wallet/wallet";
import { Transactions } from "./finance/transactions/transactions";
import { NotificationsCenter } from "./notifications/notifications-center/notifications-center";
import { NotificationsSettings } from "./notifications/notifications-settings/notifications-settings";
import { ClientMessages } from "./messages/messages";
import { Profile } from "./profile/profile";
import { Invoices } from "./finance/invoices/invoices";

export const CLIENT_OVERVIEW_ROUTES: Routes = [
	{
		path: '',
		component: ClientOverviewComponent,
		data: { title: "Client Dashboard" }
	},
	{
		path: 'create-request',
		component: CreateRequest,
		data: { title: "Create New Request" }
	},
	{
		path: 'my-requests',
		component: MyRequest,
		data: { title: "My Requests" }
	},
	{
		path: 'my-requests/:id',
		loadComponent: () => import('./my-request/request-details/request-details').then(m => m.RequestDetails),
		data: { title: "Request Details" }
	},
	{
		path: 'my-requests/:id/contract',
		loadComponent: () => import('./my-request/contract-signature/contract-signature').then(m => m.ContractSignature),
		data: { title: "توقيع العقد" }
	},
	{
		path: 'my-requests/:id/deposit',
		loadComponent: () => import('./my-request/escrow-deposit/escrow-deposit').then(m => m.EscrowDeposit),
		data: { title: "إيداع الضمان" }
	},
	// projects
	{
		path: 'projects/active',
		component: ActiveProject,
		data: { title: "Active Projects" }
	},
	//   help
	{
		path: 'help',
		loadComponent: () => import('./help/help').then(m => m.HelpComponent),
		data: { title: "Help" }
	},
	{
		path: 'projects/review',
		redirectTo: 'projects/active',
		pathMatch: 'full'
	},
	{
		path: 'projects/amendments',
		redirectTo: 'projects/active',
		pathMatch: 'full'
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
		path: 'projects/:id/delivery-review/:stageId',
		loadComponent: () => import('./project/delivery-review/delivery-review').then(m => m.DeliveryReview),
		data: { title: "مراجعة التسليم" }
	},
	{
		path: 'market',
		component: Market,
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
		component: Wallet,
		data: { title: "Wallet" }
	},
	{
		path: 'finance/transactions',
		component: Transactions,
		data: { title: "Transactions" }
	},
	{
		path: 'finance/invoices',
		component: Invoices,
		data: { title: "Invoices" }
	},
	{
		path: 'finance/invoices/:id',
		loadComponent: () => import('./finance/invoice-details/invoice-details').then(m => m.InvoiceDetails),
		data: { title: "Invoice Details" }
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
		component: Profile,
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
		component: NotificationsCenter,
		data: { title: "Notifications Center" }
	},
	{
		path: 'notifications/settings',
		component: NotificationsSettings,
		data: { title: "Notifications Settings" }
	},
	// messages
	{
		path: 'messages',
		component: ClientMessages,
		data: { title: "Messages" }
	},
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة" }
	}
];
