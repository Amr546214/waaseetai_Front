import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { BeboAvatarComponent } from './bebo-avatar';
import { BEBO_POSES, BeboPose, CuteRobotElement } from './bebo-loader';
import type { AvatarState, BeboCommand } from '../../core/store/assistant.store';

// Runs against the REAL Bebo v4 engine (public/bebo/robot.js, byte-identical
// to the handoff), evaluated in jsdom. Only the browser APIs jsdom lacks
// (matchMedia, IntersectionObserver, ResizeObserver) are stubbed.

const observers: Array<{ disconnect: ReturnType<typeof vi.fn> }> = [];
function loadRealBeboEngine(): void {
	if (customElements.get('cute-robot')) return;
	if (typeof globalThis.matchMedia !== 'function') {
		vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
	}
	class FakeObserver {
		disconnect = vi.fn();
		constructor() { observers.push(this); }
		observe() {}
		unobserve() {}
	}
	vi.stubGlobal('IntersectionObserver', FakeObserver);
	vi.stubGlobal('ResizeObserver', FakeObserver);
	new Function(readFileSync('public/bebo/robot.js', 'utf8'))();
}

@Component({
	standalone: true,
	imports: [BeboAvatarComponent],
	template: `@if (show()) {<app-bebo-avatar [state]="state()" [celebrate]="celebrate()" [command]="command()" [floating]="floating" (activate)="activations = activations + 1" />}`,
})
class HostComponent {
	show = signal(true);
	state = signal<AvatarState>('idle');
	celebrate = signal(0);
	command = signal<BeboCommand | null>(null);
	floating = true;
	activations = 0;
}

describe('BeboAvatarComponent (Bebo v4 renderer)', () => {
	let fixture: ComponentFixture<HostComponent>;
	let host: HostComponent;

	beforeAll(() => loadRealBeboEngine());

	beforeEach(async () => {
		observers.length = 0;
		await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
		fixture = TestBed.createComponent(HostComponent);
		host = fixture.componentInstance;
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	});

	const el = () => fixture.nativeElement as HTMLElement;
	const robot = () => el().querySelector('cute-robot') as CuteRobotElement;
	const setState = (s: AvatarState) => { host.state.set(s); fixture.detectChanges(); };

	it('renders the real <cute-robot> (shadow DOM sprite, floating + interactive, handoff atlases)', () => {
		const r = robot();
		expect(r).toBeTruthy();
		expect(customElements.get('cute-robot')).toBeTruthy();
		expect(typeof r.play).toBe('function');
		expect(r.hasAttribute('floating')).toBe(true);
		expect(r.hasAttribute('interactive')).toBe(true);
		expect(r.getAttribute('size')).toBe('96');
		expect(el().querySelector('app-bebo-avatar')!.hasAttribute('data-ready')).toBe(true);
		const sprite = r.shadowRoot!.querySelector('.sprite') as HTMLElement;
		expect(sprite.style.backgroundImage).toContain('robot-sprites.png');
		// No 3D canvas / WebGL anywhere.
		expect(el().querySelector('canvas')).toBeNull();
		expect(r.shadowRoot!.querySelector('canvas')).toBeNull();
	});

	it('idle: Bebo stands idle on the base atlas', () => {
		expect(robot().state).toBe('idle');
		expect((robot().shadowRoot!.querySelector('.sprite') as HTMLElement).dataset['atlas']).toBe('base');
	});

	it('thinking: plays the looping thinking pose', () => {
		setState('thinking');
		expect(robot().state).toBe('thinking');
		expect(robot().shadowRoot!.querySelector('button')!.className).toContain('thinking');
	});

	it('listening: plays the looping listening pose', () => {
		setState('listening');
		expect(robot().state).toBe('listening');
	});

	it('speaking: plays the speech atlas and forwards the real audio level to the mouth', () => {
		setState('speaking');
		expect(robot().state).toBe('speaking');
		expect((robot().shadowRoot!.querySelector('.sprite') as HTMLElement).dataset['atlas']).toBe('speech');
		const spy = vi.spyOn(robot(), 'setSpeechLevel');
		const cmp = fixture.debugElement.children[0].componentInstance as BeboAvatarComponent;
		cmp.setSpeechLevel(0.6);
		cmp.setSpeechLevel(null);
		expect(spy).toHaveBeenNthCalledWith(1, 0.6);
		expect(spy).toHaveBeenNthCalledWith(2, null);
	});

	it('back to idle only resets assistant poses — a user-driven antic is not cut off', () => {
		setState('thinking');
		setState('idle');
		expect(robot().state).toBe('idle');
		robot().play('wave');
		setState('error');
		setState('idle');
		expect(robot().state).toBe('scratch'); // error → one head-scratch, left to finish
	});

	it('happy: a new success tick while idle plays happy; the initial tick does not', () => {
		expect(robot().state).toBe('idle');
		host.celebrate.set(1);
		fixture.detectChanges();
		expect(robot().state).toBe('happy');
	});

	it('does not celebrate on mount with a pre-existing success count', async () => {
		fixture.destroy();
		const f2 = TestBed.createComponent(HostComponent);
		f2.componentInstance.celebrate.set(5);
		f2.detectChanges();
		await f2.whenStable();
		f2.detectChanges();
		expect((f2.nativeElement.querySelector('cute-robot') as CuteRobotElement).state).toBe('idle');
	});

	it('state changes reuse the same element — nothing recreated, no script re-injected', () => {
		const first = robot();
		const scriptsBefore = document.querySelectorAll('script').length;
		for (const s of ['thinking', 'speaking', 'listening', 'error', 'idle', 'thinking'] as AvatarState[]) setState(s);
		expect(robot()).toBe(first);
		expect(el().querySelectorAll('cute-robot').length).toBe(1);
		expect(document.querySelectorAll('script').length).toBe(scriptsBefore);
		expect(observers.length).toBe(2); // one IntersectionObserver + one ResizeObserver, never more
	});

	it('clicking Bebo activates the assistant, except right after a drag-drop', () => {
		robot().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(host.activations).toBe(1);
		robot().dispatchEvent(new CustomEvent('robotdrop', { bubbles: true }));
		robot().dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(host.activations).toBe(1);
	});

	it('keeps the handoff interactions: hover jump, and drag → drop → land', () => {
		const r = robot();
		const button = r.shadowRoot!.querySelector('button')!;
		const PE: typeof MouseEvent = (globalThis as any).PointerEvent ?? MouseEvent;
		button.dispatchEvent(new PE('pointerenter', { pointerType: 'mouse' } as any));
		expect(r.state).toBe('jump');

		r.play('idle');
		const seen: string[] = [];
		for (const t of ['robotdragstart', 'robotdrop', 'robotland']) r.addEventListener(t, () => seen.push(t));
		button.dispatchEvent(new PE('pointerdown', { button: 0, clientX: 10, clientY: 10, pointerId: 1, isPrimary: true, bubbles: true } as any));
		button.dispatchEvent(new PE('pointermove', { clientX: 60, clientY: 10, pointerId: 1, bubbles: true } as any));
		expect(r.state).toBe('drag');
		button.dispatchEvent(new PE('pointerup', { clientX: 60, clientY: 10, pointerId: 1, bubbles: true } as any));
		expect(seen).toEqual(['robotdragstart', 'robotdrop', 'robotland']);
		expect(r.state).toBe('land'); // then walks a step (resume: 'walk') and idles
	});

	it('cleanup on destroy: element removed, its observers disconnected, rAF loop stopped', () => {
		const r = robot() as CuteRobotElement & { _raf: number };
		const created = [...observers];
		host.show.set(false);
		fixture.detectChanges();
		expect(r.isConnected).toBe(false);
		expect(r._raf).toBe(0);
		for (const o of created) expect(o.disconnect).toHaveBeenCalled();
	});

	describe('local Bebo commands (handoff execute())', () => {
		let seq = 0;
		const run = (action: BeboCommand['action']) => { host.command.set({ action, seq: ++seq }); fixture.detectChanges(); };

		it('a command plays its pose on the real robot (one-shot actions do not loop)', () => {
			run('dance');
			expect(robot().state).toBe('dance');
			run('cry');
			expect(robot().state).toBe('cry');
			run('wave');
			expect(robot().state).toBe('wave');
		});

		it('typing / sleep / rest loop, as in the handoff', () => {
			const spy = vi.spyOn(robot(), 'play');
			run('typing');
			expect(spy).toHaveBeenLastCalledWith('typing', { loop: true });
			run('jump');
			expect(spy).toHaveBeenLastCalledWith('jump', { loop: false });
		});

		it('reset returns Bebo to its home position', () => {
			const spy = vi.spyOn(robot(), 'resetPosition');
			run('reset');
			expect(spy).toHaveBeenCalledTimes(1);
		});

		it('stop only ends an assistant pose (speaking → idle)', () => {
			setState('speaking');
			run('stop');
			expect(robot().state).toBe('idle');
		});

		it('roam commands never enable roaming', () => {
			run('roam_on');
			expect(robot().hasAttribute('roam')).toBe(false);
		});

		it('the same seq is not replayed on re-render; a new seq is', () => {
			const spy = vi.spyOn(robot(), 'play');
			run('laugh');
			fixture.detectChanges();
			expect(spy.mock.calls.filter((c) => c[0] === 'laugh').length).toBe(1);
			run('laugh');
			expect(spy.mock.calls.filter((c) => c[0] === 'laugh').length).toBe(2);
		});

		it('a command already pending when Bebo mounts is not replayed', async () => {
			fixture.destroy();
			const f2 = TestBed.createComponent(HostComponent);
			f2.componentInstance.command.set({ action: 'dance', seq: 7 });
			f2.detectChanges();
			await f2.whenStable();
			f2.detectChanges();
			expect((f2.nativeElement.querySelector('cute-robot') as CuteRobotElement).state).toBe('idle');
		});
	});

	it('the real engine supports exactly the 24 handoff poses', () => {
		const r = robot();
		// Floating 'walk' walks to the far edge; jsdom has no viewport width
		// to walk across, so exercise the in-place variant of every pose.
		r.removeAttribute('floating');
		for (const pose of BEBO_POSES) {
			r.play(pose as BeboPose);
			expect(r.state).toBe(pose);
		}
		expect(BEBO_POSES.length).toBe(24);
		expect(() => r.play('explode' as BeboPose)).toThrow(TypeError);
	});
});

describe('Bebo assets and legacy 3D avatar removal', () => {
	const atlases = ['robot-sprites.png', 'robot-actions.png', 'robot-speaking.png', 'robot-antics.png', 'robot-emotions.png', 'kitten-sprites.png'];

	it('ships every sprite atlas robot.js references, as real PNGs next to it', () => {
		const src = readFileSync('public/bebo/robot.js', 'utf8');
		for (const name of atlases) {
			expect(src).toContain(`'${name}'`);
			const file = `public/bebo/${name}`;
			expect(existsSync(file)).toBe(true);
			expect(readFileSync(file).subarray(1, 4).toString()).toBe('PNG');
		}
	});

	it('no Three.js / GSAP / GLB model remains in the app', () => {
		const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
		const deps = { ...pkg.dependencies, ...pkg.devDependencies };
		expect(deps['three']).toBeUndefined();
		expect(deps['@types/three']).toBeUndefined();
		expect(deps['gsap']).toBeUndefined();
		expect(existsSync('public/assets/models')).toBe(false);
		expect(existsSync('src/app/sheards/robot-avatar')).toBe(false);

		const offenders: string[] = [];
		const walk = (dir: string) => {
			for (const name of readdirSync(dir)) {
				const p = join(dir, name);
				if (statSync(p).isDirectory()) walk(p);
				// Production sources only (specs legitimately assert absence).
				else if ((p.endsWith('.ts') || p.endsWith('.html')) && !p.endsWith('.spec.ts')) {
					const text = readFileSync(p, 'utf8');
					if (/from ['"](three|gsap)(\/|['"])|\.glb\b|app-robot-avatar|robot-avatar\//.test(text)) offenders.push(p);
				}
			}
		};
		walk('src');
		expect(offenders).toEqual([]);
	});
});
