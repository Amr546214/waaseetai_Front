import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CmsPage {
  key: string;
  title: string;
  lastEdited: string;
  content: string;
}

@Component({
  selector: 'app-sa-content',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sa-content.html',
  styleUrl: './sa-content.css',
})
export class SaContent {
  readonly pages: CmsPage[] = [
    {
      key: 'terms', title: 'شروط الاستخدام', lastEdited: '15 يناير 2025',
      content: `1. قبول الشروط
باستخدامك وسيط AI، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء من هذه الشروط، يرجى عدم استخدام وسيط AI.

2. التسجيل والحساب
يجب أن يكون عمرك 18 عاماً أو أكثر لتسجيل حساب. أنت مسؤول عن الحفاظ على سرية بيانات حسابك.

3. المدفوعات والرسوم
تُحجز المبالغ كضمان في نظام الضمان لدى وسيط AI حتى إتمام الخدمة. رسوم وسيط AI حسب مستوى مقدم الخدمة وفق جدول المستويات المعتمد.

4. المسؤولية
وسيط AI وسيط بين أطراف العقد ولا تتحمل مسؤولية النزاعات التي تنشأ عن أداء الخدمات.`,
    },
    { key: 'privacy', title: 'سياسة الخصوصية', lastEdited: '10 يناير 2025', content: 'نلتزم في وسيط AI بحماية بياناتك الشخصية...\n\nنجمع فقط البيانات اللازمة لتقديم الخدمة، ولا نشاركها مع أطراف ثالثة دون موافقتك.' },
    { key: 'faq', title: 'الأسئلة الشائعة (FAQ)', lastEdited: '5 يناير 2025', content: 'س: كيف أبدأ مشروعاً جديداً؟\nج: من لوحة التحكم اضغط على "طلب جديد" واتبع الخطوات.\n\nس: كيف تعمل الضمانات المالية؟\nج: يُحجز المبلغ لدى وسيط AI حتى تسليم العمل والموافقة عليه.' },
    { key: 'about', title: 'من نحن', lastEdited: '2 يناير 2025', content: 'وسيط AI منصة سعودية تربط بين طالبي الخدمات ومقدميها باستخدام الذكاء الاصطناعي لضمان أفضل مطابقة وأعلى جودة.' },
    { key: 'how', title: 'كيف يعمل', lastEdited: '28 ديسمبر 2024', content: '1. انشر طلبك\n2. يُطابقك AI بأفضل المقدمين\n3. تفاوض واتفق على السعر\n4. يُنجز العمل ويُسلَّم عبر الضمان' },
    { key: 'contact', title: 'تواصل معنا', lastEdited: '20 ديسمبر 2024', content: 'البريد الإلكتروني: support@waseet.ai\nالهاتف: 920000000\nساعات العمل: 9 صباحاً - 9 مساءً' },
    { key: 'welcome', title: 'رسالة الترحيب', lastEdited: '15 ديسمبر 2024', content: 'مرحباً بك في وسيط AI! نحن سعداء بانضمامك. استكشف المنصة وابدأ أول مشروع لك اليوم.' },
  ];

  selectedKey = signal(this.pages[0].key);
  draftContent = signal(this.pages[0].content);
  dirty = signal(false);
  savedMsg = signal('');

  selectedPage = computed(() => this.pages.find((p) => p.key === this.selectedKey()) ?? this.pages[0]);

  selectPage(key: string): void {
    const page = this.pages.find((p) => p.key === key);
    if (!page) return;
    this.selectedKey.set(key);
    this.draftContent.set(page.content);
    this.dirty.set(false);
    this.savedMsg.set('');
  }

  onContentChange(value: string): void {
    this.draftContent.set(value);
    this.dirty.set(true);
  }

  saveAndPublish(): void {
    const page = this.pages.find((p) => p.key === this.selectedKey());
    if (page) page.content = this.draftContent();
    this.dirty.set(false);
    this.savedMsg.set('تم الحفظ محليًا لهذه الجلسة — النشر الفعلي على الموقع غير متاح حاليًا');
    setTimeout(() => this.savedMsg.set(''), 2500);
  }
}
