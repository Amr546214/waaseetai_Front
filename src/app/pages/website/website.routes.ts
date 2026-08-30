import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';

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
