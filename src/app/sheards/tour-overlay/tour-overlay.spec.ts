import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { TourOverlayComponent } from './tour-overlay';
import { TourService } from '../../core/tour/tour.service';

describe('TourOverlayComponent', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
		vi.stubGlobal('Audio', class { onplaying: any; onended: any; onerror: any; play() { return Promise.resolve(); } pause() {} });
		TestBed.configureTestingModule({ imports: [TourOverlayComponent], providers: [{ provide: Router, useValue: { url: '/', navigateByUrl: () => Promise.resolve(true) } }] });
	});
	afterEach(() => { TestBed.inject(TourService).close(); vi.unstubAllGlobals(); });
	const make = () => { const f = TestBed.createComponent(TourOverlayComponent); f.detectChanges(); return f; };
	const t = () => TestBed.inject(TourService);
	const demo = { id: 'd', title: 'D', steps: [{ id: 'a', title: 'العنوان الأول', text: 'النص الأول' }, { id: 'b', title: 'الثاني', text: 'النص الثاني' }] };

	it('shows nothing without a tour; with one it shows the step title, text and counter', () => {
		const f = make(); expect(f.nativeElement.querySelector('[data-testid=tour-card]')).toBeNull();
		t().start(demo); f.detectChanges();
		const el: HTMLElement = f.nativeElement;
		expect(el.querySelector('[data-testid=tour-text]')!.textContent).toContain('النص الأول');
		expect(el.querySelector('.ws-tx-title')!.textContent).toContain('العنوان الأول');
		expect(el.querySelector('[data-testid=tour-count]')!.textContent).toContain('1 / 2');
		expect(el.querySelector('[data-testid=tour-back]')).toBeNull();
	});
	it('next goes on, the last step says «إنهاء» and finishing closes the overlay; skip and × close it', () => {
		const f = make(); t().start(demo); f.detectChanges();
		(f.nativeElement.querySelector('[data-testid=tour-next]') as HTMLButtonElement).click(); f.detectChanges();
		expect(f.nativeElement.querySelector('[data-testid=tour-text]').textContent).toContain('النص الثاني');
		expect(f.nativeElement.querySelector('[data-testid=tour-next]').textContent).toContain('إنهاء');
		expect(f.nativeElement.querySelector('[data-testid=tour-back]')).not.toBeNull();
		(f.nativeElement.querySelector('[data-testid=tour-next]') as HTMLButtonElement).click(); f.detectChanges();
		expect(t().active()).toBe(false); expect(f.nativeElement.querySelector('[data-testid=tour-card]')).toBeNull();
		t().start(demo); f.detectChanges(); (f.nativeElement.querySelector('[data-testid=tour-skip]') as HTMLButtonElement).click(); expect(t().active()).toBe(false);
		t().start(demo); f.detectChanges(); (f.nativeElement.querySelector('[data-testid=tour-close]') as HTMLButtonElement).click(); expect(t().active()).toBe(false);
	});
	it('keyboard: Escape closes; in the RTL page ArrowLeft goes forward and ArrowRight goes back', () => {
		const f = make(); t().start(demo); f.detectChanges();
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' })); expect(t().index()).toBe(1);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); expect(t().index()).toBe(0);
		document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); expect(t().active()).toBe(false);
	});
	it('the mute button toggles and reflects its state accessibly; the card is an aria-modal dialog', () => {
		const f = make(); t().start(demo); f.detectChanges();
		const card = f.nativeElement.querySelector('[data-testid=tour-card]'); expect(card.getAttribute('role')).toBe('dialog'); expect(card.getAttribute('aria-modal')).toBe('true');
		const mute = f.nativeElement.querySelector('[data-testid=tour-mute]') as HTMLButtonElement; mute.click(); f.detectChanges();
		expect(mute.getAttribute('aria-pressed')).toBe('true'); expect(mute.getAttribute('aria-label')).toBe('تشغيل الصوت');
	});
	it('the auto-advance button toggles and reflects its state accessibly', () => {
		const f = make(); t().start(demo); f.detectChanges();
		const btn = f.nativeElement.querySelector('[data-testid=tour-auto]') as HTMLButtonElement;
		expect(btn.getAttribute('aria-pressed')).toBe('true');
		btn.click(); f.detectChanges();
		expect(btn.getAttribute('aria-pressed')).toBe('false'); expect(btn.getAttribute('aria-label')).toBe('تشغيل الانتقال التلقائي');
	});
});
