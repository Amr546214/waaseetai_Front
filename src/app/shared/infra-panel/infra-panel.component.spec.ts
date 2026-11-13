import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { environment } from '../../../environments/environment';
import { InfraPanelComponent } from './infra-panel.component';

const U = `${environment.url_api}/admin/infrastructure/servers`;
describe('infrastructure panel: measured facts only', () => {
	const mount = () => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); const http = TestBed.inject(HttpTestingController); const f = TestBed.createComponent(InfraPanelComponent); f.componentRef.setInput('endpoint', 'servers'); f.componentRef.setInput('title', 'الخوادم'); f.detectChanges(); return { f, http, el: f.nativeElement as HTMLElement }; };
	it('shows each block with its source, scope and time; container and host stay separate; unavailable names the requirement', () => {
		const { f, http, el } = mount();
		http.expectOne(U).flush({ success: true, data: { measuredAt: '2026-11-13T10:00:00Z', sections: [
			{ title: 'الحاوية (cgroup)', source: 'container', scope: 'حاوية هذا الخادم وحدها', measuredAt: 't1', items: [{ label: 'ذاكرة الحاوية المستخدمة', value: 120.5, unit: 'MB' }] },
			{ title: 'الخادم المضيف', source: 'host', scope: 'الجهاز المضيف', measuredAt: 't2', items: [{ label: 'عدد أنوية CPU', value: 4 }] },
			{ title: 'شبكة توصيل المحتوى (CDN)', source: 'config', scope: 'لا CDN', measuredAt: 't3', unavailable: { reason: 'لا يوجد مزوّد', requirement: 'CDN_API_TOKEN' } }] } }); f.detectChanges();
		const tags = Array.from(el.querySelectorAll('[data-testid="infra-source"]')).map(x => x.textContent?.trim()); expect(tags).toEqual(['الحاوية', 'الخادم المضيف', 'إعدادات البيئة']);
		expect(el.textContent).toContain('120.5 MB'); expect(el.textContent).toContain('النطاق: حاوية هذا الخادم وحدها'); expect(el.querySelector('[data-testid="infra-unavailable"]')?.textContent).toContain('CDN_API_TOKEN');
	});
	it('a failed measurement shows the error and NO substitute numbers; measuring again re-requests', () => {
		const { f, http, el } = mount(); http.expectOne(U).flush({ success: false, message: 'x' }, { status: 403, statusText: 'x' }); f.detectChanges();
		expect(el.querySelector('[data-testid="infra-error"]')).toBeTruthy(); expect(el.querySelectorAll('[data-testid="infra-section"]').length).toBe(0);
		(el.querySelector('[data-testid="infra-refresh"]') as HTMLButtonElement).click(); http.expectOne(U).flush({ success: true, data: { measuredAt: 'now', sections: [] } }); f.detectChanges(); expect(el.querySelector('[data-testid="infra-error"]')).toBeNull();
	});
});
