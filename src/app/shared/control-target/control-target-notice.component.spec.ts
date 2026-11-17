import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it } from 'vitest';
import { AuthStore } from '../../core/store/auth.store';
import { OperationsPanelService } from '../../core/services/operations-panel.service';
import { ControlTargetNoticeComponent } from './control-target-notice.component';

describe('control target notice', () => {
	const mount = (controlTarget?: 'OFFICIAL' | 'LOCAL') => {
		TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: AuthStore, useValue: { currentUser: () => ({ id: 'u', accountType: 'SUPER_ADMIN' }) } }] });
		const ops = TestBed.inject(OperationsPanelService);
		ops.state.set({ officialDeployment: false, isSuperAdmin: true, available: true, controlTarget }); ops.loaded.set(true);
		const f = TestBed.createComponent(ControlTargetNoticeComponent); f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	it('shows only while the panel controls the official site from another deployment', () => {
		expect(mount('OFFICIAL').querySelector('[data-testid="control-target-official"]')?.textContent).toContain('الموقع الرسمي');
	});
	it('shows nothing when the panel controls its own deployment', () => {
		TestBed.resetTestingModule();
		expect(mount('LOCAL').querySelector('[data-testid="control-target-official"]')).toBeNull();
	});
});
