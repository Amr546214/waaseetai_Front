import { readFileSync } from 'node:fs';
import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { DashboardLayoutComponent } from './dashboard-layout';
import { ChatService } from '../../core/services/chat.service';
import { HelpAssistantSocketService, HelpStreamEvent } from '../../core/services/help-assistant-socket.service';

// jsdom lacks these browser APIs; the real Bebo engine (public/bebo/robot.js)
// needs them once the deferred assistant widget renders.
function stubBrowserApis(): void {
	vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
	vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	class FakeObserver { observe() {} unobserve() {} disconnect() {} }
	vi.stubGlobal('IntersectionObserver', FakeObserver);
	vi.stubGlobal('ResizeObserver', FakeObserver);
}

describe('DashboardLayout', () => {
	let component: DashboardLayoutComponent;
	let fixture: ComponentFixture<DashboardLayoutComponent>;
	const chatService = {
		connect: vi.fn(),
		getConversations: () => of({ success: false }),
		newMessage$: new Subject<any>(),
		socketConnected$: new Subject<void>(),
		getSocket: () => null,
	};
	const helpSocket = { events$: new Subject<HelpStreamEvent>().asObservable(), ask: vi.fn(() => null), cancel: vi.fn() };

	beforeEach(async () => {
		stubBrowserApis();
		if (!customElements.get('cute-robot')) new Function(readFileSync('public/bebo/robot.js', 'utf8'))();
		await TestBed.configureTestingModule({
			imports: [DashboardLayoutComponent],
			providers: [
				provideRouter([]),
				{ provide: ChatService, useValue: chatService },
				{ provide: HelpAssistantSocketService, useValue: helpSocket },
			],
			deferBlockBehavior: DeferBlockBehavior.Manual,
		}).compileComponents();

		fixture = TestBed.createComponent(DashboardLayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	afterEach(() => vi.unstubAllGlobals());

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lazily mounts ONE assistant widget with the Bebo avatar (no 3D robot)', async () => {
		const el = fixture.nativeElement as HTMLElement;
		expect(el.querySelector('app-assistant-widget')).toBeNull(); // deferred until idle

		const [block] = await fixture.getDeferBlocks();
		await block.render(DeferBlockState.Complete);
		fixture.detectChanges();
		await fixture.whenStable();

		expect(el.querySelectorAll('app-assistant-widget').length).toBe(1);
		expect(el.querySelectorAll('cute-robot').length).toBe(1);
		// Mounted beside (not inside) the routed page content / cards.
		expect(el.querySelector('app-assistant-widget')!.closest('.main')).toBeNull();
		expect(el.querySelector('app-assistant-widget app-bebo-avatar cute-robot')).toBeTruthy();
		expect(el.querySelector('app-robot-avatar')).toBeNull();
		expect(el.querySelector('app-assistant-widget canvas')).toBeNull();
	});
});
