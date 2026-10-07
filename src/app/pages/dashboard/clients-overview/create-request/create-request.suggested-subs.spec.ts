import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';

const fakeSocket = { on: vi.fn(), off: vi.fn(), once: vi.fn(), emit: vi.fn(), disconnect: vi.fn() };
vi.mock('socket.io-client', () => ({ io: () => fakeSocket }));

import { CreateRequest } from './create-request';

// R10-003 — what the sub-specialty chips look like is exactly what is counted: a selected chip is visibly selected (and aria-pressed), an
// unselected one is not (hover no longer paints the selected border), and an AI-suggested sub-specialty that is not one of the chips is not
// counted silently.
describe('create request — sub-specialty chips vs the counter (R10-003)', () => {
	let component: CreateRequest;
	let fixture: any;
	let postImpl: (...a: any[]) => any;

	beforeEach(async () => {
		sessionStorage.clear();
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} });
		postImpl = () => of({ success: true, data: {} });
		await TestBed.configureTestingModule({
			imports: [CreateRequest],
			providers: [provideRouter([]), { provide: HttpClient, useValue: { get: () => of({ success: false }), post: (...a: any[]) => postImpl(...a) } }],
		}).compileComponents();
		fixture = TestBed.createComponent(CreateRequest);
		component = fixture.componentInstance;
		await fixture.whenStable();
		(component as any).specialties.set([{ id: 'tech', name: 'تقنية', subs: ['واجهات', 'خلفيات', 'جوال', 'أمن', 'بيانات', 'سحابة'] }]);
		(component as any).selectedSpec.set('tech');
		fixture.detectChanges();
	});
	afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });

	const chips = () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button[aria-pressed]')) as HTMLButtonElement[];

	it('only the chips of the chosen specialty exist, and a chip is aria-pressed and visibly different exactly when it is counted', () => {
		expect(chips().map(c => c.textContent?.trim())).toEqual(['واجهات', 'خلفيات', 'جوال', 'أمن', 'بيانات', 'سحابة']);
		component.toggleSub('خلفيات');
		fixture.detectChanges();
		const pressed = chips().filter(c => c.getAttribute('aria-pressed') === 'true');
		expect(pressed.map(c => c.textContent?.trim())).toEqual(['خلفيات']);
		expect(component.selectedSubs().size).toBe(1);
		expect(pressed[0].className).toContain('bg-[var(--teal)]/15');
		const idle = chips().find(c => c.textContent?.trim() === 'واجهات')!;
		expect(idle.className).not.toContain('border-[var(--teal)]');
		expect(idle.className).not.toContain('hover:border-[var(--teal)]');
	});

	it('AI-suggested sub-specialties are applied only when they exist as chips: the counter never counts something that is not shown selected', () => {
		postImpl = () => of({ success: true, data: { suggestedSubSpecialties: ['واجهات', 'تخصص غير موجود', 'أمن'] } });
		component.applyAISuggestion();
		fixture.detectChanges();
		expect(Array.from(component.selectedSubs()).sort()).toEqual(['أمن', 'واجهات']);
		expect(chips().filter(c => c.getAttribute('aria-pressed') === 'true').length).toBe(component.selectedSubs().size);
	});
});
