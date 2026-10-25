import { Component, ChangeDetectionStrategy, OnInit, inject, signal, computed, ElementRef } from '@angular/core';
import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { handleClientError } from '../../client-form-report';

/** The values PUT /profiles/update accepts for a client (same lists as the profile edit page). */
export const CLIENT_LANGUAGES = ['العربية', 'English'] as const;
export const CLIENT_TIMEZONES = ['(GMT+3) توقيت الرياض', '(GMT+4) توقيت دبي', '(GMT+2) توقيت القاهرة', '(GMT+0) UTC'] as const;

export interface AccountSession {
  id: string;
  browser?: string;
  os?: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

@Component({
  selector: 'app-client-settings-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, WsSelectComponent],
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
export class Account implements OnInit {
  private router = inject(Router);
  private profileApi = inject(ProfileApiService);
  private sessionsApi = inject(ProviderProfileService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  isLoading = signal<boolean>(true);
  hasError = signal<boolean>(false);

  // No 2FA / login-alert capability exists in the backend: both stay visibly unavailable (disabled, with the reason in the template).
  twoFactorAuth = signal<boolean>(false);
  newLoginAlert = signal<boolean>(false);

  // Display preferences: loaded from and saved to the client profile (GET /profiles/me, PUT /profiles/update).
  readonly languageOptions = CLIENT_LANGUAGES.map(v => ({ value: v, label: v }));
  readonly timezoneOptions = CLIENT_TIMEZONES.map(v => ({ value: v, label: v }));
  language = signal<string>(CLIENT_LANGUAGES[0]);
  timezone = signal<string>(CLIENT_TIMEZONES[0]);
  private saved = signal<{ language: string; timezone: string }>({ language: CLIENT_LANGUAGES[0], timezone: CLIENT_TIMEZONES[0] });
  isSaving = signal<boolean>(false);
  saveError = signal<string | null>(null);
  isDirty = computed(() => this.language() !== this.saved().language || this.timezone() !== this.saved().timezone);

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.profileApi.getMyProfile().subscribe({
      next: (res: any) => {
        const data = res?.data?.currentProfileData || res?.data;
        if (!res?.success || !data) { this.isLoading.set(false); this.hasError.set(true); return; }
        // never saved = the defaults the profile page shows; a stored value outside the supported lists is kept visible rather than silently replaced
        const language = (data.interfaceLanguage as string) || CLIENT_LANGUAGES[0];
        const timezone = (data.timezone as string) || CLIENT_TIMEZONES[0];
        this.language.set(language);
        this.timezone.set(timezone);
        this.saved.set({ language, timezone });
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.hasError.set(true); }
    });
  }

  savePreferences() {
    if (this.isSaving() || !this.isDirty()) return;
    this.isSaving.set(true);
    this.saveError.set(null);
    const payload = { interfaceLanguage: this.language(), timezone: this.timezone() };
    this.profileApi.updateProfile(payload).subscribe({
      next: (res: any) => {
        this.isSaving.set(false);
        if (!res?.success) { this.saveError.set(res?.message || 'تعذر حفظ التفضيلات'); return; }
        this.saved.set({ language: payload.interfaceLanguage, timezone: payload.timezone });
        this.notify.success('تم حفظ تفضيلات اللغة والمنطقة الزمنية');
      },
      error: (err: unknown) => {
        this.isSaving.set(false);
        // A 400/422 naming language / timezone lands under that select; every other failure stays one honest message.
        this.saveError.set(null);
        handleClientError(this.host.nativeElement, err, {
          resolve: { interfaceLanguage: 'set-lang', timezone: 'set-tz' }, fallback: 'تعذر حفظ التفضيلات، حاول مرة أخرى',
        }, (m) => this.saveError.set(m));
      }
    });
  }

  // --- Real device/session management (GET/DELETE /provider/profile/sessions is identity-level: it serves every role) ---
  sessions = signal<AccountSession[]>([]);
  sessionsLoading = signal(false);
  sessionsError = signal<string | null>(null);
  devicesExpanded = signal(false);
  revokingSessionId = signal<string | null>(null);

  manageDevices() {
    this.devicesExpanded.update(v => !v);
    if (this.devicesExpanded() && !this.sessionsLoading()) this.loadSessions();
  }

  private loadSessions() {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    this.sessionsApi.getActiveSessions().subscribe({
      next: (res: any) => { this.sessions.set(Array.isArray(res?.data) ? res.data : []); this.sessionsLoading.set(false); },
      error: () => { this.sessionsError.set('تعذر تحميل الأجهزة النشطة'); this.sessionsLoading.set(false); }
    });
  }

  endSession(sessionId: string) {
    if (this.revokingSessionId()) return;
    this.revokingSessionId.set(sessionId);
    this.sessionsApi.revokeSession(sessionId).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(s => s.id !== sessionId));
        this.revokingSessionId.set(null);
        this.notify.success('تم إنهاء الجلسة بنجاح');
      },
      error: (err: any) => {
        this.revokingSessionId.set(null);
        if (err?.error?.message === 'CANNOT_REVOKE_CURRENT_SESSION') this.notify.warning('لا يمكن إنهاء الجلسة الحالية');
        else this.notify.error('تعذر إنهاء الجلسة');
      }
    });
  }

  sessionLabel(s: AccountSession): string {
    const parts = [s.browser, s.os].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'جهاز غير معروف';
  }

  sessionActivityLabel(s: AccountSession): string {
    if (s.isCurrent) return 'الجلسة الحالية · نشطة الآن';
    const d = new Date(s.lastActiveAt);
    return Number.isNaN(d.getTime()) ? '' : 'آخر نشاط: ' + d.toLocaleString('ar-SA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });
  }

  // Data copy and account deletion have no self-service endpoint: both open the real support-ticket flow (a human channel), and nothing here claims the request was made.
  openSupportTicket() {
    this.router.navigate(['/client-overview/help/tickets/new']);
  }

  contactSupportForDeletion() {
    this.openSupportTicket();
  }
}
