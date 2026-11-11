import { Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WsDatePipe } from '../../../../shared/ws-date/ws-date.pipe';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { BACKEND_CODE_MESSAGES } from '../../../../core/forms/http-error';
import { FieldProblem } from '../../../../shared/forms/form-error-focus';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../shared/admin-form-report';
import { AdminConsoleApiService, AdminSelfProfile, AdminSession } from '../../../../core/services/admin-console-api.service';

/** The admin's own account: profile (name / phone), password change, active sessions. Every action hits a real endpoint and is audited server-side. */
@Component({
  selector: 'app-sa-my-account',
  standalone: true,
  imports: [WsDatePipe, CommonModule, FormsModule],
  templateUrl: './sa-my-account.html',
  styles: [`
    .ma{padding:22px 24px;direction:rtl;max-width:880px}
    .ma h1{font-size:22px;font-weight:900;margin:0 0 4px}
    .ma-sub{font-size:var(--font-size-small);opacity:.7;margin:0 0 18px}
    .ma-card{border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:16px 18px;margin-bottom:16px}
    .ma-ttl{font-size:var(--font-size-label);font-weight:800;margin-bottom:12px}
    .ma-row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:10px}
    .ma-f{display:flex;flex-direction:column;gap:4px;flex:1;min-width:180px;font-size:var(--font-size-small);font-weight:700}
    .ma-f input{padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:inherit;font-family:inherit;font-size:var(--font-size-label)}
    .ma-btn{padding:8px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:rgba(43,212,199,.15);color:inherit;font-weight:700;font-family:inherit;cursor:pointer;font-size:var(--font-size-small)}
    .ma-btn:disabled{opacity:.5;cursor:not-allowed}
    .ma-btn-danger{background:rgba(255,107,107,.15)}
    .ma-msg{font-size:var(--font-size-small);margin-top:8px;font-weight:700}
    .ma-err{color:#FF8C69}.ma-ok{color:#2BD4C7}
    .ma-sess{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:var(--font-size-label)}
    .ma-note{font-size:var(--font-size-small);opacity:.7}
    .ma-ov{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:50}
    .ma-modal{background:#0B1437;border:1px solid rgba(255,255,255,.15);border-radius:14px;padding:20px;max-width:380px;width:90%}
    :host-context(.light-theme) .ma-modal,:host-context(body.theme-light) .ma-modal{background:#fff}
  `],
})
export class SaMyAccount implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(AdminConsoleApiService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly profileGuard = new SubmitGuard();
  private readonly pwGuard = new SubmitGuard();

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

  readonly avatarBusy = signal(false);
  readonly avatarMessage = signal<{ ok: boolean; text: string } | null>(null);
  readonly securityLoading = signal(false);
  readonly securityMessage = signal('');
  readonly securityChecked = signal(false);
  private avatarSequence = 0;

  checkSecurityPolicy() {
    if (this.securityLoading()) return;
    this.securityLoading.set(true); this.securityMessage.set(''); this.securityChecked.set(false);
    this.api.securityPolicy().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        this.securityLoading.set(false); this.securityChecked.set(true);
        this.securityMessage.set(r.data.emailCodeRequired
          ? 'رمز البريد مطلوب عند تسجيل الدخول بكلمة المرور أو Google، ولا يمكن إلغاؤه من هنا. تطبيق المصادقة TOTP غير مدعوم حاليًا.'
          : 'تعذّر تحديد سياسة تأكيد الدخول.');
      },
      error: () => { this.securityLoading.set(false); this.securityMessage.set('تعذّر قراءة إعدادات الدخول. حاول مرة أخرى.'); },
    });
  }

  chooseAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.avatarBusy()) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.avatarMessage.set({ ok: false, text: 'ارفع صورة PNG أو JPEG أو WebP لا تتجاوز 2 ميجا.' }); return;
    }
    this.avatarBusy.set(true); this.avatarMessage.set(null);
    const request = ++this.avatarSequence;
    const reader = new FileReader();
    reader.onload = () => { if (request === this.avatarSequence) this.saveAvatar(String(reader.result)); };
    reader.onerror = () => { if (request === this.avatarSequence) {
      this.avatarBusy.set(false); this.avatarMessage.set({ ok: false, text: 'تعذّر قراءة الصورة.' });
    } };
    reader.readAsDataURL(file);
  }

  removeAvatar() {
    if (this.avatarBusy()) return;
    this.avatarBusy.set(true); this.avatarMessage.set(null); this.saveAvatar(null);
  }

  private saveAvatar(image: string | null) {
    this.api.updateAvatar(image).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => {
        // Updating a photo never overwrites unsaved name or phone edits.
        this.profile.set(r.data); this.avatarBusy.set(false);
        this.avatarMessage.set({ ok: true, text: image === null ? 'تم حذف الصورة الشخصية.' : 'تم حفظ الصورة الشخصية.' });
      },
      error: () => {
        this.avatarBusy.set(false);
        this.avatarMessage.set({ ok: false, text: 'تعذّر حفظ الصورة. تأكد من نوعها وحجمها وحاول مرة أخرى.' });
      },
    });
  }

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
    if (this.savingProfile()) return;
    const first = this.firstName().trim(), last = this.lastName().trim(), phone = this.phoneNumber().trim();
    const problems: FieldProblem[] = [];
    if (!first) problems.push({ field: 'ma-first-name', message: 'الاسم الأول مطلوب' });
    if (!last) problems.push({ field: 'ma-last-name', message: 'اسم العائلة مطلوب' });
    if (phone && !/^\d{6,15}$/.test(phone)) problems.push({ field: 'ma-phone', message: 'رقم الجوال يجب أن يكون أرقامًا فقط (6 إلى 15 رقمًا)' });
    this.profileMsg.set(null);
    if (problems.length) { void reportAdminProblems(this.host.nativeElement, problems); return; }
    if (!this.profileGuard.enter()) return;
    this.savingProfile.set(true);
    this.api.updateMe({ firstName: first, lastName: last, phoneNumber: phone || null }).subscribe({
      next: (r) => { this.profileGuard.release(); this.applyProfile(r.data); this.savingProfile.set(false); this.profileMsg.set({ ok: true, text: 'تم حفظ بيانات الحساب' }); },
      error: (e) => {
        this.profileGuard.release();
        this.savingProfile.set(false);
        handleAdminError(this.host.nativeElement, e, { fallback: 'تعذّر حفظ البيانات', resolve: { firstName: 'ma-first-name', lastName: 'ma-last-name', phoneNumber: 'ma-phone' } }, (m) => this.profileMsg.set({ ok: false, text: m }));
      },
    });
  }

  changePassword(): void {
    if (this.savingPw()) return;
    const problems: FieldProblem[] = [];
    if (!this.currentPassword()) problems.push({ field: 'ma-pw-current', message: 'أدخل كلمة المرور الحالية' });
    if (!this.newPassword()) problems.push({ field: 'ma-pw-new', message: 'أدخل كلمة المرور الجديدة' });
    else if (this.currentPassword() && this.newPassword() === this.currentPassword()) problems.push({ field: 'ma-pw-new', message: BACKEND_CODE_MESSAGES['PASSWORD_UNCHANGED'] });
    if (this.newPassword() && this.newPassword() !== this.confirmPassword()) problems.push({ field: 'ma-pw-confirm', message: 'تأكيد كلمة المرور غير مطابق' });
    this.pwMsg.set(null);
    if (problems.length) { void reportAdminProblems(this.host.nativeElement, problems); return; }
    if (!this.pwGuard.enter()) return;
    this.savingPw.set(true);
    this.api.changePassword({ currentPassword: this.currentPassword(), newPassword: this.newPassword() }).subscribe({
      next: () => {
        this.pwGuard.release();
        this.savingPw.set(false);
        this.currentPassword.set(''); this.newPassword.set(''); this.confirmPassword.set('');
        this.pwMsg.set({ ok: true, text: 'تم تغيير كلمة المرور، وأُنهيت جلسات الأجهزة الأخرى' });
        this.loadSessions();
      },
      error: (e) => {
        this.pwGuard.release();
        this.savingPw.set(false);
        // The server answers these three cases with a fixed code (wrong current password is a 401 that must NOT read as "session expired").
        const code = String((e as HttpErrorResponse)?.error?.message ?? '').split(':')[0].trim();
        const byCode: Record<string, string> = {
          CURRENT_PASSWORD_INCORRECT: 'ma-pw-current',
          WEAK_PASSWORD: 'ma-pw-new',
          PASSWORD_UNCHANGED: 'ma-pw-new',
        };
        const status = (e as HttpErrorResponse)?.status;
        if (byCode[code] && (status === 400 || status === 401 || status === 422)) {
          const text = code === 'WEAK_PASSWORD' ? 'كلمة المرور الجديدة ضعيفة: 8 أحرف على الأقل وتجمع ثلاثة أنواع (كبيرة، صغيرة، أرقام، رموز)' : BACKEND_CODE_MESSAGES[code];
          void reportAdminProblems(this.host.nativeElement, [{ field: byCode[code], message: text }]);
          return;
        }
        handleAdminError(this.host.nativeElement, e, { fallback: 'تعذّر تغيير كلمة المرور', resolve: { currentPassword: 'ma-pw-current', newPassword: 'ma-pw-new' } }, (m) => this.pwMsg.set({ ok: false, text: m }));
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
