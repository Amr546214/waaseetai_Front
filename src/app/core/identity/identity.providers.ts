import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { FaviconRuntime } from './identity-favicon';
import { AiIconRuntime } from './identity-ai-icon';
import { SiteIdentityService } from './site-identity.service';

/** app start: wires the runtime appliers and kicks the manifest load WITHOUT awaiting it (rendering is never blocked; failures keep the last good / default identity) */
export function provideSiteIdentity(): EnvironmentProviders {
	return provideAppInitializer(() => {
		inject(AiIconRuntime).start();
		inject(FaviconRuntime).start();
		inject(SiteIdentityService).start();
	});
}
