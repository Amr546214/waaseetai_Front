import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './pages/auth/auth.routes';
import { authGuard, clientGuard, providerGuard, marketerGuard, superAdminGuard } from './core/guards/auth.guards';
import { WEBSITE_ROUTES } from './pages/website/website.routes';
import { CLIENT_OVERVIEW_ROUTES } from './pages/dashboard/clients-overview/client.routes';
import { PROVIDER_OVERVIEW_ROUTES } from './pages/dashboard/provider-overview/provider.routes';
import { MARKETER_ROUTES } from './pages/dashboard/marketer-overview/marketer.routes';
import { SUPPER_ADMIN_ROUTES } from './pages/dashboard/supper-admin-overview/supper-admin.routes';

export const routes: Routes = [
	{
		path: '',
		loadComponent: () => import('./layouts/website-layout/website-layout.component').then(m => m.WebsiteLayoutComponent),
		children: WEBSITE_ROUTES
	},
	// auth
	{
		path: 'auth',
		loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayoutComponent),
		children: AUTH_ROUTES,
	},

	{
		path: 'client-overview',
		canActivate: [authGuard, clientGuard],
		loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
		children: CLIENT_OVERVIEW_ROUTES
	},
	{
		path: 'provider-overview',
		canActivate: [authGuard, providerGuard],
		loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
		children: PROVIDER_OVERVIEW_ROUTES
	},
	{
		path: 'marketer-overview',
		canActivate: [authGuard, marketerGuard],
		loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
		children: MARKETER_ROUTES
	},
	// supper admin
	{
		path: 'supper-admin-overview',
		canActivate: [authGuard, superAdminGuard],
		loadComponent: () => import('./layouts/dashboard-layout/dashboard-layout').then(m => m.DashboardLayoutComponent),
		children: SUPPER_ADMIN_ROUTES
	},
	{
		path: '**',
		loadComponent: () => import('./sheards/not-found/not-found').then(m => m.NotFoundComponent)
	}
];
