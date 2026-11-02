import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IdentityItemInfo, IdentityOverview, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { describeFailure } from '../identity/identity-view';

/**
 * ONE client-side view of the server's design-token keys (group `token`) for every page that shows them: the editor on «القيم والألوان» / «الخطوط», the local sandboxes (which lock the
 * platform names the server manages) and «الهوية» (summary). Nothing is stored here: every value is the server's answer; there is no second store.
 */
@Injectable({ providedIn: 'root' })
export class PlatformTokensStore {
	private readonly api = inject(SiteIdentityAdminApi);
	private readonly access = inject(AdminAccessService);

	readonly overview = signal<IdentityOverview | null>(null);
	readonly phase = signal<'idle' | 'loading' | 'ready' | 'error' | 'denied'>('idle');
	readonly message = signal('');
	readonly items = computed<IdentityItemInfo[]>(() => (this.overview()?.items ?? []).filter(i => i.group === 'token'));
	/** every platform token name the server manages (any token key) */
	readonly names = computed<ReadonlySet<string>>(() => new Set(this.items().flatMap(i => (i.tokens ?? []).map(t => t.name))));
	/** names that are really bound to the site right now (their key is wired) */
	readonly wiredNames = computed<ReadonlySet<string>>(() => new Set(this.items().filter(i => i.wired).flatMap(i => (i.tokens ?? []).map(t => t.name))));
	/** editing = the server's word (canManage: site.manage OR the legacy «التحكم بالموقع» grant) AND the same permission here */
	readonly canManage = computed(() => this.overview()?.canManage === true && (this.access.can('site.manage') || this.access.can('site_control.manage')));
	item(key: string): IdentityItemInfo | null { return this.items().find(i => i.key === key) ?? null; }

	private inflight: Promise<void> | null = null;
	/** load once (idempotent); `force` re-reads the server (after a publish / restore / a conflict) */
	load(force = false): Promise<void> {
		if (this.inflight) return this.inflight;
		if (!force && this.phase() === 'ready') return Promise.resolve();
		if (this.phase() !== 'ready') this.phase.set('loading');
		this.inflight = (async () => {
			try {
				const r = await firstValueFrom(this.api.overview());
				if (!r?.data || !Array.isArray(r.data.items)) throw new Error('bad shape');
				this.overview.set(r.data); this.phase.set('ready'); this.message.set('');
			} catch (e) {
				const f = describeFailure(e, 'قراءة قيم التصميم المرتبطة بالموقع');
				if (this.phase() === 'ready') { this.message.set(f.message); return; } // keep what we have
				this.phase.set(f.kind === 'denied' ? 'denied' : 'error'); this.message.set(f.message);
			} finally { this.inflight = null; }
		})();
		return this.inflight;
	}
}
