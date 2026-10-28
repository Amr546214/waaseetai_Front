import { Component, ViewEncapsulation, effect, inject, signal, untracked } from '@angular/core';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';
import { ParsedSvgIcon, parseCustomSvg } from '../../../../../core/identity/identity-ai-icon';
import { SiteIdentityService } from '../../../../../core/identity/site-identity.service';
import { InlineSvgDirective } from './inline-svg.directive';

const DEFAULT_AI: ParsedSvgIcon | null = (() => { try { return parseCustomSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${AI_ICON_INNER}</svg>`); } catch { return null; } })();

/**
 * Read-only strip for the design-aid pages (live preview, style guide, templates): it shows the logo, the tab icon and the AI mark exactly as the LIVE site shows them right now
 * (the public manifest through SiteIdentityService: the published file, else the built-in default). It edits nothing; the editors are on «الهوية».
 */
@Component({
	selector: 'sc-identity-strip',
	standalone: true,
	imports: [InlineSvgDirective],
	encapsulation: ViewEncapsulation.ShadowDom,
	template: `
		<div class="strip" data-testid="identity-strip" dir="rtl">
			<strong class="t">الهوية الحالية للموقع (قراءة فقط)</strong>
			<span class="it"><img [src]="id.resolve('logo.mark')" alt="" height="28" data-testid="strip-logo" /> الشعار <small>{{ id.isCustom('logo.mark') ? 'مخصّص' : 'الأصل' }}</small></span>
			<span class="it"><img [src]="id.resolve('favicon.tab')" alt="" height="20" data-testid="strip-favicon" /> أيقونة التبويب <small>{{ id.isCustom('favicon.tab') ? 'مخصّصة' : 'الأصل' }}</small></span>
			<span class="it ai"><svg [scInlineSvg]="aiIcon()" width="22" height="22" aria-hidden="true" focusable="false" data-testid="strip-ai"></svg> أيقونة الذكاء الاصطناعي <small>{{ id.isCustom('icon.ai') ? 'مخصّصة' : 'الأصل' }}</small></span>
			<span class="v">نسخة بيان الموقع: {{ id.version() }}</span>
			<span class="h">تُعدَّل من صفحة «الهوية»؛ هذه الصفحة أداة عرض وتستعمل نفس القيم.</span>
		</div>`,
	styles: [`
		:host { display: block; }
		.strip { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; padding: 10px 14px; margin: 0 0 14px; border: 1px solid var(--border, rgba(255,255,255,.12)); border-radius: 12px; font-size: 12.5px; color: var(--txt-2, #A8B2D1); }
		.t { color: var(--txt, #fff); }
		.it { display: inline-flex; align-items: center; gap: 6px; }
		.it.ai { color: var(--ai-txt, #A56BE0); }
		.it small { color: var(--txt-3, #6B7699); }
		.v { margin-inline-start: auto; }
		.h { flex-basis: 100%; color: var(--txt-3, #6B7699); font-size: 11.5px; }
		img { display: block; width: auto; }
	`]
})
export class IdentityStrip {
	readonly id = inject(SiteIdentityService);
	readonly aiIcon = signal<ParsedSvgIcon | null>(DEFAULT_AI);
	private seq = 0;

	constructor() {
		effect(() => {
			const url = this.id.customUrl('icon.ai');
			untracked(() => void this.loadAi(url));
		});
	}

	private async loadAi(url: string | null): Promise<void> {
		const n = ++this.seq;
		if (!url) { this.aiIcon.set(DEFAULT_AI); return; }
		try {
			const res = await fetch(url, { credentials: 'omit' });
			if (!res.ok) throw new Error('HTTP ' + res.status);
			const icon = parseCustomSvg(await res.text());
			if (n === this.seq) this.aiIcon.set(icon ?? DEFAULT_AI);
		} catch { if (n === this.seq) this.aiIcon.set(DEFAULT_AI); }
	}
}
