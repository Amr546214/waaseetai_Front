import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Center } from './center';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';

describe('Center: a failed load is not an empty list', () => {
	afterEach(() => TestBed.resetTestingModule());
	const make = (api: any) => {
		TestBed.configureTestingModule({ imports: [Center], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getPassedSpecialties: () => of({}), ...api } }] });
		const f = TestBed.createComponent(Center); f.detectChanges();
		return { f, el: f.nativeElement as HTMLElement };
	};
	it('503: shows the failure with a retry and not «لا توجد نماذج بعد»', () => {
		const { el } = make({ getAccreditationSamples: () => throwError(() => ({ status: 503, error: { message: 'x' } })) });
		expect(el.querySelector('[data-testid="load-error"]')).not.toBeNull();
		expect(el.textContent).not.toContain('لا توجد نماذج بعد');
	});
	it('a successful empty answer still shows the real empty state', () => {
		const { el } = make({ getAccreditationSamples: () => of({ success: true, samples: [] }) });
		expect(el.querySelector('[data-testid="load-error"]')).toBeNull();
		expect(el.textContent).toContain('لا توجد نماذج بعد');
	});
});
