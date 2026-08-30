import { Routes } from "@angular/router";
import { guestGuard, verificationGuard } from '../../core/guards/auth.guards';

export const AUTH_ROUTES: Routes = [
	{
		path: '',
		children: [
			{
				path: 'login',
				canActivate: [guestGuard],
				loadComponent: () => import('./login/login').then(m => m.Login),
			},
			{
				path: 'register',
				canActivate: [guestGuard],
				loadComponent: () => import('./register/register').then(m => m.Register),
			},
			{
				path: 'forget-password',
				canActivate: [guestGuard],
				loadComponent: () => import('./rest-password/rest-password').then(m => m.RestPassword),
			},
			{
				path: 'verify-otp',
				canActivate: [verificationGuard],
				loadComponent: () => import('./verify-otp/verify-otp').then(m => m.VerifyOtp),
			}

		]
	},
	// default redirect
	{
		path: '**',
		redirectTo: 'login'
	}
];
