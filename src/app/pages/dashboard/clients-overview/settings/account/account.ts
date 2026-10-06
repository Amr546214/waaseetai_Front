import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-client-settings-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account.html',
  styles: [`
    :host {
      display: block;
      width: 100%;
      animation: ws-fade 0.2s ease forwards;
    }
    @keyframes ws-fade {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes skel-pulse {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .skeleton-box, .skeleton-row {
      background: linear-gradient(90deg, rgba(255,255,255,.05) 25%, rgba(255,255,255,.10) 50%, rgba(255,255,255,.05) 75%);
      background-size: 200% 100%;
      animation: skel-pulse 1.5s infinite;
    }
    :host-context(body.light-theme) .skeleton-box,
    :host-context(body.theme-light) .skeleton-box,
    :host-context(.light-theme) .skeleton-box,
    :host-context(.theme-light) .skeleton-box,
    :host-context(body.light-theme) .skeleton-row,
    :host-context(body.theme-light) .skeleton-row,
    :host-context(.light-theme) .skeleton-row,
    :host-context(.theme-light) .skeleton-row {
      background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
      background-size: 200% 100%;
    }

    /* Switch Component */
    .sw {
      position: relative;
      width: 44px;
      height: 25px;
      flex-shrink: 0;
      cursor: pointer;
      display: inline-block;
    }
    .sw input {
      opacity: 0;
      width: 0;
      height: 0;
      position: absolute;
    }
    .sw-track {
      position: absolute;
      inset: 0;
      background: var(--sec-bd, rgba(255,255,255,.12));
      border-radius: 20px;
      transition: background .2s;
    }
    :host-context(body.light-theme) .sw-track,
    :host-context(body.theme-light) .sw-track,
    :host-context(.light-theme) .sw-track,
    :host-context(.theme-light) .sw-track {
      background: #CBD5E1;
    }
    .sw-thumb {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 19px;
      height: 19px;
      background: #fff;
      border-radius: 50%;
      transition: transform .2s cubic-bezier(0.4, 0.0, 0.2, 1);
      box-shadow: 0 1px 3px rgba(0,0,0,.15);
    }
    .sw input:checked + .sw-track {
      background: linear-gradient(135deg, #2BD4C7, #2B7FFF);
    }
    .sw input:checked + .sw-track .sw-thumb {
      transform: translateX(-19px);
    }

    /* Select */
    .set-sel {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.10);
      border-radius: 9px;
      padding: 9px 13px;
      font-size: 13px;
      color: #fff;
      font-family: inherit;
      cursor: pointer;
      min-width: 140px;
    }
    :host-context(body.light-theme) .set-sel,
    :host-context(body.theme-light) .set-sel,
    :host-context(.light-theme) .set-sel,
    :host-context(.theme-light) .set-sel {
      background: #F6F8FC;
      border-color: #C9D0E3;
      color: #0F172A;
    }
    :host-context(body.light-theme) .set-sel-lbl,
    :host-context(body.theme-light) .set-sel-lbl,
    :host-context(.light-theme) .set-sel-lbl,
    :host-context(.theme-light) .set-sel-lbl {
      color: #0F172A;
    }
    :host-context(body.light-theme) .set-edit,
    :host-context(body.theme-light) .set-edit,
    :host-context(.light-theme) .set-edit,
    :host-context(.theme-light) .set-edit {
      background: rgba(43,127,255,.08);
      border-color: #C9D6F0;
    }

    /* Danger Card */
    .danger-card {
      background: rgba(255,140,105,.05);
      border: 1px solid rgba(255,140,105,.22);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .danger-card .dh {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 900;
      color: #FF8C69;
      margin-bottom: 6px;
    }
    .danger-card p {
      font-size: 12.5px;
      color: #A8B2D1;
      line-height: 1.6;
      margin-bottom: 14px;
    }
    .danger-btn {
      padding: 10px 18px;
      background: rgba(255,140,105,.12);
      border: 1px solid rgba(255,140,105,.3);
      border-radius: 9px;
      color: #FF8C69;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }
    .danger-btn:hover {
      background: rgba(255,140,105,.2);
    }
    :host-context(body.light-theme) .danger-card,
    :host-context(body.theme-light) .danger-card,
    :host-context(.light-theme) .danger-card,
    :host-context(.theme-light) .danger-card {
      background: rgba(255,140,105,.06);
      border-color: rgba(255,140,105,.3);
    }
    :host-context(body.light-theme) .danger-card p,
    :host-context(body.theme-light) .danger-card p,
    :host-context(.light-theme) .danger-card p,
    :host-context(.theme-light) .danger-card p {
      color: #5B6472;
    }

  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Account {
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  // NOTE: no backend endpoint exists yet for 2FA / login-alert preferences (checked
  // AccountService, AuthApiService, ProfileApiService, AccountLogsService — none expose
  // a 2FA/login-alert read or write method). These signals are display-only and are
  // never persisted; the toggles are rendered disabled in the template so the UI does
  // not imply a save that never happens. See BACKEND_BLOCKED_ISSUES.md.
  twoFactorAuth = signal<boolean>(true);
  newLoginAlert = signal<boolean>(true);

  language = signal<string>('العربية');
  timezone = signal<string>('توقيت الرياض (GMT+3)');
  currency = signal<string>('دولار أمريكي (USD)');
  dateFormat = signal<string>('هجري وميلادي');

  showProfile = signal<boolean>(true);
  shareData = signal<boolean>(true);

  manageDevices() {
    this.showToast('عرض الأجهزة النشطة وإنهاء الجلسات');
  }

  // Account deletion has no backend endpoint (no delete/deactivate-account method on
  // any service in src/app/core/services). Sending the user to the existing support
  // ticket flow is the honest option here — it does not claim the deletion itself
  // happened, only that a human channel has been opened. See BACKEND_BLOCKED_ISSUES.md.
  contactSupportForDeletion() {
    this.router.navigate(['/client-overview/help/tickets/new']);
  }

  retry() {
    this.hasError.set(false);
    this.isLoading.set(true);
    setTimeout(() => {
      this.isLoading.set(false);
    }, 1000);
  }

  showToast(msg: string) {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }
}
