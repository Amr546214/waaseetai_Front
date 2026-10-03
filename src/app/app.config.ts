import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { SOCIAL_AUTH_CONFIG, SocialAuthServiceConfig, GoogleLoginProvider } from '@abacritt/angularx-social-login';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
	providers: [
		provideBrowserGlobalErrorListeners(),
		provideRouter(routes, withInMemoryScrolling({
			scrollPositionRestoration: 'top',
			// Make /#fragment links (e.g. /#how-it-works) scroll to the element on load; the router otherwise ignores the hash.
			anchorScrolling: 'enabled'
		})),
		provideClientHydration(withEventReplay()),
		provideHttpClient(withFetch(), withInterceptors([loadingInterceptor, authInterceptor])),
		provideTranslateService({ lang: 'ar', fallbackLang: 'ar' }),
		{
			provide: SOCIAL_AUTH_CONFIG,
			useValue: {
				autoLogin: false,
				providers: [
					{
						id: GoogleLoginProvider.PROVIDER_ID,
						provider: new GoogleLoginProvider(environment.google_client_id, {
							oneTapEnabled: false,
							prompt: 'select_account'
						})
					}
				],
				onError: (err) => {
					console.error(err);
				}
			} as SocialAuthServiceConfig,
		}
	]
};
