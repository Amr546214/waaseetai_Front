import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminConsoleApiService, AdminSelfProfile, AdminSession } from '../../../../core/services/admin-console-api.service';

/** The admin's own account: profile (name / phone), password change, active sessions. Every action hits a real endpoint and is audited server-side. */
@Component({
  selector: 'app-sa-my-account',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-my-account.html',
  styles: [`
    .ma{padding:22px 24px;direction:rtl;max-width:880px}
    .ma h1{font-size:22px;font-weight:900;margin:0 0 4px}
    .ma-sub{font-size:12px;opacity:.7;margin:0 0 18px}
    .ma-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px 18px;margin-bottom:16px}
    .ma-ttl{font-size:14px;font-weight:800;margin-bottom:12px}
    .ma-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px}
    .ma-f{display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;font-size:11px;font-weight:700}
    .ma-f input{padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:inherit;font-family:inherit;font-size:13px}
    .ma-btn{padding:8px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(43,212,199,.15);color:inherit;font-weight:700;font-family:inherit;cursor:pointer;font-size:12px}
    .ma-btn:disabled{opacity:.5;cursor:not-allowed}
    .ma-btn-danger{background:rgba(255,107,107,.15)}
    .ma-msg{font-size:12px;margin-top:8px;font-weight:700}
    .ma-err{color:#FF8C69}.ma-ok{color:#2BD4C7}
    .ma-sess{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:12.5px}
    .ma-note{font-size:11.5px;opacity:.7}
    .ma-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:50}
    .ma-modal{background:#0B1437;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px;max-width:380px;width:90%}
    :host-context(.light-theme) .ma-modal,:host-context(body.theme-light) .ma-modal{background:#fff}
  `],
})
export class SaMyAccount implements OnInit {
  private readonly api = inject(AdminConsoleApiService);

  readonly profile = signal<AdminSelfProfile | null>(null);
  readonly firstName = signal('');
  readonly lastName = signal('');
  readonly phoneNumber = signal('');
  readonly profileMsg = signal<{ ok: boolean; text: string } | null>(null);
  readonly savingProfile = signal(false);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');
  readonly pwMsg = signal<{ ok: boolean; text: string } | null>(null);
  readonly savingPw = signal(false);

  readonly sessions = signal<AdminSession[]>([]);
  readonly sessionsMsg = signal<{ ok: boolean; text: string } | null>(null);
  /** Pending destructive confirmation: a session id, 'others', or null. */
  readonly confirming = signal<string | null>(null);
  readonly busy = signal(false);

  readonly twoFaReason = 'غير متاح: لا يوجد دعم للمصادقة الثنائية (2FA) في الخادم حاليًا';
  readonly avatarReason = 'غير متاح حاليًا: رفع الصورة الشخصية للحسابات الإدارية غير مدعوم';

  ngOnInit(): void {
    this.api.getMe().subscribe({ next: (r) => this.applyProfile(r.data), error: () => this.profileMsg.set({ ok: false, text: 'تعذّر تحميل بيانات الحساب' }) });
    this.loadSessions();
  }

  private applyProfile(p: AdminSelfProfile): void {
    this.profile.set(p);
    this.firstName.set(p.firstName);
    this.lastName.set(p.lastName);
    this.phoneNumber.set(p.phoneNumber ?? '');
  }

  private errText(e: unknown, fallback: string): string {
    return (e instanceof HttpErrorResponse && (e.error?.message as string)) || fallback;
  }

  saveProfile(): void {
    const first = this.firstName().trim(), last = this.lastName().trim(), phone = this.phoneNumber().trim();
    if (!first || !last) { this.profileMsg.set({ ok: false, text: 'الاسم الأول واسم العائلة مطلوبان' }); return; }
    if (phone && !/^\d{6,15}$/.test(phone)) { this.profileMsg.set({ ok: false, text: 'رقم الجوال يجب أن يكون أرقامًا فقط (6 إلى 15 رقمًا)' }); return; }
    this.savingProfile.set(true);
    this.api.updateMe({ firstName: first, lastName: last, phoneNumber: phone || null }).subscribe({
      next: (r) => { this.applyProfile(r.data); this.savingProfile.set(false); this.profileMsg.set({ ok: true, text: 'تم حفظ بيانات الحساب' }); },
      error: (e) => { this.savingProfile.set(false); this.profileMsg.set({ ok: false, text: this.errText(e, 'تعذّر حفظ البيانات') }); },
    });
  }

  changePassword(): void {
    if (!this.currentPassword() || !this.newPassword()) { this.pwMsg.set({ ok: false, text: 'أدخل كلمة المرور الحالية والجديدة' }); return; }
    if (this.newPassword() !== this.confirmPassword()) { this.pwMsg.set({ ok: false, text: 'تأكيد كلمة المرور غير مطابق' }); return; }
    this.savingPw.set(true);
    this.api.changePassword({ currentPassword: this.currentPassword(), newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.savingPw.set(false);
        this.currentPassword.set(''); this.newPassword.set(''); this.confirmPassword.set('');
        this.pwMsg.set({ ok: true, text: 'تم تغيير كلمة المرور، وأُنهيت جلسات الأجهزة الأخرى' });
        this.loadSessions();
      },
      error: (e) => {
        this.savingPw.set(false);
        const code = e instanceof HttpErrorResponse ? e.error?.message : '';
        const map: Record<string, string> = {
          CURRENT_PASSWORD_INCORRECT: 'كلمة المرور الحالية غير صحيحة',
          WEAK_PASSWORD: 'كلمة المرور الجديدة ضعيفة: 8 أحرف على الأقل وتجمع ثلاثة أنواع (كبيرة، صغيرة، أرقام، رموز)',
          PASSWORD_UNCHANGED: 'كلمة المرور الجديدة مطابقة للحالية',
        };
        this.pwMsg.set({ ok: false, text: map[code] ?? 'تعذّر تغيير كلمة المرور' });
      },
    });
  }

  loadSessions(): void {
    this.api.getSessions().subscribe({ next: (r) => this.sessions.set(r.data ?? []), error: () => this.sessionsMsg.set({ ok: false, text: 'تعذّر تحميل الجلسات' }) });
  }

  askTerminate(target: string): void { this.confirming.set(target); }
  cancelConfirm(): void { this.confirming.set(null); }

  confirmTerminate(): void {
    const target = this.confirming();
    if (!target) return;
    this.busy.set(true);
    const req = target === 'others' ? this.api.terminateOtherSessions() : this.api.terminateSession(target);
    req.subscribe({
      next: () => { this.busy.set(false); this.confirming.set(null); this.sessionsMsg.set({ ok: true, text: target === 'others' ? 'تم إنهاء الجلسات الأخرى' : 'تم إنهاء الجلسة' }); this.loadSessions(); },
      error: (e) => { this.busy.set(false); this.confirming.set(null); this.sessionsMsg.set({ ok: false, text: this.errText(e, 'تعذّر إنهاء الجلسة') }); this.loadSessions(); },
    });
  }

  sessionLabel(s: AdminSession): string { return [s.device, s.browser, s.os].filter(Boolean).join(' · ') || 'جهاز غير معروف'; }
  hasOthers(): boolean { return this.sessions().some((s) => !s.isCurrent); }
}
