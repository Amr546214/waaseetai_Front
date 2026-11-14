import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore } from '../../core/store/auth.store';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { PlatformInfoService } from '../../core/services/platform-info.service';
import { UnderDeploymentComponent } from './under-deployment.component';

describe('Under Deployment page', () => {
	it('is a standalone page with the title, the English label and the saved message; it has no navigation, no footer and no assistant', async () => {
		const nav = vi.fn(); TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: { navigate: nav } }, {provide: AuthStore,useValue:{currentUser:()=>({accountType:'CLIENT_INDIVIDUAL'}),clearSession:vi.fn()}} ] });
		TestBed.inject(PlatformInfoService).applyMaintenance(true, 'نحدّث المنصة حتى الساعة 5');
		const f = TestBed.createComponent(UnderDeploymentComponent); f.detectChanges(); const el = f.nativeElement as HTMLElement;
		expect(el.textContent).toContain('جارٍ تحديث المنصة'); expect(el.textContent).toContain('Under Deployment');
		expect(el.querySelector('[data-testid="under-deployment-message"]')?.textContent).toContain('نحدّث المنصة حتى الساعة 5');
		expect(el.querySelectorAll('nav,header,footer,aside,app-assistant-widget,router-outlet').length).toBe(0);
		(el.querySelector('[data-testid="under-deployment-admin"]') as HTMLButtonElement).click(); expect(TestBed.inject(AuthStore).clearSession).toHaveBeenCalled(); expect(nav).toHaveBeenCalledWith(['/auth/login'], {queryParams:{returnUrl:'/supper-admin-overview/system-settings',maintenanceAdmin:'1'}});
	});
});
