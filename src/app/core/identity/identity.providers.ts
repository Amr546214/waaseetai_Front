import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { FaviconRuntime } from './identity-favicon';
import { AiIconRuntime } from './identity-ai-icon';
import { IconSymbolsRuntime } from './identity-icon-symbols';
import { IdentityTokensRuntime } from './identity-tokens';
import { SiteIdentityService } from './site-identity.service';

/** app start: wires the runtime appliers and starts the manifest refresh in the background. Bounded waits only (see below); failures keep the last good / default identity */
export function provideSiteIdentity(): EnvironmentProviders {
	return provideAppInitializer(() => {
		inject(AiIconRuntime).start();
		inject(IconSymbolsRuntime).start();
		inject(FaviconRuntime).start();
		const identity = inject(SiteIdentityService);
		identity.start();
		// server: read the manifest (1 s limit, last good fallback) BEFORE the first render so the HTML carries the right asset; browser: wait only for index.html's own first-visit fetch (1.5 s limit), usually nothing
		const tokens = inject(IdentityTokensRuntime);
		return identity.loadForServer().then(() => identity.awaitBoot()).then(() => tokens.start());
	});
}
