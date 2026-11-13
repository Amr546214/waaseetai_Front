import { Injectable, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IdentityGateSaveBody, IdentityGateState, IdentityGateStatus } from './identity-gate.service';

/** Test double of the identity gate (the real one talks to the backend). Set `FakeIdentityGate.status` before creating the component. */
@Injectable()
export class FakeIdentityGate {
	static status: IdentityGateStatus = 'APPROVED';
	static reason: string | null = null;
	static saved: IdentityGateSaveBody[] = [];
	static reset(status: IdentityGateStatus = 'APPROVED') { FakeIdentityGate.status = status; FakeIdentityGate.reason = null; FakeIdentityGate.saved = []; }
	private snap = (): IdentityGateState => ({ status: FakeIdentityGate.status, rejectionReason: FakeIdentityGate.reason, canAdvance: FakeIdentityGate.status === 'APPROVED', submittedAt: null, missing: [], data: { hasFront: true, hasBack: true } });
	readonly state = signal<IdentityGateState | null>(null);
	readonly saving = signal(false);
	readonly loadFailed = signal(false);
	readonly status = computed(() => this.state()?.status ?? null);
	readonly canAdvance = computed(() => this.state()?.canAdvance === true);
	use() { return this; }
	load(): Observable<IdentityGateState> { const s = this.snap(); this.state.set(s); return of(s); }
	save(body: IdentityGateSaveBody): Observable<IdentityGateState> { FakeIdentityGate.saved.push(body); if (FakeIdentityGate.status === 'APPROVED' || FakeIdentityGate.status === 'REJECTED' || FakeIdentityGate.status === 'NOT_SUBMITTED') FakeIdentityGate.status = 'UNDER_REVIEW'; return this.load(); }
	apply(s: IdentityGateState) { this.state.set(s); }
	refusedByServer() { this.load(); }
	startPolling() {} stopPolling() {}
}
