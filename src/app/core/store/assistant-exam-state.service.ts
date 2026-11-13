import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * «Exam mode» of the page: while a specialty test is on, the floating assistant, the chat, the navigation and every other overlay are removed so the test is a screen of its own.
 * It only starts the assistant's sockets/capabilities never (visibility only). Reload and direct entry: a short-lived marker in sessionStorage keeps exam mode on from the very first
 * paint (no flash of the normal page), until the page has asked the SERVER whether an attempt is really live; the server stays the authority, the marker is only a hint.
 */
const MARKER = 'ws.exam.active';
const MARKER_TTL_MS = 25 * 60_000; // longer than an attempt (15 min + grace): a forgotten marker can never hide the site for long

function readMarker(platformId: object): boolean {
	if (!isPlatformBrowser(platformId)) return false;
	try { const t = Number(sessionStorage.getItem(MARKER)); return Number.isFinite(t) && t > Date.now(); } catch { return false; }
}

@Injectable({ providedIn: 'root' })
export class AssistantExamState {
	private readonly platformId = inject(PLATFORM_ID);
	readonly examActive = signal(readMarker(this.platformId));
	/** true while the page has not yet heard from the server whether an attempt is live (the marker alone keeps exam mode on). */
	readonly resolving = signal(this.examActive());

	setExamActive(active: boolean): void {
		this.examActive.set(active);
		if (!isPlatformBrowser(this.platformId)) return;
		try { if (active) sessionStorage.setItem(MARKER, String(Date.now() + MARKER_TTL_MS)); else sessionStorage.removeItem(MARKER); } catch { /* storage blocked: the signal still works for this page */ }
	}
	/** The server answered: from now on the page decides exam mode itself. */
	resolved(): void { this.resolving.set(false); }
}
