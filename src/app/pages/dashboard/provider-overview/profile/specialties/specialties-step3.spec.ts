import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Step 3 of the specialty wizard ("مراجعة النماذج"). The backend answers 503 on the accreditation evaluation while it is switched off:
// the step must say so honestly, claim no AI review, and still let the provider carry on to the next step.
const fakeSocket = { connected: false, on: vi.fn(), once: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ default: () => fakeSocket, io: () => fakeSocket }));

import { Specialties } from './specialties';

const html = () => readFileSync(join(__dirname, 'specialties.html'), 'utf-8');
const bodyText = (f: ComponentFixture<Specialties>) => ((f.nativeElement as HTMLElement).textContent || '').replace(/\s+/g, ' ');

describe('Specialties wizard — step 3 when the smart check is unavailable', () => {
	let component: Specialties;
	let fixture: ComponentFixture<Specialties>;

	beforeEach(async () => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, clear: () => {} });
		await TestBed.configureTestingModule({
			imports: [Specialties],
			providers: [{
				provide: HttpClient,
				useValue: {
					get: () => of({ success: false }),
					post: (url: string) => (String(url).includes('ai-evaluate') || String(url).includes('evaluate') ? throwError(() => ({ status: 503, error: { message: 'x' } })) : of({ success: true })),
				},
			}],
		}).compileComponents();
		fixture = TestBed.createComponent(Specialties);
		component = fixture.componentInstance;
		component.providerSpecialtyId.set('ps-real-1');
		component.currentStep.set(3);
		component.simulateAnalysis();
		fixture.detectChanges();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('shows the honest message, with no score, and no AI claim', () => {
		expect(component.aiEvaluationUnavailable()).toBe(true);
		const t = bodyText(fixture);
		expect(t).toContain('هذه المراجعة غير متاحة حاليًا');
		expect(t).toContain('تم تحويل نماذجك للمراجعة');
		expect(t).not.toContain('AI Score');
		expect(t).not.toContain('Waseet AI');
		expect(t).not.toContain('مراجعة الذكاء');
	});

	it('does not dead-end: declarations are shown and the next button enables once they are ticked', () => {
		const root = fixture.nativeElement as HTMLElement;
		expect(root.querySelector('[data-testid="step3-declarations"]')).toBeTruthy();
		const next = () => Array.from(root.querySelectorAll('button')).find(b => (b.textContent || '').includes('التالي')) as HTMLButtonElement;
		expect(next().disabled).toBe(true);
		component.declarations.update(d => d.map(x => ({ ...x, checked: true })));
		fixture.detectChanges();
		expect(next().disabled).toBe(false);
	});

	it('static: the step is titled "مراجعة النماذج" and no longer claims an AI review or names the engine', () => {
		const src = html();
		expect(src).toContain('مراجعة النماذج');
		expect(src).not.toContain('مراجعة الذكاء');
		expect(src).not.toContain('المدقق التقني');
		expect(src).not.toContain('محرك Waseet AI — المدقق');
		expect(src).not.toContain('تدقيق\n\t\t\t\t\t\tمتعدد الوسائط');
	});
});
