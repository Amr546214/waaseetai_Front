import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';

export interface ProviderSession {
  id: string;
  browser?: string;
  os?: string;
  device?: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-provider-settings-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, WsSelectComponent],
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


    /* ===== Company Settings (P-CO-AC-009) ===== */
    .co-settings-page{display:block}
    .co-settings-page .bc{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt-2,#A8B2D1);margin-bottom:12px}
    .co-settings-page .bc a{color:var(--txt-2,#A8B2D1);text-decoration:none;cursor:pointer}
    .co-settings-page .bc a:hover{color:var(--teal-txt,#2BD4C7)}
    .co-settings-page .bc svg{width:10px;height:10px;opacity:.5}
    .co-settings-page .pg-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
    .co-settings-page .pg-title{font-size:19px;font-weight:900;color:#fff}
    .co-settings-page .pg-sub{font-size:12px;color:var(--txt-2,#A8B2D1);margin-top:3px}
    .co-card{background:linear-gradient(135deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:18px;margin-bottom:14px}
    .sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
    .sec-ttl{font-size:14px;font-weight:800;color:#fff}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .fld{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
    .fld label{font-size:11.5px;font-weight:700;color:#fff}
    .fld input,.fld textarea,.fld select{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:9px;padding:9px 12px;font-family:inherit;font-size:13px;color:#fff;outline:none;direction:rtl}
    .fld input:focus,.fld textarea:focus,.fld select:focus{border-color:rgba(43,212,199,.4)}
    .f2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .pill{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:20px;font-size:10.5px;font-weight:700}
    .pill-ok{background:rgba(15,169,154,.12);color:#2ECC8A;border:1px solid rgba(15,169,154,.28)}
    .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:9px;font-size:12.5px;font-weight:700;transition:all .15s;border:1px solid transparent;text-decoration:none;cursor:pointer;font-family:inherit}
    .btn svg{width:14px;height:14px}
    .btn-pri{background:linear-gradient(135deg,#2BD4C7,#2B7FFF);color:#070D24}
    .btn-pri:hover{filter:brightness(1.08)}
    .btn-sec{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.10);color:#fff}
    .btn-sec:hover{background:rgba(43,212,199,.08);border-color:rgba(43,212,199,.25);color:var(--teal-txt,#2BD4C7)}
    .st-row{display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .st-row:last-child{border-bottom:none}
    .st-b{flex:1;min-width:0}
    .st-t{font-size:12.5px;font-weight:700;color:#fff}
    .st-d{font-size:11px;color:var(--txt-2,#A8B2D1);margin-top:3px;line-height:1.6}
    .sw{width:40px;height:22px;border-radius:11px;background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.12);position:relative;cursor:pointer;flex-shrink:0;transition:all .18s}
    .sw::after{content:"";position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:#6B7699;transition:all .18s}
    .sw.on{background:rgba(43,212,199,.30);border-color:rgba(43,212,199,.55)}
    .sw.on::after{right:20px;background:#2BD4C7}
    .ses-row{display:flex;align-items:center;gap:12px;padding:11px 13px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:11px;margin-bottom:8px}
    .ses-row:last-child{margin-bottom:0}
    .ses-ic{width:32px;height:32px;border-radius:9px;background:rgba(93,160,255,.10);color:#5DA0FF;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .ses-ic svg{width:15px;height:15px}
    .ses-b{flex:1;min-width:0}
    .ses-t{font-size:12.5px;font-weight:700;color:#fff}
    .ses-d{font-size:10.5px;color:var(--txt-2,#A8B2D1);margin-top:2px}
    .st-end{background:none;border:1px solid rgba(255,100,80,.22);color:#FF8C69;border-radius:8px;padding:5px 12px;font-size:11px;font-weight:700;font-family:inherit;cursor:pointer;flex-shrink:0}
    .st-end:hover{background:rgba(255,100,80,.08)}
    .save-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;background:linear-gradient(135deg,rgba(43,212,199,.06),rgba(43,127,255,.03));border:1px solid rgba(43,212,199,.18);border-radius:13px;margin-top:14px}
    .inner-foot{margin-top:18px;padding:10px 0;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:var(--txt-2,#A8B2D1);border-top:1px solid rgba(255,255,255,.05);flex-wrap:wrap;gap:8px}
    .inner-foot-links{display:flex;gap:12px}
    .inner-foot-links a{color:var(--txt-2,#A8B2D1);text-decoration:none;cursor:pointer}
    .inner-foot-links a:hover{color:var(--teal-txt,#2BD4C7)}

    /* Company Settings: Light Mode */
    :host-context(body.light-theme) .co-card,
    :host-context(body.theme-light) .co-card,
    :host-context(.light-theme) .co-card,
    :host-context(.theme-light) .co-card{background:#fff;border-color:#E7EAF1}
    :host-context(body.light-theme) .co-settings-page .pg-title,
    :host-context(body.theme-light) .co-settings-page .pg-title,
    :host-context(.light-theme) .co-settings-page .pg-title,
    :host-context(.theme-light) .co-settings-page .pg-title{color:#0F172A}
    :host-context(body.light-theme) .co-settings-page .pg-sub,
    :host-context(body.theme-light) .co-settings-page .pg-sub,
    :host-context(.light-theme) .co-settings-page .pg-sub,
    :host-context(.theme-light) .co-settings-page .pg-sub{color:#64748B}
    :host-context(body.light-theme) .sec-ttl,
    :host-context(body.theme-light) .sec-ttl,
    :host-context(.light-theme) .sec-ttl,
    :host-context(.theme-light) .sec-ttl{color:#0F172A}
    :host-context(body.light-theme) .fld label,
    :host-context(body.theme-light) .fld label,
    :host-context(.light-theme) .fld label,
    :host-context(.theme-light) .fld label{color:#0F172A}
    :host-context(body.light-theme) .fld input,:host-context(body.light-theme) .fld select,
    :host-context(body.theme-light) .fld input,:host-context(body.theme-light) .fld select,
    :host-context(.light-theme) .fld input,:host-context(.light-theme) .fld select,
    :host-context(.theme-light) .fld input,:host-context(.theme-light) .fld select{background:rgba(15,23,42,.03);border-color:rgba(15,23,42,.10);color:#0F172A}
    :host-context(body.light-theme) .st-t,
    :host-context(body.theme-light) .st-t,
    :host-context(.light-theme) .st-t,
    :host-context(.theme-light) .st-t{color:#0F172A}
    :host-context(body.light-theme) .st-d,
    :host-context(body.theme-light) .st-d,
    :host-context(.light-theme) .st-d,
    :host-context(.theme-light) .st-d{color:#64748B}
    :host-context(body.light-theme) .ses-t,
    :host-context(body.theme-light) .ses-t,
    :host-context(.light-theme) .ses-t,
    :host-context(.theme-light) .ses-t{color:#0F172A}
    :host-context(body.light-theme) .ses-d,
    :host-context(body.theme-light) .ses-d,
    :host-context(.light-theme) .ses-d,
    :host-context(.theme-light) .ses-d{color:#64748B}
    :host-context(body.light-theme) .ses-row,
    :host-context(body.theme-light) .ses-row,
    :host-context(.light-theme) .ses-row,
    :host-context(.theme-light) .ses-row{background:rgba(15,23,42,.02);border-color:rgba(15,23,42,.06)}
    :host-context(body.light-theme) .btn-sec,
    :host-context(body.theme-light) .btn-sec,
    :host-context(.light-theme) .btn-sec,
    :host-context(.theme-light) .btn-sec{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.10);color:#0F172A}
    :host-context(body.light-theme) .inner-foot,
    :host-context(body.theme-light) .inner-foot,
    :host-context(.light-theme) .inner-foot,
    :host-context(.theme-light) .inner-foot{border-color:rgba(15,23,42,.06);color:#64748B}
    :host-context(body.light-theme) .inner-foot-links a,
    :host-context(body.theme-light) .inner-foot-links a,
    :host-context(.light-theme) .inner-foot-links a,
    :host-context(.theme-light) .inner-foot-links a{color:#64748B}

    @media(max-width:767px){
      .grid2{grid-template-columns:1fr}
      .f2{grid-template-columns:1fr}
      .save-bar{flex-direction:column;align-items:stretch}
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Account implements OnInit {
  private authStore = inject(AuthStore);
  private providerProfileService = inject(ProviderProfileService);

  ngOnInit() {
    // Company mode shows the sessions list unconditionally (no expand
    // button in that layout), so it needs real data up front. Individual
    // mode loads lazily, on demand, when "إدارة" is clicked (see
    // manageDevices()).
    if (this.isCompanyMode()) this.loadSessions();
  }

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // Company settings state
  coDarkMode = signal<boolean>(true);
  coCollapseSidebar = signal<boolean>(false);
  coDenseTables = signal<boolean>(false);
  coReduceMotion = signal<boolean>(false);
  coLanguage = signal<string>('العربية');
  coTimezone = signal<string>('(GMT+3) الرياض');
  coCalendar = signal<string>('ميلادي');
  coCurrency = signal<string>('الدولار السعودي (USD)');
  coNumberFormat = signal<string>('1234 — عربية غربية');
  coLandingPage = signal<string>('لوحة التحكم');
  coIdleTimeout = signal<string>('30 دقيقة');

  toggleCoDarkMode() { this.coDarkMode.update(v => !v); }
  toggleCoCollapseSidebar() { this.coCollapseSidebar.update(v => !v); }
  toggleCoDenseTables() { this.coDenseTables.update(v => !v); }
  toggleCoReduceMotion() { this.coReduceMotion.update(v => !v); }

  coSaveSettings() {
    this.showToast('تم حفظ إعدادات الشركة');
  }

  coResetDefaults() {
    this.coDarkMode.set(true);
    this.coCollapseSidebar.set(false);
    this.coDenseTables.set(false);
    this.coReduceMotion.set(false);
    this.coLanguage.set('العربية');
    this.coTimezone.set('(GMT+3) الرياض');
    this.coCalendar.set('ميلادي');
    this.coCurrency.set('الدولار السعودي (USD)');
    this.coNumberFormat.set('1234 — عربية غربية');
    this.coLandingPage.set('لوحة التحكم');
    this.coIdleTimeout.set('30 دقيقة');
    this.showToast('تمت استعادة الإعدادات الافتراضية');
  }

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  // 2FA and "new login alert" were previously interactive toggles backed by
  // nothing at all (no MFA/2FA capability and no acted-upon login-alert
  // preference exist anywhere in the backend — confirmed by a full-text
  // search of the backend source). Flipping them changed only a local
  // signal and always rendered as "enabled"/"protected" regardless. Kept as
  // plain, honest, non-interactive state rather than removed outright, so
  // the security section can still explain what these would do once real
  // backend support exists.
  readonly securityFeatureUnavailableLabel = 'غير متاح حاليًا';

  language = signal<string>('العربية');
  timezone = signal<string>('توقيت الرياض (GMT+3)');
  currency = signal<string>('دولار أمريكي (USD)');
  dateFormat = signal<string>('هجري وميلادي');

  showProfile = signal<boolean>(true);

  // --- Real authenticated password change (PUT .../password) ---
  passwordFormVisible = signal(false);
  isChangingPassword = signal(false);
  currentPasswordValue = signal('');
  newPasswordValue = signal('');
  confirmPasswordValue = signal('');
  passwordError = signal<string | null>(null);

  togglePasswordForm() {
    this.passwordFormVisible.update(v => !v);
    if (!this.passwordFormVisible()) this.resetPasswordForm();
  }

  private resetPasswordForm() {
    this.currentPasswordValue.set('');
    this.newPasswordValue.set('');
    this.confirmPasswordValue.set('');
    this.passwordError.set(null);
  }

  changePassword() {
    if (this.isChangingPassword()) return; // prevent double submit

    const current = this.currentPasswordValue();
    const next = this.newPasswordValue();
    const confirm = this.confirmPasswordValue();

    // Validated client-side first, mirroring the backend's own rules
    // exactly (provider-profile.service.ts changePassword()) — an invalid
    // attempt never reaches the network at all.
    if (!current || !next || !confirm) {
      this.passwordError.set('يرجى تعبئة جميع الحقول');
      return;
    }
    if (next.length < 8 || next.length > 72) {
      this.passwordError.set('كلمة المرور الجديدة يجب أن تتكون من 8 إلى 72 حرفًا');
      return;
    }
    const characterGroups = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(re => re.test(next)).length;
    if (characterGroups < 3) {
      this.passwordError.set('استخدم ثلاثة أنواع على الأقل: أحرف صغيرة وكبيرة وأرقام ورموز');
      return;
    }
    if (next !== confirm) {
      this.passwordError.set('تأكيد كلمة المرور غير مطابق');
      return;
    }

    this.passwordError.set(null);
    this.isChangingPassword.set(true);
    this.providerProfileService.changePassword(current, next).subscribe({
      next: () => {
        this.isChangingPassword.set(false);
        this.resetPasswordForm();
        this.passwordFormVisible.set(false);
        this.showToast('تم تغيير كلمة المرور بنجاح');
      },
      error: (err: any) => {
        this.isChangingPassword.set(false);
        const reason = err?.error?.message;
        this.passwordError.set(
          reason === 'CURRENT_PASSWORD_INCORRECT' ? 'كلمة المرور الحالية غير صحيحة'
          : reason === 'PASSWORD_UNCHANGED' ? 'كلمة المرور الجديدة مطابقة للحالية'
          : reason === 'WEAK_PASSWORD' ? 'كلمة المرور الجديدة لا تحقق متطلبات الأمان'
          : reason === 'PASSWORD_FIELDS_REQUIRED' ? 'يرجى تعبئة جميع الحقول'
          : 'تعذر تغيير كلمة المرور، حاول مجددًا'
        );
        // Deliberately NOT clearing fields on error — the user shouldn't
        // have to retype everything to fix one mistake. Never logged: only
        // the server error *code* is read here, never the password values.
      },
    });
  }

  // --- Real device/session management (GET/DELETE .../sessions) ---
  sessions = signal<ProviderSession[]>([]);
  sessionsLoading = signal(false);
  sessionsError = signal<string | null>(null);
  devicesExpanded = signal(false);
  revokingSessionId = signal<string | null>(null);

  private loadSessions() {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    this.providerProfileService.getActiveSessions().subscribe({
      next: (res: any) => {
        this.sessions.set(Array.isArray(res?.data) ? res.data : []);
        this.sessionsLoading.set(false);
      },
      error: () => {
        this.sessionsError.set('تعذر تحميل الأجهزة النشطة');
        this.sessionsLoading.set(false);
      },
    });
  }

  manageDevices() {
    this.devicesExpanded.update(v => !v);
    if (this.devicesExpanded() && this.sessions().length === 0 && !this.sessionsLoading()) {
      this.loadSessions();
    }
  }

  endSession(sessionId: string) {
    if (this.revokingSessionId()) return; // prevent double submit per row
    this.revokingSessionId.set(sessionId);
    this.providerProfileService.revokeSession(sessionId).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(s => s.id !== sessionId));
        this.revokingSessionId.set(null);
        this.showToast('تم إنهاء الجلسة بنجاح');
      },
      error: (err: any) => {
        this.revokingSessionId.set(null);
        const reason = err?.error?.message;
        this.showToast(reason === 'CANNOT_REVOKE_CURRENT_SESSION' ? 'لا يمكن إنهاء الجلسة الحالية' : 'تعذر إنهاء الجلسة');
      },
    });
  }

  sessionLabel(s: ProviderSession): string {
    const parts = [s.browser, s.os].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'جهاز غير معروف';
  }

  sessionActivityLabel(s: ProviderSession): string {
    if (s.isCurrent) return 'الجلسة الحالية · نشطة الآن';
    const date = new Date(s.lastActiveAt);
    return 'آخر نشاط: ' + date.toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // --- Data export: no backend endpoint exists anywhere (confirmed by a
  // full-text search of the backend source) — truthfully unavailable rather
  // than a fake "your download link is on its way" toast. ---
  dataExportAvailable = false;

  // --- Account deletion: only an ADMIN-ONLY hard-delete endpoint exists
  // backend-side; there is no self-service deletion-*request* endpoint at
  // all, so there is nothing safe to wire here. Per instructions this stays
  // truthfully unavailable rather than showing a fake "submitted for
  // review" success — see the Batch 2 report for the recommended follow-up
  // (routing this through the existing, real provider support-ticket
  // system instead, pending explicit approval). ---
  accountDeletionAvailable = false;

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
