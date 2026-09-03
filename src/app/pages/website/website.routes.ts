import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { authGuard } from '../../core/guards/auth.guards';

export const WEBSITE_ROUTES: Routes = [
	{
		path: '',
		component: HomeComponent
	},
	{
		path: 'marketplace',
		loadComponent: () => import('./marketplace/marketplace').then(m => m.Marketplace)
	},
	{
		path: 'marketplace/:slug',
		loadComponent: () => import('./marketplace/slug/slug').then(m => m.Slug)
	},
	{
		path: 'marketplace/offer/:id',
		loadComponent: () => import('./marketplace/offer/offer').then(m => m.Offer)
	},
	{
		path: 'cart',
		loadComponent: () => import('./checkout/cart/cart').then(m => m.CartComponent)
	},
	{
		path: 'checkout/review',
		loadComponent: () => import('./checkout/review/review').then(m => m.CheckoutReviewComponent),
		canActivate: [authGuard]
	},
	{
		path: 'checkout/payment',
		loadComponent: () => import('./checkout/payment/payment').then(m => m.CheckoutPaymentComponent),
		canActivate: [authGuard]
	},
	{
		path: 'checkout/confirm',
		loadComponent: () => import('./checkout/confirm/confirm').then(m => m.CheckoutConfirmComponent),
		canActivate: [authGuard]
	},
	{
		path: 'checkout/success',
		loadComponent: () => import('./checkout/success/success').then(m => m.CheckoutSuccessComponent),
		canActivate: [authGuard]
	},
	{
		path: 'checkout/failure',
		loadComponent: () => import('./checkout/failure/failure').then(m => m.CheckoutFailureComponent),
		canActivate: [authGuard]
	},
	{
		path: 'custom-request',
		loadComponent: () => import('./checkout/custom-request/custom-request').then(m => m.CustomRequestComponent),
		canActivate: [authGuard]
	},
	{
		path: 'about',
		loadComponent: () => import('./about/about').then(m => m.About)
	},
	{
		path: 'blog',
		loadComponent: () => import('./blog/blog').then(m => m.Blog)
	},
	{
		path: 'contact',
		loadComponent: () => import('./contact/contact').then(m => m.Contact)
	},
	{
		path: 'provider-profile/:id',
		loadComponent: () => import('./marketplace/provider-profile/provider-profile').then(m => m.ProviderProfileComponent)
	},
	{
		path: 'privacy',
		loadComponent: () => import('./privacy/privacy.component').then(m => m.PrivacyComponent)
	},
	{
		path: 'terms',
		loadComponent: () => import('./terms/terms.component').then(m => m.TermsComponent)
	},
	{
		path: 'cookies',
		loadComponent: () => import('./cookies/cookies.component').then(m => m.CookiesComponent)
	}
]
