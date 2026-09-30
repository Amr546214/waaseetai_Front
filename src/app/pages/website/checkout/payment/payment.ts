import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../../../core/services/cart.service';
import { CheckoutService, InsufficientBalanceInfo } from '../../../../core/services/checkout.service';
import { CheckoutApiService } from '../../../../core/services/checkout-api.service';
import { DepositModal } from '../../../../sheards/deposit-modal/deposit-modal';

@Component({
  selector: 'app-checkout-payment',
  standalone: true,
  imports: [CommonModule, RouterLink, DepositModal],
  templateUrl: './payment.html',
  styleUrls: ['../components/checkout-tokens.css', './payment.css'],
})
export class CheckoutPaymentComponent implements OnInit {
  step = 3;

  private cartService = inject(CartService);
  private checkoutService = inject(CheckoutService);
  private checkoutApi = inject(CheckoutApiService);
  private router = inject(Router);

  items = this.cartService.items;
  itemCount = this.cartService.itemCount;
  subtotal = this.cartService.subtotal;
  discount = this.cartService.discount;
  total = this.cartService.total;
  coupon = this.cartService.coupon;
  currentOrder = this.checkoutService.currentOrder;

  isProcessing = signal(false);
  errorMessage = signal<string | null>(null);
  agreedToTerms = signal(false);

  // Wallet-only internal purchasing: 'wallet' is the ONLY payment method —
  // there is no selector anymore. This page reads the authoritative wallet
  // balance (never trusts a frontend-only value) so the "confirm purchase"
  // vs. "insufficient balance" UI can be shown correctly BEFORE the user
  // even attempts to pay.
  walletBalance = signal<number | null>(null);
  balanceLoading = signal(false);
  showAddFunds = signal(false);

  // Set ONLY when the backend itself reports a 402 insufficient-balance
  // response (the advisory initPayment() pre-check, or a genuine
  // concurrent-spend race caught at confirm time) — takes priority over the
  // plain client-side shortfall computed from the last-loaded balance below.
  private raceInsufficientBalance = signal<InsufficientBalanceInfo | null>(null);

  activeItems = computed(() => this.items().filter(i => !i.savedForLater));

  shortfall = computed(() => {
    const race = this.raceInsufficientBalance();
    if (race) return race.shortfall;
    const balance = this.walletBalance();
    if (balance === null) return 0;
    return Math.max(0, Math.round((this.total() - balance) * 100) / 100);
  });

  hasSufficientBalance = computed(() => {
    if (this.raceInsufficientBalance()) return false;
    const balance = this.walletBalance();
    return balance !== null && balance >= this.total();
  });

  canPay = computed(() => {
    return this.hasSufficientBalance() && !this.isProcessing() && this.itemCount() > 0 && this.agreedToTerms();
  });

  ngOnInit() {
    this.loadWalletBalance();
  }

  private loadWalletBalance() {
    this.balanceLoading.set(true);
    this.checkoutApi.getPaymentMethods().subscribe({
      next: (res: any) => {
        const data = res?.data ?? res;
        const methods = Array.isArray(data) ? data : [];
        const wallet = methods.find((m: any) => m.id === 'wallet');
        this.walletBalance.set(typeof wallet?.balance === 'number' ? wallet.balance : 0);
        this.balanceLoading.set(false);
      },
      error: (err: any) => {
        console.error('[Payment] Failed to load wallet balance:', err);
        this.walletBalance.set(null);
        this.balanceLoading.set(false);
      },
    });
  }

  toggleTerms() {
    this.agreedToTerms.set(!this.agreedToTerms());
  }

  openAddFunds() {
    this.showAddFunds.set(true);
  }

  /**
   * Deliberately does NOT auto-submit the purchase after a successful
   * top-up — the refreshed balance is shown and the user explicitly clicks
   * "ادفع من المحفظة" again once sufficient, matching the approved flow
   * ("prefer requiring the user to confirm the Wallet purchase after the
   * refreshed balance is visible").
   */
  onWalletDepositComplete() {
    this.showAddFunds.set(false);
    this.raceInsufficientBalance.set(null);
    this.loadWalletBalance();
  }

  payNow() {
    if (!this.canPay()) return;

    this.isProcessing.set(true);
    this.errorMessage.set(null);
    this.raceInsufficientBalance.set(null);

    if (!this.currentOrder()) {
      this.checkoutService.createOrder().subscribe({
        next: (orderResult) => {
          if (!orderResult.success) {
            this.errorMessage.set(orderResult.message);
            this.isProcessing.set(false);
            return;
          }
          this.proceedToPaymentStep();
        },
        error: () => {
          this.errorMessage.set('حدث خطأ، حاول مرة أخرى');
          this.isProcessing.set(false);
        },
      });
      return;
    }

    this.proceedToPaymentStep();
  }

  private proceedToPaymentStep() {
    this.checkoutService.initiatePayment('wallet').subscribe({
      next: (result) => {
        if (result.success) {
          this.router.navigate(['/checkout/confirm']);
          return;
        }
        // Insufficient-wallet-balance ALWAYS takes priority — stay on this
        // page, surface Required/Current/Shortfall, refresh the balance,
        // and let the user Add Funds via the existing wallet-top-up flow.
        if (result.insufficientBalance) {
          this.isProcessing.set(false);
          this.raceInsufficientBalance.set(result.insufficientBalance);
          this.loadWalletBalance();
          return;
        }
        this.isProcessing.set(false);
        // Real backend business errors (a 409 conflict such as "you already
        // have an active request for this service", or a 400 validation
        // error) carry a safe, real message meant to be shown to the user —
        // never a payment failure, never the generic /checkout/failure
        // screen. Only a genuinely unexpected failure (5xx, network error,
        // an unrecognized shape) falls back to that neutral screen.
        if (result.errorKind === 'CONFLICT' || result.errorKind === 'VALIDATION') {
          this.errorMessage.set(result.message);
          return;
        }
        this.router.navigate(['/checkout/failure']);
      },
      error: () => {
        this.isProcessing.set(false);
        this.router.navigate(['/checkout/failure']);
      },
    });
  }

  formatPrice(value: number): string {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
  }

  walletAfterPay(): string {
    const balance = this.walletBalance();
    if (balance == null) return '—';
    return this.formatPrice(Math.max(0, balance - this.total()));
  }
}
