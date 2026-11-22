import { Injectable, OnDestroy, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { SKIP_LOADING } from '../interceptors/loading.interceptor';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type IdentityGateStatus = 'NOT_SUBMITTED' | 'UNDER_REVIEW' | 'REJECTED' | 'APPROVED';
export type IdentityGateParty = 'CLIENT' | 'PROVIDER';

/** What the owner may see of his own identity review (backend contract id-gate-api-contract.md, section 2). */
export interface IdentityGateState {
	status: IdentityGateStatus;
	rejectionReason: string | null;
	canAdvance: boolean;
	automaticCheck?: 'MATCHED' | 'CHECKING' | 'NEEDS_REVIEW' | 'NOT_CHECKED';
	submittedAt: string | null;
	missing: string[];
	data: { idNumber?: string | null; idIssuingCountry?: string | null; idDocumentType?: string | null; dob?: string | null; hasFront: boolean; hasBack: boolean };
}

export interface IdentityGateSaveBody {
	idIssuingCountry?: string;
	idDocumentType?: string;
	idNumber?: string;
	dob?: string;
	frontId?: string;
	backId?: string;
	/** remove the stored back side (it is optional) */
	removeBackId?: boolean;
}

/** The server refuses a skipped step with 409 + code IDENTITY_NOT_APPROVED (contract section 3). */
export function isIdentityNotApproved(err: any): boolean {
	const e = err?.error;
	return err?.status === 409 && (e?.code === 'IDENTITY_NOT_APPROVED' || (Array.isArray(e?.errors) && e.errors.some((x: any) => x?.code === 'IDENTITY_NOT_APPROVED')));
}

/** errors[0].reason of a 409 IDENTITY_NOT_APPROVED (e.g. EVIDENCE_CHANGED_IN_SUBMISSION), or null. */
export function identityRefusalReason(err: any): string | null {
	const list = err?.error?.errors;
	const r = Array.isArray(list) ? list.find((x: any) => x?.code === 'IDENTITY_NOT_APPROVED')?.reason : null;
	return typeof r === 'string' ? r : null;
}

/** The sentence shown on the identity step after the server refused a submission. */
export function identityRefusalMessage(err: any): string {
	if (identityRefusalReason(err) === 'EVIDENCE_CHANGED_IN_SUBMISSION')
		return 'الصورة أو بيانات الهوية في هذا الإرسال تختلف عن الوثيقة المعتمدة، فلم يُحفظ شيء. أرسل أي تغيير من خطوة الهوية هذه وانتظر اكتمال المطابقة أو المراجعة قبل المتابعة.';
	return err?.error?.message || 'لم تكتمل مطابقة بيانات الهوية أو مراجعتها بعد؛ حاول مرة أخرى بعد اكتمال التحقق.';
}

const POLL_FIRST_MS = 3_000;
const POLL_MAX_MS = 60_000;

/**
 * One identity gate per wizard (component-provided, never shared between pages). The server is the only authority: the next step opens only
 * while `canAdvance()` is true, the CURRENT image + data are manually approved or fully matched for setup progression. While under review the state is polled with a growing delay
 * (3s -> 60s), only when the tab is visible, and never in parallel with another request.
 */
@Injectable()
export class IdentityGateService implements OnDestroy {
	private http = inject(HttpClient);
	private party: IdentityGateParty = 'CLIENT';
	private timer: ReturnType<typeof setTimeout> | null = null;
	private delay = POLL_FIRST_MS;
	private inFlight = false;

	readonly state = signal<IdentityGateState | null>(null);
	readonly saving = signal(false);
	/** a state read failed (network): the previous state stays, nothing opens. */
	readonly loadFailed = signal(false);
	readonly status = computed<IdentityGateStatus | null>(() => this.state()?.status ?? null);
	readonly canAdvance = computed(() => !this.saving() && !this.loadFailed() && this.state()?.canAdvance === true && (this.state()?.status === 'APPROVED' || (this.state()?.status === 'UNDER_REVIEW' && this.state()?.automaticCheck === 'MATCHED')));

	use(party: IdentityGateParty) { this.party = party; return this; }

	private get url() { return `${environment.url_api}/${this.party === 'CLIENT' ? 'client' : 'provider'}/profile/setup/identity`; }

	load(silent = false): Observable<IdentityGateState> {
		return this.http.get<{ data: IdentityGateState }>(this.url, silent ? { context: new HttpContext().set(SKIP_LOADING, true) } : {}).pipe(
			map(r => r.data),
			tap({ next: s => { this.loadFailed.set(false); this.apply(s); }, error: () => this.loadFailed.set(true) })
		);
	}

	/** The identity step save: stores data + files and starts (or restarts) the review. A change after approval cancels the approval. */
	save(body: IdentityGateSaveBody): Observable<IdentityGateState> {
		this.saving.set(true);
		// SKIP_LOADING: the identity panel shows its own state; the app-wide loading overlay made every save look like a page reload
		return this.http.put<{ data: IdentityGateState }>(this.url, body, { context: new HttpContext().set(SKIP_LOADING, true) }).pipe(
			map(r => r.data),
			tap({ next: s => { this.saving.set(false); this.apply(s); }, error: () => this.saving.set(false) })
		);
	}

	/** Takes a state that came from another endpoint (e.g. the 409 body) into account. */
	apply(s: IdentityGateState) {
		this.loadFailed.set(false);
		this.state.set(s);
		if (s.status === 'UNDER_REVIEW' && !this.canAdvance()) this.startPolling(); else this.stopPolling();
	}

	/** Forces the local state to «not approved» after the server refused a skipped step, then re-reads the real one. */
	refusedByServer() {
		this.stopPolling();
		this.state.update(s => s ? { ...s, canAdvance: false } : s);
		this.load().subscribe({ error: () => { /* the refusal message stays; nothing opens */ } });
	}

	startPolling() {
		if (this.timer) return;
		this.schedule();
	}

	private schedule() {
		this.timer = setTimeout(() => {
			this.timer = null;
			if (typeof document !== 'undefined' && document.visibilityState === 'hidden') { this.schedule(); return; }
			if (this.inFlight || this.status() !== 'UNDER_REVIEW') { if (this.status() === 'UNDER_REVIEW') this.schedule(); return; }
			this.inFlight = true;
			this.load(true).subscribe({
				next: () => { this.inFlight = false; this.delay = Math.min(this.delay * 1.5, POLL_MAX_MS); },
				error: () => { this.inFlight = false; this.delay = POLL_MAX_MS; if (this.status() === 'UNDER_REVIEW') this.schedule(); }
			});
		}, this.delay);
	}

	stopPolling() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = null;
		this.delay = POLL_FIRST_MS;
	}

	ngOnDestroy() { this.stopPolling(); }
}
