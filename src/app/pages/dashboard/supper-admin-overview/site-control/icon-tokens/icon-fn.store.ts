import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IconFnList, IconFnRow, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { ParsedSvgIcon, parseCustomSvg } from '../../../../../core/identity/identity-ai-icon';
import { iconFnKey } from '../../../../../core/identity/identity-icon-symbols';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { describeFailure } from '../identity/identity-view';

export type IconFnPhase = 'idle' | 'loading' | 'ready' | 'error' | 'denied';

/**
 * ONE client-side view of the server's function-icon list for the icon library page. Nothing is stored here: every row is the server's answer. A failed (re)load NEVER empties the list:
 * the last good rows stay (with a warning), and a first load that fails is an explicit error state with a retry, never an empty library.
 */
@Injectable({ providedIn: 'root' })
export class IconFnStore {
	private readonly api = inject(SiteIdentityAdminApi);
	private readonly identity = inject(SiteIdentityService);
	private readonly access = inject(AdminAccessService);

	readonly phase = signal<IconFnPhase>('idle');
	readonly message = signal('');
	/** set when a refresh failed while rows from an earlier answer are still shown */
	readonly staleWarning = signal('');
	readonly list = signal<IconFnList | null>(null);
	readonly rows = computed<IconFnRow[]>(() => this.list()?.rows ?? []);
	/** the server's word AND the same permission here; site.view alone only reads */
	readonly canManage = computed(() => this.access.can('site.manage') || this.access.can('site_control.manage'));
	/** published glyphs of customised icons (parsed with the SAME rules the site uses), by symbol id */
	readonly customGlyphs = signal<Record<string, ParsedSvgIcon | null>>({});
	/** the ids the page currently draws (set by the page); glyphs are fetched for these only */
	readonly shownIds = signal<string[]>([]);
	private inflight: Promise<void> | null = null;
	private glyphSeq = 0;

	load(force = false): Promise<void> {
		if (this.inflight) return this.inflight;
		if (!force && this.phase() === 'ready') return Promise.resolve();
		if (this.phase() !== 'ready') this.phase.set('loading');
		this.inflight = (async () => {
			try {
				const r = await firstValueFrom(this.api.iconList());
				if (!r?.data || !Array.isArray(r.data.rows)) throw new Error('bad shape');
				this.list.set(r.data); this.phase.set('ready'); this.message.set(''); this.staleWarning.set('');
				this.glyphSha.clear(); void this.ensureGlyphs(this.shownIds());
			} catch (e) {
				const f = describeFailure(e, 'قراءة قائمة الأيقونات من الخادم');
				if (this.phase() === 'ready' && this.list()) { this.staleWarning.set(`${f.message} المعروض هو آخر ما قرأناه من الخادم.`); return; }
				this.phase.set(f.kind === 'denied' ? 'denied' : 'error'); this.message.set(f.message);
			} finally { this.inflight = null; }
		})();
		return this.inflight;
	}

	row(id: string): IconFnRow | null { return this.rows().find(r => r.id === id) ?? null; }

	private readonly glyphSha = new Map<string, string>();
	/**
	 * The published files of the customised icons that are ON SCREEN, parsed once per sha with a small concurrency (the page lists up to ~340 icons: it never fetches all of them at once).
	 * Rows whose sha changed since the last fetch are refreshed; rows that are no longer custom are dropped.
	 */
	async ensureGlyphs(ids: string[]): Promise<void> {
		const my = ++this.glyphSeq;
		const rows = new Map(this.rows().map(r => [r.id, r] as const));
		const todo = ids.filter(id => { const r = rows.get(id); if (!r || r.status !== 'custom' || !r.key) return false; const it = this.identity.manifest().items[iconFnKey(id)]; return !!it && this.glyphSha.get(id) !== it.sha256; });
		const next: Record<string, ParsedSvgIcon | null> = Object.fromEntries(Object.entries(this.customGlyphs()).filter(([id]) => rows.get(id)?.status === 'custom'));
		const queue = [...todo];
		const worker = async () => {
			for (let id = queue.shift(); id; id = queue.shift()) {
				const it = this.identity.manifest().items[iconFnKey(id)];
				if (!it) { next[id] = null; continue; }
				try {
					const res = await fetch(this.identity.absoluteUrl(it.url), { cache: 'force-cache', credentials: 'omit' });
					if (!res.ok) throw new Error('HTTP ' + res.status);
					next[id] = parseCustomSvg(await res.text(), it.sha256); this.glyphSha.set(id, it.sha256);
				} catch { next[id] = null; }
			}
		};
		await Promise.all(Array.from({ length: Math.min(8, queue.length) }, worker));
		if (my === this.glyphSeq) this.customGlyphs.set(next);
	}
}
