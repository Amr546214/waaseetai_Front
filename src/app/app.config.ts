import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { providerGateInterceptor } from './core/interceptors/provider-gate.interceptor';
import { maintenanceInterceptor } from './core/interceptors/maintenance.interceptor';
import { PlatformInfoService } from './core/services/platform-info.service';
import { platformDateOffset } from './core/utils/regional';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { getCacheInterceptor } from './core/interceptors/get-cache.interceptor';
import { rateLimitInterceptor } from './core/interceptors/rate-limit.interceptor';
import { errorMessageInterceptor } from './core/interceptors/error-message.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { adminAccessInterceptor } from './core/interceptors/admin-access.interceptor';
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
		provideHttpClient(withFetch(), withInterceptors([adminAccessInterceptor, errorMessageInterceptor, loadingInterceptor, providerGateInterceptor, authInterceptor, getCacheInterceptor, rateLimitInterceptor, maintenanceInterceptor])),
		provideTranslateService({ lang: 'ar', fallbackLang: 'ar' }),
		// the platform's regional settings are read once at start (never blocks longer than ~1.5 s, never fails the app): every date pipe then shows times in the platform zone
		// (the provider / marketer areas override this with the user's own saved zone, see app.routes.ts)
		provideAppInitializer(() => inject(PlatformInfoService).loadOnce()),
		{ provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { get timezone() { return platformDateOffset(); } } },
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
