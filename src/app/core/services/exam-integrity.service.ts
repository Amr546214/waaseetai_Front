import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SpecialtyService } from './specialty.service';

export type ExamEventType = 'PAGE_HIDDEN' | 'PAGE_VISIBLE' | 'WINDOW_BLUR' | 'WINDOW_FOCUS' | 'LEFT_EXAM_MODE' | 'OFFLINE' | 'ONLINE' | 'PAGE_RELOADED';

/**
 * Records what happens to the test page (tab hidden, window left, offline, reload) as EVENTS for the reviewers. It never blocks, fails or scores anything, and a window blur on its own
 * is only an event (a notification, a system dialog or a second monitor also blur the window). Silent: no loader, no toast, no flash; events wait in memory while offline and go out
 * when the connection returns. It does NOT claim to protect the device: a normal website cannot restrict other apps or stop screen capture (that is what the restricted exam mode is for).
 */
@Injectable({ providedIn: 'root' })
export class ExamIntegrityService {
	private readonly specialty = inject(SpecialtyService);
	private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
	private attemptId: string | null = null;
	private queue: ExamEventType[] = [];
	private cleanup: (() => void) | null = null;

	start(attemptId: string, reloaded = false): void {
		if (!this.browser || this.attemptId === attemptId) return;
		this.stop();
		this.attemptId = attemptId;
		const d = document, w = window;
		const onVis = () => this.log(d.visibilityState === 'hidden' ? 'PAGE_HIDDEN' : 'PAGE_VISIBLE');
		const onBlur = () => this.log('WINDOW_BLUR'), onFocus = () => this.log('WINDOW_FOCUS');
		const onOff = () => this.log('OFFLINE'), onOn = () => { this.log('ONLINE'); this.flush(); };
		d.addEventListener('visibilitychange', onVis); w.addEventListener('blur', onBlur); w.addEventListener('focus', onFocus); w.addEventListener('offline', onOff); w.addEventListener('online', onOn);
		this.cleanup = () => { d.removeEventListener('visibilitychange', onVis); w.removeEventListener('blur', onBlur); w.removeEventListener('focus', onFocus); w.removeEventListener('offline', onOff); w.removeEventListener('online', onOn); };
		if (reloaded) this.log('PAGE_RELOADED');
	}
	stop(): void { this.cleanup?.(); this.cleanup = null; this.attemptId = null; this.queue = []; }
	log(type: ExamEventType): void {
		if (!this.attemptId) return;
		this.queue.push(type);
		if (this.queue.length > 100) this.queue.shift();
		this.flush();
	}
	private flush(): void {
		const id = this.attemptId;
		if (!id || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
		const next = this.queue.shift();
		if (!next) return;
		this.specialty.logAttemptEvent(id, next).subscribe({ next: () => this.flush(), error: () => { /* best effort: an event is information, never a reason to disturb the test */ } });
	}
}
