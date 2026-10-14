import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { New } from './new';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';
import { ProviderAccessService } from '../../../../../../core/services/provider-access.service';

describe('accreditation upload: after a successful submit', () => {
	function mount(accessLoad: () => any) {
		const invalidate = vi.fn();
		const load = vi.fn(accessLoad);
		TestBed.configureTestingModule({
			imports: [New],
			providers: [
				provideRouter([]),
				{ provide: ProviderApiService, useValue: { getPassedSpecialties: () => of({ success: true, categories: [], registered: [] }), submitAccreditationSample: () => of({ success: true, data: {} }) } },
				{ provide: ProviderAccessService, useValue: { invalidate, load } },
			],
		});
		const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
		const c = TestBed.createComponent(New).componentInstance as any;
		c.title.set('عنوان'); // submitForAiEvaluation guards on validity; call the post-submit step directly too
		return { c, invalidate, load, nav };
	}
	afterEach(() => TestBed.resetTestingModule());
	const st = (can: boolean) => of({ state: can ? 'APPROVED' : 'PENDING_REVIEW', canAccessDashboard: can, message: '', reason: null, hasSample: true, specialties: [] });

	it('not approved: the state is re-read and the app goes to the status page', () => {
		const { c, invalidate, load, nav } = mount(() => st(false));
		c.afterSampleSubmitted();
		expect(invalidate).toHaveBeenCalled();
		expect(load).toHaveBeenCalled();
		expect(nav).toHaveBeenCalledWith('/provider-overview/accreditation-status');
	});
	it('a failed re-read also goes to the status page (closed)', () => {
		const { c, nav } = mount(() => throwError(() => new Error('x')));
		c.afterSampleSubmitted();
		expect(nav).toHaveBeenCalledWith('/provider-overview/accreditation-status');
	});
	it('already approved: stays on the page', () => {
		const { c, nav } = mount(() => st(true));
		c.afterSampleSubmitted();
		expect(nav).not.toHaveBeenCalled();
	});
});
