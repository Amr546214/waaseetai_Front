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
		path: 'legal/users-services-contracts',
		loadComponent: () => import('./legal/legal-page.component').then(m => m.LegalPageComponent),
		data: { doc: 'lg-011' }
	},
	{
		path: 'legal/marketing-broker-commissions',
		loadComponent: () => import('./legal/legal-page.component').then(m => m.LegalPageComponent),
		data: { doc: 'lg-012' }
	},
	{
		path: 'legal/accreditation-ai-governance',
		loadComponent: () => import('./legal/legal-page.component').then(m => m.LegalPageComponent),
		data: { doc: 'lg-013' }
	},
	{
		path: 'legal/acceptable-use-ip',
		loadComponent: () => import('./legal/legal-page.component').then(m => m.LegalPageComponent),
		data: { doc: 'lg-014' }
	},
	{
		path: 'cookies',
		loadComponent: () => import('./cookies/cookies.component').then(m => m.CookiesComponent)
	},
	{
		path: 'support/help-center',
		loadComponent: () => import('./support/help-center/help-center.component').then(m => m.HelpCenterComponent)
	},
	{
		path: 'support/help-article/escrow',
		loadComponent: () => import('./support/help-article/help-article.component').then(m => m.HelpArticleComponent),
		data: { article: 'escrow' }
	},
	{
		path: 'support/help-article/disputes',
		loadComponent: () => import('./support/help-article/help-article.component').then(m => m.HelpArticleComponent),
		data: { article: 'disputes' }
	},
	{
		path: 'support/help-article/ai',
		loadComponent: () => import('./support/help-article/help-article.component').then(m => m.HelpArticleComponent),
		data: { article: 'ai' }
	},
	{
		path: 'support/help-article/commissions',
		loadComponent: () => import('./support/help-article/help-article.component').then(m => m.HelpArticleComponent),
		data: { article: 'commissions' }
	},
	{
		path: 'support/report-problem',
		loadComponent: () => import('./support/report-problem/report-problem.component').then(m => m.ReportProblemComponent)
	},
	{
		path: 'support/join-provider',
		loadComponent: () => import('./support/join-provider/join-provider.component').then(m => m.JoinProviderComponent)
	},
	{
		path: 'support/join-marketer',
		loadComponent: () => import('./support/join-marketer/join-marketer.component').then(m => m.JoinMarketerComponent)
	},
	{
		path: 'support/track-request',
		loadComponent: () => import('./support/track-request/track-request.component').then(m => m.TrackRequestComponent)
	}
]
