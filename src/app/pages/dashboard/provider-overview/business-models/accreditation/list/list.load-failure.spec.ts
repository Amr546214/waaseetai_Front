import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { List } from './list';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';

describe('Accreditation list: a failed load is not an empty list', () => {
	afterEach(() => TestBed.resetTestingModule());
	const make = (samples: any) => {
		TestBed.configureTestingModule({ imports: [List], providers: [provideRouter([]), { provide: ProviderApiService, useValue: { getAccreditationSamples: samples, getPassedSpecialties: () => of({ registered: [] }) } }] });
		const f = TestBed.createComponent(List); f.detectChanges();
		return f.nativeElement as HTMLElement;
	};
	it('503: failure + retry, not «لا توجد نماذج اعتماد»', () => {
		const el = make(() => throwError(() => ({ status: 503, error: { message: 'x' } })));
		expect(el.querySelector('[data-testid="load-error"]')).not.toBeNull();
		expect(el.textContent).not.toContain('لا توجد نماذج اعتماد مرفوعة');
	});
	it('empty answer: the real empty state', () => {
		const el = make(() => of({ success: true, samples: [] }));
		expect(el.textContent).toContain('لا توجد نماذج اعتماد مرفوعة');
	});
});
