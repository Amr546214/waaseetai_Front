import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
  selector: 'app-provider-settings-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
    :host-context([data-theme='light']) .skeleton-box,
    :host-context([data-theme='light']) .skeleton-row {
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
    :host-context([data-theme='light']) .sw-track {
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
    :host-context([data-theme='light']) .set-sel {
      background: #F6F8FC;
      border-color: #C9D0E3;
      color: #0F172A;
    }
    :host-context([data-theme='light']) .set-sel-lbl {
      color: #0F172A;
    }
    :host-context([data-theme='light']) .set-edit {
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
    :host-context([data-theme='light']) .danger-card {
      background: rgba(255,140,105,.06);
      border-color: rgba(255,140,105,.3);
    }
    :host-context([data-theme='light']) .danger-card p {
      color: #5B6472;
    }

    /* Delete Modal */
    .del-box {
      background: rgba(11,20,55,.97);
      border: 1px solid rgba(255,255,255,.12);
    }
    .del-fld input {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.10);
      color: #fff;
    }
    .del-cancel {
      background: rgba(255,255,255,.05);
      border: 1px solid rgba(255,255,255,.12);
      color: #fff;
    }
    :host-context([data-theme='light']) .del-box {
      background: #fff;
      border-color: #E7EAF1;
    }
    :host-context([data-theme='light']) .del-box h3 {
      color: #0F172A;
    }
    :host-context([data-theme='light']) .del-box > p,
    :host-context([data-theme='light']) .del-fld label {
      color: #475569;
    }
    :host-context([data-theme='light']) .del-fld input {
      background: #f5f7fc;
      border-color: #C9D0E3;
      color: #0F172A;
    }
    :host-context([data-theme='light']) .del-cancel {
      background: #EEF2FA;
      border-color: #D8DFEC;
      color: #0F172A;
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
    :host-context([data-theme='light']) .co-card,
    :host-context(body.light) .co-card,
    :host-context(body.light-theme) .co-card{background:#fff;border-color:#E7EAF1}
    :host-context([data-theme='light']) .co-settings-page .pg-title,
    :host-context(body.light) .co-settings-page .pg-title,
    :host-context(body.light-theme) .co-settings-page .pg-title{color:#0F172A}
    :host-context([data-theme='light']) .co-settings-page .pg-sub,
    :host-context(body.light) .co-settings-page .pg-sub,
    :host-context(body.light-theme) .co-settings-page .pg-sub{color:#64748B}
    :host-context([data-theme='light']) .sec-ttl,
    :host-context(body.light) .sec-ttl,
    :host-context(body.light-theme) .sec-ttl{color:#0F172A}
    :host-context([data-theme='light']) .fld label,
    :host-context(body.light) .fld label,
    :host-context(body.light-theme) .fld label{color:#0F172A}
    :host-context([data-theme='light']) .fld input,:host-context([data-theme='light']) .fld select,
    :host-context(body.light) .fld input,:host-context(body.light) .fld select,
    :host-context(body.light-theme) .fld input,:host-context(body.light-theme) .fld select{background:rgba(15,23,42,.03);border-color:rgba(15,23,42,.10);color:#0F172A}
    :host-context([data-theme='light']) .st-t,
    :host-context(body.light) .st-t,
    :host-context(body.light-theme) .st-t{color:#0F172A}
    :host-context([data-theme='light']) .st-d,
    :host-context(body.light) .st-d,
    :host-context(body.light-theme) .st-d{color:#64748B}
    :host-context([data-theme='light']) .ses-t,
    :host-context(body.light) .ses-t,
    :host-context(body.light-theme) .ses-t{color:#0F172A}
    :host-context([data-theme='light']) .ses-d,
    :host-context(body.light) .ses-d,
    :host-context(body.light-theme) .ses-d{color:#64748B}
    :host-context([data-theme='light']) .ses-row,
    :host-context(body.light) .ses-row,
    :host-context(body.light-theme) .ses-row{background:rgba(15,23,42,.02);border-color:rgba(15,23,42,.06)}
    :host-context([data-theme='light']) .btn-sec,
    :host-context(body.light) .btn-sec,
    :host-context(body.light-theme) .btn-sec{background:rgba(15,23,42,.04);border-color:rgba(15,23,42,.10);color:#0F172A}
    :host-context([data-theme='light']) .inner-foot,
    :host-context(body.light) .inner-foot,
    :host-context(body.light-theme) .inner-foot{border-color:rgba(15,23,42,.06);color:#64748B}
    :host-context([data-theme='light']) .inner-foot-links a,
    :host-context(body.light) .inner-foot-links a,
    :host-context(body.light-theme) .inner-foot-links a{color:#64748B}

    @media(max-width:767px){
      .grid2{grid-template-columns:1fr}
      .f2{grid-template-columns:1fr}
      .save-bar{flex-direction:column;align-items:stretch}
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Account {
  private authStore = inject(AuthStore);

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
  coCurrency = signal<string>('الريال السعودي (SAR)');
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
    this.coCurrency.set('الريال السعودي (SAR)');
    this.coNumberFormat.set('1234 — عربية غربية');
    this.coLandingPage.set('لوحة التحكم');
    this.coIdleTimeout.set('30 دقيقة');
    this.showToast('تمت استعادة الإعدادات الافتراضية');
  }

  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  twoFactorAuth = signal<boolean>(true);
  newLoginAlert = signal<boolean>(true);

  language = signal<string>('العربية');
  timezone = signal<string>('توقيت الرياض (GMT+3)');
  currency = signal<string>('ريال سعودي (SAR)');
  dateFormat = signal<string>('هجري وميلادي');

  showProfile = signal<boolean>(true);
  shareData = signal<boolean>(true);

  showDeleteModal = signal<boolean>(false);
  deleteConfirmText = signal<string>('');

  get isDeleteEnabled(): boolean {
    return this.deleteConfirmText().trim() === 'حذف';
  }

  requestDataDownload() {
    this.showToast('سيصلك رابط تنزيل بياناتك خلال 24 ساعة');
  }

  manageDevices() {
    this.showToast('عرض الأجهزة النشطة وإنهاء الجلسات');
  }

  openDeleteModal() {
    this.deleteConfirmText.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
  }

  confirmDelete() {
    this.showDeleteModal.set(false);
    this.showToast('أُرسل طلب حذف الحساب، يراجعه فريق الدعم');
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
