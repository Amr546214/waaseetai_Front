import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ArbDepositService, ArbQuote, ArbView } from '../../core/services/arb-deposit.service';
import { mapHttpError } from '../../core/forms/http-error';

/**
 * Bank-card option inside the deposit dialog. Invisible unless the server says the rail is available (so nothing changes while it is off).
 * Sends ONLY the net USD amount; shows the server's own quote (what will be charged, in which currency) before the user leaves for the bank.
 * It never receives or stores card data: the card is typed on the bank's page.
 */
@Component({
	selector: 'app-arb-card-deposit',
	standalone: true,
	imports: [CommonModule],
	template: `
	@if (available()) {
	<div class="arb-card-box" data-testid="arb-card-box">
		<div class="arb-card-head"><span>الدفع بالبطاقة (مدى / فيزا / ماستركارد)</span><span class="arb-badge">صفحة البنك الآمنة</span></div>
		@if (quote(); as q) {
		<div class="arb-quote" data-testid="arb-quote">
			<div><span>صافي ما يُضاف إلى محفظتك</span><b>{{ q.netUsd | number:'1.2-2' }} $</b></div>
			<div><span>رسوم الدفع بالبطاقة ({{ q.feePercent }}%)</span><b>{{ q.feeUsd | number:'1.2-2' }} $</b></div>
			<div><span>سعر التحويل المعتمد</span><b data-testid="arb-quote-rate">1 دولار = {{ q.sarPerUsd }} ريال</b></div>
			<div><span>سيُحصَّل من بطاقتك بالريال السعودي (SAR)</span><b data-testid="arb-quote-sar">{{ q.chargedSar | number:'1.2-2' }} ر.س</b></div>
			<div><span>رصيد محفظتك بالدولار بعد الدفع</span><b data-testid="arb-quote-wallet">+ {{ q.netUsd | number:'1.2-2' }} $</b></div>
		</div>
		}
		@if (quoteError()) { <div class="arb-err" role="alert" data-testid="arb-quote-error">{{ quoteError() }}</div> }
		@if (unsettled(); as u) {
		<div class="arb-warn" role="alert" data-testid="arb-unsettled">
			<div class="arb-warn-t">{{ u.message }}</div>
			<div>{{ u.nextStep }}</div>
			<label class="arb-ack"><input type="checkbox" data-testid="arb-ack" [checked]="ack()" (change)="ack.set($any($event.target).checked)" /> أفهم أن العملية السابقة قد تُحصَّل لاحقًا وقد يُخصم مني مبلغان</label>
			<a class="arb-link" [href]="walletLink(u)" data-testid="arb-follow-previous">متابعة العملية السابقة على صفحة المحفظة</a>
		</div>
		}
		<button type="button" class="arb-pay" data-testid="arb-pay" [disabled]="busy() || blocked() || (unsettled() !== null && !ack())" [attr.aria-busy]="busy()" aria-describedby="arb-msg" (click)="pay()">
			{{ busy() ? 'جارٍ تجهيز صفحة البنك…' : (unsettled() ? 'بدء عملية جديدة رغم ذلك' : 'المتابعة إلى صفحة البنك') }}
		</button>
		<div id="arb-msg" aria-live="polite">
			@if (error()) { <div class="arb-err" role="alert" data-testid="arb-error">{{ error() }}</div> }
			@if (info()) { <div class="arb-info" role="status" data-testid="arb-info">{{ info() }}</div> }
		</div>
		<div class="arb-note">لا تدخل بيانات البطاقة في منصة وسيط AI: تُدخلها في صفحة البنك فقط.</div>
	</div>
	}`,
	styles: [`.arb-card-box{border:1px solid var(--border,#2a3350);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;margin-top:8px}
	.arb-card-head{display:flex;justify-content:space-between;font-weight:800;font-size:12px}.arb-badge{font-size:9px;opacity:.7}
	.arb-quote{display:flex;flex-direction:column;gap:4px;font-size:11px}.arb-quote div{display:flex;justify-content:space-between}
	.arb-pay{border-radius:10px;padding:9px 12px;font-weight:800;font-size:12px;background:#2BD4C7;color:#04121f;cursor:pointer}.arb-pay[disabled]{opacity:.55;cursor:not-allowed}
	.arb-warn{border:1px solid #FFB400;border-radius:10px;padding:8px;font-size:11px;display:flex;flex-direction:column;gap:6px;background:rgba(255,180,0,.08)}.arb-warn-t{font-weight:800}.arb-ack{display:flex;gap:6px;align-items:flex-start}.arb-link{font-weight:800}
	.arb-err{color:#FF8C69;font-size:11px;font-weight:700}.arb-info{color:#FFB400;font-size:11px;font-weight:700}.arb-note{font-size:10px;opacity:.65}`],
})
export class ArbCardDeposit implements OnInit, OnChanges {
	private arb = inject(ArbDepositService);
	private router = inject(Router);

	/** the net USD the user typed in the dialog (null = nothing valid yet) */
	@Input() amount: number | null = null;
	/** the dialog's own "I agree to the deposit terms" box */
	@Input() termsAccepted = false;
	/** asks the dialog to show its own "accept the terms" message under the box */
	@Output() termsMissing = new EventEmitter<void>();
	@Output() amountMissing = new EventEmitter<void>();

	available = signal(false);
	quote = signal<ArbQuote | null>(null);
	quoteError = signal('');
	busy = signal(false);
	/** a lost answer left us unsure whether an attempt exists: no new start until the user has checked */
	blocked = signal(false);
	/** an earlier attempt is not finally settled by the bank: the user must acknowledge before a new one starts */
	unsettled = signal<ArbView | null>(null);
	ack = signal(false);
	error = signal('');
	info = signal('');
	private quoteSeq = 0;

	ngOnInit(): void {
		this.arb.availability().subscribe({ next: r => { this.available.set(!!r?.data?.available); this.refreshQuote(); }, error: () => this.available.set(false) });
	}

	ngOnChanges(c: SimpleChanges): void {
		if (c['amount']) this.refreshQuote();
	}

	private refreshQuote(): void {
		const seq = ++this.quoteSeq;
		this.quote.set(null); this.quoteError.set('');
		const a = this.amount;
		if (a === null || !Number.isFinite(a) || a < 50 || a > 100000 || !this.available()) return;
		this.arb.quote(a).subscribe({
			next: r => { if (seq === this.quoteSeq && r?.success) this.quote.set(r.data); },
			error: e => { if (seq === this.quoteSeq) this.quoteError.set(mapHttpError(e, { fallback: 'تعذّر حساب المبلغ المطلوب الآن.' }).message); },
		});
	}

	walletLink(u: ArbView): string { return `/client-overview/finance/wallet?arb=${encodeURIComponent(u.previousReference ?? u.reference)}`; }

	/** overridable in tests; only an https address is ever followed */
	protected navigateTo(url: string): void {
		const u = new URL(url);
		if (u.protocol !== 'https:') throw new Error('refused non-https destination');
		window.location.assign(u.toString());
	}

	pay(): void {
		if (!this.available() || this.busy() || this.blocked()) return;
		this.error.set(''); this.info.set('');
		if (this.amount === null || this.amount < 50 || this.amount > 100000) { this.amountMissing.emit(); return; }
		if (!this.termsAccepted) { this.termsMissing.emit(); return; }
		this.busy.set(true);
		const acknowledged = this.unsettled() !== null && this.ack();
		this.arb.initiate(this.amount, acknowledged).subscribe({
			next: r => {
				this.busy.set(false);
				const v = r?.data;
				if (v?.requiresAcknowledgement) { this.unsettled.set(v); this.ack.set(false); return; } // warn first, nothing is started silently
				this.unsettled.set(null); this.ack.set(false);
				if (!r?.success || !v) { this.error.set('تعذّر بدء الدفع بالبطاقة، ولم يُخصم أي مبلغ. حاول مرة أخرى.'); return; }
				if (v.state === 'WAITING_PAGE' && v.redirectUrl) {
					this.info.set('جارٍ تحويلك إلى صفحة البنك الآمنة…');
					try { this.navigateTo(v.redirectUrl); } catch { this.info.set(''); this.error.set('تعذّر فتح صفحة البنك بأمان. حاول مرة أخرى.'); }
					return;
				}
				if (v.state === 'FAILED' || v.state === 'DECLINED') { this.error.set(`${v.message} ${v.nextStep}`); return; }
				// an attempt of yours is already open / being verified: follow it on the wallet page instead of starting another
				this.router.navigate(['/client-overview/finance/wallet'], { queryParams: { arb: v.reference } });
			},
			error: e => {
				this.busy.set(false);
				const m = mapHttpError(e, { fallback: 'تعذّر بدء الدفع بالبطاقة. لم يُخصم أي مبلغ.' });
				if (m.outcomeUnknown) { this.checkAfterLostAnswer(); return; }
				this.error.set(m.message);
			},
		});
	}

	/** The answer to "start" was lost: the server may have created the attempt. Look for it before allowing another start. */
	private checkAfterLostAnswer(): void {
		this.blocked.set(true);
		this.info.set('انقطع الاتصال أثناء بدء الدفع. نتحقق الآن إن كان الطلب وصل…');
		this.arb.open().subscribe({
			next: r => {
				if (r?.success && r.data) { this.router.navigate(['/client-overview/finance/wallet'], { queryParams: { arb: r.data.reference } }); return; }
				this.blocked.set(false); this.info.set('');
				this.error.set('لم يصل الطلب إلى الخادم، ولم يُخصم أي مبلغ. يمكنك المحاولة مرة أخرى.');
			},
			error: () => { this.info.set(''); this.error.set('تعذّر التأكد من وصول الطلب. افتح صفحة المحفظة وتحقق من حالة الدفع قبل المحاولة مرة أخرى حتى لا يتكرر.'); },
		});
	}
}
