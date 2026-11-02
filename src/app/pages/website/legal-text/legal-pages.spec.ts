import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { environment } from '../../../../environments/environment';
import { PlatformInfoService } from '../../../core/services/platform-info.service';
import { PRIVACY_DEFAULT_TEXT, TERMS_DEFAULT_TEXT } from '../../../core/constants/legal-text';
import { parseLegalText } from '../../../core/utils/legal-text';
import { PrivacyComponent } from '../privacy/privacy.component';
import { TermsComponent } from '../terms/terms.component';
import golden from './legal-pages.golden.json';

/** `golden` = the rendered DOM of the two pages captured from the ORIGINAL static templates (before the text moved into core/constants/legal-text.ts), normalised the same way as below. */
const norm = (el: Element) => el.innerHTML.replace(/<!--[\s\S]*?-->/g, '').replace(/\s(_ngcontent|_nghost|ng-reflect|ng-version)[^\s>]*/g, '').replace(/\s+/g, ' ').replace(/> </g, '><').replace(/<article class="legal-section" id="(s\d+)">/g, '<article id="$1" class="legal-section">').trim(); // (last replace: attribute ORDER of id/class only - a bound id is set after the static class)
const G = golden as Record<string, string>;

describe('legal pages render the setting when saved and EXACTLY the old static page when not', () => {
	let http: HttpTestingController;
	beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }); http = TestBed.inject(HttpTestingController); });
	const mount = async (C: any) => { const f = TestBed.createComponent(C); f.detectChanges(); await f.whenStable(); f.detectChanges(); return f.nativeElement as HTMLElement; };
	const publish = (d: Record<string, unknown>) => { const p = TestBed.inject(PlatformInfoService); p.load(); http.expectOne(`${environment.url_api}/public/settings`).flush({ success: true, data: d }); };

	for (const [name, C] of [['terms', TermsComponent], ['privacy', PrivacyComponent]] as const) {
		it(`${name}: unset -> same content, TOC, header and text as before the refactor`, async () => {
			const el = await mount(C);
			expect(norm(el.querySelector('.legal-content')!)).toBe(G[`${name}.content`]);
			expect(norm(el.querySelector('.legal-toc')!)).toBe(G[`${name}.toc`]);
			expect(norm(el.querySelector('.legal-page-header')!)).toBe(G[`${name}.header`]);
			expect((el.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe(G[`${name}.text`]);
		});
	}

	it('terms: a saved text replaces the static body (sections, bold, list, table); the TOC follows it; unrelated chrome stays', async () => {
		publish({ termsContent: '## قسم أول\nفقرة فيها **غليظ** ونص.\n- بند 1\n- بند 2\n\n## قسم ثانٍ\n| العمود أ | العمود ب |\n| خ1 | خ2 |' });
		const el = await mount(TermsComponent);
		const arts = el.querySelectorAll('.legal-content article'); expect(arts.length).toBe(2);
		expect(arts[0].querySelector('.sec-num')?.textContent).toBe('01'); expect(arts[0].querySelector('h2')?.textContent).toBe('قسم أول'); expect(arts[0].querySelector('p strong')?.textContent).toBe('غليظ');
		expect([...arts[0].querySelectorAll('li')].map(x => x.textContent)).toEqual(['بند 1', 'بند 2']);
		expect([...arts[1].querySelectorAll('th')].map(x => x.textContent)).toEqual(['العمود أ', 'العمود ب']); expect(arts[1].querySelector('td.td-name')?.textContent).toBe('خ1');
		expect([...el.querySelectorAll('.legal-toc .toc-box:first-child a')].map(a => a.textContent?.trim())).toEqual(['قسم أول', 'قسم ثانٍ']);
		expect(el.textContent).not.toContain('نطاق الشروط'); expect(el.querySelector('.legal-h1')?.textContent).toBe('الشروط والأحكام');
	});
	it('privacy: a saved text replaces the body but the rights card (page chrome) stays', async () => {
		publish({ privacyContent: '## أمن\nنص مخصص' });
		const el = await mount(PrivacyComponent);
		expect(el.querySelectorAll('.legal-content article').length).toBe(1); expect(el.querySelector('.legal-content')?.textContent).toContain('نص مخصص'); expect(el.querySelector('.legal-content')?.textContent).not.toContain('الغرض');
		expect(el.querySelector('.rights-card')).toBeTruthy();
	});
	it('a whitespace-only saved text counts as unset (the static page is kept, never an empty page)', async () => {
		publish({ termsContent: '   \n  ' }); const el = await mount(TermsComponent);
		expect(norm(el.querySelector('.legal-content')!)).toBe(G['terms.content']);
	});
	it('escaping: HTML typed in the saved text is shown as characters, never parsed (no element, no handler)', async () => {
		publish({ termsContent: '## <img src=x onerror="window.__xss=1">\n<script>window.__xss=2</script> **<b>x</b>**\n- <a href="javascript:alert(1)">l</a>\n| <i>h</i> |\n| <svg onload=1> |' });
		const el = await mount(TermsComponent); const c = el.querySelector('.legal-content')!;
		expect(c.querySelector('img,script,b,a,i,svg')).toBeNull(); expect(c.textContent).toContain('<img src=x onerror="window.__xss=1">'); expect(c.textContent).toContain('<script>window.__xss=2</script>'); expect(c.textContent).toContain('<a href="javascript:alert(1)">l</a>');
		expect((window as any).__xss).toBeUndefined();
	});
});

describe('legal text format', () => {
	it('the shared default texts parse to the same number of sections as the pages had (12 terms / 9 privacy) and contain no HTML', () => {
		expect(parseLegalText(TERMS_DEFAULT_TEXT).length).toBe(12); expect(parseLegalText(PRIVACY_DEFAULT_TEXT).length).toBe(9);
		expect(TERMS_DEFAULT_TEXT + PRIVACY_DEFAULT_TEXT).not.toMatch(/<[a-z/]/i);
	});
	it('text before the first heading becomes an untitled first section; unbalanced ** stays literal; table separator rows are dropped', () => {
		const s = parseLegalText('مقدمة **ناقصة\n## ب\n| أ | ب |\n|---|---|\n| 1 | 2 |');
		expect(s[0].title).toBe(''); expect(s[0].blocks[0]).toEqual({ kind: 'p', parts: [{ t: 'مقدمة **ناقصة', strong: false }] });
		expect(s[1].blocks[0]).toMatchObject({ kind: 'table', head: ['أ', 'ب'] }); expect((s[1].blocks[0] as any).rows.length).toBe(1);
	});
});
