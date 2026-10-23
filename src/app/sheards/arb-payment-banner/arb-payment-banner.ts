import { Component, EventEmitter, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ArbDepositService, ArbView } from '../../core/services/arb-deposit.service';

/**
 * The state of the user's bank-card deposit, shown on the wallet page. It only ever shows what the SERVER verified with the bank:
 * the address the browser came back on (?arb=<reference>) is just a pointer to the attempt, never a result.
 * While the answer is not final it keeps asking (every 4 s, for up to 15 minutes) and never tells the user to pay again.
 */
@Component({
	selector: 'app-arb-payment-banner',
	standalone: true,
	imports: [CommonModule],
	template: `
	@if (view(); as v) {
	<div class="arb-banner" role="status" aria-live="polite" data-testid="arb-banner" [attr.data-state]="v.state" [class.arb-ok]="v.state === 'PAID'" [class.arb-bad]="v.state === 'DECLINED' || v.state === 'FAILED'" [class.arb-wait]="v.state === 'UNSETTLED' || v.state === 'VERIFYING' || v.state === 'WAITING_PAGE' || v.state === 'REVIEW' || v.state === 'CANCELLED' || v.state === 'EXPIRED'">
		<div class="arb-title" data-testid="arb-message">{{ v.message }}</div>
		<div class="arb-next" data-testid="arb-next">{{ v.nextStep }}</div>
		@if (v.state === 'PAID' && v.creditedUsd !== null) { <div class="arb-amount" data-testid="arb-credited">أُضيف إلى محفظتك: {{ v.creditedUsd | number:'1.2-2' }} $</div> }
		@if (v.state === 'WAITING_PAGE' && v.redirectUrl) { <a class="arb-link" [href]="v.redirectUrl" data-testid="arb-resume">العودة إلى صفحة الدفع</a> }
		@if (!v.bankFinal && v.state !== 'PAID' && v.state !== 'DECLINED' && v.state !== 'FAILED') { <button type="button" class="arb-link" data-testid="arb-refresh" [disabled]="checking()" (click)="refresh(v.reference)">تحديث الحالة</button> }
		@if (checking()) { <div class="arb-checking" data-testid="arb-checking">جارٍ التحقق…</div> }
		@if (pollError()) { <div class="arb-error" role="alert" data-testid="arb-poll-error">تعذّر الاتصال بالخادم للتحقق الآن. لا يعني ذلك أن الدفع فشل؛ سنحاول مرة أخرى تلقائيًا.</div> }
		<div class="arb-ref" dir="ltr">{{ v.reference }}</div>
	</div>
	}`,
	styles: [`.arb-banner{border:1px solid var(--border,#2a3350);border-radius:12px;padding:12px 14px;margin:12px 0;display:flex;flex-direction:column;gap:4px}
	.arb-title{font-weight:800;font-size:14px}.arb-next{font-size:12px;opacity:.85}.arb-amount{font-weight:800;font-size:13px}.arb-ref{font-size:10px;opacity:.5}
	.arb-ok{border-color:#0FA99A;background:rgba(15,169,154,.10)}.arb-bad{border-color:#FF8C69;background:rgba(255,140,105,.10)}.arb-wait{border-color:#FFB400;background:rgba(255,180,0,.08)}
	.arb-error{color:#D98A0B;font-size:12px}.arb-link{font-weight:800;font-size:12px}.arb-checking{font-size:11px;opacity:.7}`],
})
export class ArbPaymentBanner implements OnInit, OnDestroy {
	private arb = inject(ArbDepositService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	@Output() paid = new EventEmitter<ArbView>();

	view = signal<ArbView | null>(null);
	checking = signal(false);
	pollError = signal(false);
	private timer?: ReturnType<typeof setTimeout>;
	private stopAt = 0;
	private destroyed = false;
	static readonly POLL_MS = 4000;
	static readonly MAX_MS = 15 * 60_000;

	ngOnInit(): void {
		const ref = this.route.snapshot.queryParamMap.get('arb');
		this.stopAt = Date.now() + ArbPaymentBanner.MAX_MS;
		if (ref && ref !== 'unknown') { this.poll(ref); return; }
		// no pointer in the address (refresh, new tab, lost reply): pick up the user's open attempt, if any
		this.arb.open().subscribe({ next: r => { if (r?.success && r.data) this.accept(r.data); }, error: () => { /* nothing to show; the wallet itself is unaffected */ } });
		if (ref === 'unknown') this.view.set({ reference: '—', state: 'VERIFYING', message: 'لم نتعرّف على عملية الدفع من العنوان الذي عدت منه.', nextStep: 'إن كنت قد دفعت للتو فسنؤكد العملية تلقائيًا ويظهر الرصيد هنا. لا تُعد الدفع قبل أن نؤكد لك.', redirectUrl: null, creditedUsd: null, chargedSar: null, bankFinal: false, requiresAcknowledgement: false, previousReference: null });
	}

	ngOnDestroy(): void { this.destroyed = true; if (this.timer) clearTimeout(this.timer); }

	/** «تحديث الحالة»: asks the server (which asks the bank) right now. */
	refresh(ref: string): void { if (this.timer) clearTimeout(this.timer); this.poll(ref); }

	private poll(ref: string): void {
		if (this.destroyed) return;
		this.checking.set(true);
		this.arb.status(ref).subscribe({
			next: r => { this.checking.set(false); this.pollError.set(false); if (r?.success && r.data) this.accept(r.data, ref); },
			error: (e) => {
				this.checking.set(false);
				if (e?.status === 404) { this.view.set(null); return; }
				this.pollError.set(true); // a failed CHECK is not a failed payment: keep the last known state and keep asking
				this.next(ref);
			},
		});
	}

	private accept(v: ArbView, ref?: string): void {
		this.view.set(v);
		if (v.state === 'PAID') { this.paid.emit(v); this.router.navigate([], { queryParams: { arb: null }, queryParamsHandling: 'merge', replaceUrl: true }); return; }
		if ((v.state === 'VERIFYING' || v.state === 'WAITING_PAGE' || ((v.state === 'CANCELLED' || v.state === 'EXPIRED' || v.state === 'UNSETTLED') && !v.bankFinal)) && Date.now() < this.stopAt) this.next(ref ?? v.reference);
	}

	private next(ref: string): void {
		if (this.destroyed || Date.now() >= this.stopAt) return;
		this.timer = setTimeout(() => this.poll(ref), ArbPaymentBanner.POLL_MS);
	}
}
