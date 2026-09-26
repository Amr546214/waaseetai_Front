import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-disputes',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './disputes.html',
  styleUrl: './disputes.css'
})
export class Disputes {
  currentTab = signal<string>('all');
  showToast = signal<string>('');

  setTab(t: string) {
    this.currentTab.set(t);
  }

  openToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }

  disputes = [
    {
      id: 'DSP-2026-014',
      title: 'نزاع: جودة التسليم لا تطابق العقد',
      project: 'تصميم هوية بصرية · مع نورة التصميم',
      status: 'open',
      who: 'mine',
      extra: 'review',
      icon: 'shield',
      iconClass: 'bg-[#FFB400]/15 text-[#FFB400]',
      badgeText: 'قيد مراجعة الإدارة',
      badgeClass: 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
      activeBorder: true,
      timeline: [
        { label: 'رُفع الطلب', done: true, icon: 'check' },
        { label: 'المراجعة الأولية', done: true, icon: 'review' },
        { label: 'مراجعة الإدارة', active: true, icon: 'shield' },
        { label: 'الإقفال' }
      ],
      aiText: ' العنصران الناقصان (الأيقونات ودليل الاستخدام) لم يُسلَّما بعد. بانتظار مراجعة الإدارة وتحديد القرار النهائي',
      aiDone: false,
      amount: '2,500',
      showEscalate: true,
      messages: 3,
      date: ''
    },
    {
      id: 'CNL-2026-007',
      title: 'إلغاء بالتراضي: تغيّر نطاق المشروع',
      project: 'كتابة محتوى متجر · مع رشا الكاتبة',
      status: 'open',
      who: 'mine',
      extra: 'pending',
      icon: 'hands',
      iconClass: 'bg-[#FF8C69]/15 text-[#FF8C69]',
      badgeText: 'بانتظار موافقة الطرفين',
      badgeClass: 'bg-[#FFB400]/15 text-[#D98A0B] border-[#FFB400]/30',
      activeBorder: true,
      timeline: [
        { label: 'رُفع الطلب', done: true, icon: 'check' },
        { label: 'تسوية مقترحة', active: true, icon: 'review' },
        { label: 'اعتماد الإدارة', icon: 'shield' },
        { label: 'الإقفال' }
      ],
      aiText: ' تسوية مقترحة: احتساب 40٪ للعمل المنجَز (760 ريال) للمقدّم وردّ الباقي إليك. بانتظار موافقتكما في النقاش',
      aiDone: false,
      amount: '1,900',
      showEscalate: false,
      messages: 1,
      date: ''
    },
    {
      id: 'DSP-2026-009',
      title: 'نزاع: تأخّر في التسليم',
      project: 'تطوير متجر · مع تقنية الرواد',
      status: 'closed',
      who: 'against',
      extra: '',
      icon: 'check',
      iconClass: 'bg-[#0FA99A]/15 text-[#0FA99A]',
      badgeText: 'أُغلق بالتراضي',
      badgeClass: 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30',
      activeBorder: false,
      timeline: [],
      aiText: ' اتفق الطرفان على تمديد 5 أيام دون غرامة، واعتمدت الإدارة القرار وأُغلق النزاع',
      aiDone: true,
      amount: '',
      showEscalate: false,
      messages: 0,
      date: 'أُغلق 12 مايو · المبلغ أُفرج بالكامل'
    },
    {
      id: 'CNL-2026-003',
      title: 'إلغاء بالتراضي: اتفاق ودّي',
      project: 'استشارة تسويقية · مع مكتب أفق',
      status: 'closed',
      who: 'mine',
      extra: '',
      icon: 'check',
      iconClass: 'bg-[#0FA99A]/15 text-[#0FA99A]',
      badgeText: 'أُغلق بالتراضي',
      badgeClass: 'bg-[#0FA99A]/15 text-[#0FA99A] border-[#0FA99A]/30',
      activeBorder: false,
      timeline: [],
      aiText: ' أُنهي العقد بالتراضي مع ردّ كامل للمبلغ، واعتمدت الإدارة التسوية',
      aiDone: true,
      amount: '',
      showEscalate: false,
      messages: 0,
      date: 'أُغلق 28 أبريل · رُدّ 1,500 ريال'
    }
  ];

  filteredDisputes = computed(() => {
    let f = this.currentTab();
    if (f === 'all') return this.disputes;
    return this.disputes.filter(d => d.status === f || d.who === f || d.extra === f);
  });
}
