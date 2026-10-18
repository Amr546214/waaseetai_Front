import { Routes } from '@angular/router';
import { inject, provideEnvironmentInitializer } from '@angular/core';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { ProviderPrefsStore } from './core/services/provider-prefs.store';
import { AUTH_ROUTES } from './pages/auth/auth.routes';
import { authGuard, clientGuard, providerGuard, marketerGuard, superAdminGuard } from './core/guards/auth.guards';
import { providerProfileCompleteGuard } from './core/guards/profile-complete.guard';
import { WEBSITE_ROUTES } from './pages/website/website.routes';
import { CLIENT_OVERVIEW_ROUTES } from './pages/dashboard/clients-overview/client.routes';
import { PROVIDER_OVERVIEW_ROUTES } from './pages/dashboard/provider-overview/provider.routes';
import { MARKETER_ROUTES } from './pages/dashboard/marketer-overview/marketer.routes';
import { SUPPER_ADMIN_ROUTES } from './pages/dashboard/supper-admin-overview/supper-admin.routes';

export const routes: Routes = [
	{ path: 'assistant', canActivate: [authGuard], data: { hideAssistant: true }, loadComponent: () => import('./pages/assistant/assistant-page').then(m => m.AssistantPageComponent) },
	{
		path: '',
		loadComponent: () => import('./layouts/website-layout/website-layout.component').then(m => m.WebsiteLayoutComponent),
		children: WEBSITE_ROUTES
	},
	// auth
	{
		path: 'auth',
		loadComponent: () => import('./layouts/auth-layout/auth-layout').then(m => m.AuthLayoutComponent),
		data: { hideAssistant: true },
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
		canActivateChild: [providerProfileCompleteGuard],
		// re-ask the backend on every navigation under the provider area, in-app ones (after login/logout/role switch) included
		runGuardsAndResolvers: 'always',
		// every DatePipe in the provider area shows dates in the zone the provider saved on the profile page (browser zone until one is saved)
		providers: [
			// the saved zone is loaded as soon as the provider area opens (not only when a DatePipe happens to be created), so hand-formatted dates see it too
			provideEnvironmentInitializer(() => inject(ProviderPrefsStore).ensureLoaded()),
			{
				provide: DATE_PIPE_DEFAULT_OPTIONS,
				useFactory: () => { const prefs = inject(ProviderPrefsStore); return { get timezone() { return prefs.dateOffset; } }; }
			}
		],
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
		path: 'error/500',
		loadComponent: () => import('./pages/system-errors/error-page/error-page').then(m => m.ErrorPageComponent),
		data: { type: '500', hideAssistant: true }
	},
	{
		path: 'error/403',
		loadComponent: () => import('./pages/system-errors/error-page/error-page').then(m => m.ErrorPageComponent),
		data: { type: '403', hideAssistant: true }
	},
	{
		path: 'error/maintenance',
		loadComponent: () => import('./pages/system-errors/error-page/error-page').then(m => m.ErrorPageComponent),
		data: { type: 'maintenance', hideAssistant: true }
	},
	{
		path: 'error/session-expired',
		loadComponent: () => import('./pages/system-errors/error-page/error-page').then(m => m.ErrorPageComponent),
		data: { type: 'session-expired', hideAssistant: true }
	},
	{
		path: '**',
		loadComponent: () => import('./sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { hideAssistant: true }
	}
];
