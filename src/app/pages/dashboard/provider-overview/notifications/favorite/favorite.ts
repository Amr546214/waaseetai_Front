import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PreferenceItem {
  id: string;
  title: string;
  subtitle: string;
  enabled: boolean;
}

export interface PreferenceSection {
  title: string;
  iconSvg: string;
  items: PreferenceItem[];
}

@Component({
  selector: 'app-provider-notifications-favorite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './favorite.html',
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Favorite {
  isLoading = signal<boolean>(false);
  hasError = signal<boolean>(false);
  toastMessage = signal<string | null>(null);

  sections = signal<PreferenceSection[]>([
    {
      title: 'إشعارات الطلبات والعروض',
      iconSvg: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
      items: [
        { id: 'orders_offers_new', title: 'عرض جديد على طلبي', subtitle: 'عند تقديم مقدّم خدمة عرضًا', enabled: true },
        { id: 'orders_offers_update', title: 'تحديث حالة الطلب', subtitle: 'تغيّر حالة أي من طلباتك', enabled: true },
        { id: 'orders_offers_msg', title: 'رسالة جديدة', subtitle: 'عند وصول رسالة من مقدّم خدمة', enabled: true },
        { id: 'orders_offers_remind', title: 'تذكير بمهلة المراجعة', subtitle: 'قبل انتهاء مهلة اعتماد التسليم', enabled: true },
      ]
    },
    {
      title: 'الإشعارات المالية',
      iconSvg: '<path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/>',
      items: [
        { id: 'finance_wallet', title: 'حركات المحفظة', subtitle: 'إيداع أو سحب أو إفراج ضمان', enabled: true },
        { id: 'finance_cashback', title: 'كاش باك الولاء', subtitle: 'عند إضافة كاش باك جديد', enabled: true },
        { id: 'finance_security', title: 'تنبيهات الأمان المالي', subtitle: 'نشاط غير معتاد على المحفظة', enabled: true },
      ]
    },
    {
      title: 'توصيات الذكاء والتسويق',
      iconSvg: '<circle cx="12" cy="12" r="2"/><circle cx="4" cy="6" r="1.5"/><circle cx="20" cy="6" r="1.5"/><circle cx="4" cy="18" r="1.5"/><circle cx="20" cy="18" r="1.5"/><circle cx="12" cy="3" r="1.5"/><circle cx="12" cy="21" r="1.5"/><path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5"/>',
      items: [
        { id: 'ai_providers', title: 'توصيات مقدّمي الخدمة', subtitle: 'اقتراحات مطابقة لطلباتك', enabled: true },
        { id: 'ai_promos', title: 'عروض وخصومات وسيط AI', subtitle: 'حملات وعروض ترويجية', enabled: false },
        { id: 'ai_newsletter', title: 'نشرة وسيط الدورية', subtitle: 'ملخص أسبوعي لنشاطك', enabled: false },
      ]
    },
    {
      title: 'قنوات الإيصال',
      iconSvg: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
      items: [
        { id: 'channel_inapp', title: 'الإشعارات داخل وسيط AI', subtitle: 'مركز الإشعارات', enabled: true },
        { id: 'channel_email', title: 'البريد الإلكتروني', subtitle: 'إلى بريدك المسجّل', enabled: true },
        { id: 'channel_sms', title: 'الرسائل النصية SMS', subtitle: 'للتنبيهات العاجلة فقط', enabled: true },
        { id: 'channel_push', title: 'إشعارات الجوال Push', subtitle: 'عبر تطبيق وسيط', enabled: false },
      ]
    }
  ]);

  savePreferences() {
    // API logic goes here
    this.showToast('تم حفظ تفضيلات الإشعارات بنجاح');
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
