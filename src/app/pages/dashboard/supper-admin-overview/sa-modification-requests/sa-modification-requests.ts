import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

type ReqStatus = 'ai' | 'human' | 'ok' | 'rejected';
type FilterKey = 'all' | ReqStatus;

interface TimelineStep {
  label: string;
  state: 'done' | 'active' | 'rejected' | 'pending';
}

interface ModificationRequest {
  id: string;
  field: string;
  requesterName: string;
  requesterType: string;
  sensitive: boolean;
  status: ReqStatus;
  oldValue: string;
  newValue: string;
  timeAgo: string;
  verdictLabel: string;
  verdictText: string;
  verdictScore: string;
  reviewer?: string;
  timeline: TimelineStep[];
}

@Component({
  selector: 'app-sa-modification-requests',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-modification-requests.html',
  styleUrl: './sa-modification-requests.css',
})
export class SaModificationRequests {
  activeFilter = signal<FilterKey>('all');
  toast = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'ai', label: 'قيد مراجعة الذكاء' },
    { key: 'human', label: 'بانتظار اعتماد' },
    { key: 'ok', label: 'معتمد' },
    { key: 'rejected', label: 'مرفوض' },
  ];

  requests = signal<ModificationRequest[]>([
    {
      id: 'REQ-4821',
      field: 'رقم الحساب البنكي IBAN',
      requesterName: 'محمد العمري',
      requesterType: 'طالب خدمة فرد',
      sensitive: true,
      status: 'ai',
      oldValue: 'SA03 8000 0000 6080 1016 7519',
      newValue: 'SA44 2000 0001 2345 6789 1234',
      timeAgo: 'قبل 8 دقائق',
      verdictLabel: 'فحص الذكاء جار',
      verdictText: 'يتحقق الذكاء من تطابق اسم صاحب الحساب الجديد مع الهوية ومن سلامة صيغة IBAN قبل رفعه للمراجع البشري',
      verdictScore: 'دقة 95%',
      timeline: [
        { label: 'مراجعة الذكاء', state: 'active' },
        { label: 'اعتماد بشري', state: 'pending' },
        { label: 'تطبيق', state: 'pending' },
      ],
    },
    {
      id: 'REQ-4815',
      field: 'رقم الهوية الوطنية',
      requesterName: 'سارة القحطاني',
      requesterType: 'مقدم خدمة فرد',
      sensitive: true,
      status: 'human',
      oldValue: '1098••••76',
      newValue: '1102••••43',
      timeAgo: 'قبل ساعتين',
      verdictLabel: 'توصية الذكاء، تمرير للمراجعة',
      verdictText: 'تحقق الذكاء من تطابق الرقم مع وثيقة الهوية المرفقة عبر نفاذ ولم يرصد تعارضاً، يحتاج اعتماد مراجع بشري',
      verdictScore: 'ثقة 96%',
      timeline: [
        { label: 'مراجعة الذكاء', state: 'done' },
        { label: 'اعتماد بشري', state: 'active' },
        { label: 'تطبيق', state: 'pending' },
      ],
    },
    {
      id: 'REQ-4790',
      field: 'رقم الجوال',
      requesterName: 'شركة الخليج',
      requesterType: 'طالب خدمة شركة',
      sensitive: true,
      status: 'ok',
      oldValue: '0551234567',
      newValue: '0509876543',
      timeAgo: 'أمس 14:20',
      verdictLabel: 'اعتمده المراجع نورة الحربي',
      verdictText: 'تم تأكيد الجوال الجديد برمز OTP والتحقق من خلوه من بلاغات سابقة، طُبق التغيير بنجاح',
      verdictScore: 'ثقة 98%',
      reviewer: 'نورة الحربي',
      timeline: [
        { label: 'مراجعة الذكاء', state: 'done' },
        { label: 'اعتماد بشري', state: 'done' },
        { label: 'تطبيق', state: 'done' },
      ],
    },
    {
      id: 'REQ-4763',
      field: 'البريد الإلكتروني',
      requesterName: 'خالد المطيري',
      requesterType: 'وسيط تسويقي',
      sensitive: true,
      status: 'ok',
      oldValue: 'mohammed.old@email.com',
      newValue: 'm.alamri@email.com',
      timeAgo: 'قبل 3 أيام',
      verdictLabel: 'اعتمده المراجع خالد الزهراني',
      verdictText: 'جرى تأكيد ملكية البريد الجديد عبر رابط تفعيل، ولم يرصد الذكاء أي نشاط مشبوه',
      verdictScore: 'ثقة 97%',
      reviewer: 'خالد الزهراني',
      timeline: [
        { label: 'مراجعة الذكاء', state: 'done' },
        { label: 'اعتماد بشري', state: 'done' },
        { label: 'تطبيق', state: 'done' },
      ],
    },
    {
      id: 'REQ-4702',
      field: 'اسم صاحب الحساب البنكي',
      requesterName: 'شركة التقنية المتقدمة',
      requesterType: 'مقدم خدمة شركة',
      sensitive: true,
      status: 'rejected',
      oldValue: 'محمد سالم العمري',
      newValue: 'أحمد سالم العمري',
      timeAgo: 'قبل 5 أيام',
      verdictLabel: 'رفضه المراجع بناء على تنبيه الذكاء',
      verdictText: 'اسم صاحب الحساب الجديد لا يطابق اسم الهوية الموثقة، يلزم أن يكون الحساب البنكي باسم صاحب الحساب نفسه',
      verdictScore: 'تعارض',
      timeline: [
        { label: 'مراجعة الذكاء', state: 'done' },
        { label: 'رفض الاعتماد', state: 'rejected' },
      ],
    },
  ]);

  filteredRequests = computed(() => {
    const f = this.activeFilter();
    const list = this.requests();
    return f === 'all' ? list : list.filter((r) => r.status === f);
  });

  counts = computed(() => {
    const list = this.requests();
    return {
      all: list.length,
      ai: list.filter((r) => r.status === 'ai').length,
      human: list.filter((r) => r.status === 'human').length,
      ok: list.filter((r) => r.status === 'ok').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  approve(req: ModificationRequest) {
    this.requests.update((list) =>
      list.map((r) =>
        r.id === req.id
          ? {
              ...r,
              status: 'ok',
              verdictLabel: 'اعتمده المراجع مدير النظام',
              verdictText: 'تم اعتماد التعديل يدوياً وتطبيقه على بيانات الحساب',
              reviewer: 'مدير النظام',
              timeline: [
                { label: 'مراجعة الذكاء', state: 'done' },
                { label: 'اعتماد بشري', state: 'done' },
                { label: 'تطبيق', state: 'done' },
              ],
            }
          : r
      )
    );
    this.showToast(`تم اعتماد الطلب ${req.id} وتطبيق التعديل`);
  }

  reject(req: ModificationRequest) {
    this.requests.update((list) =>
      list.map((r) =>
        r.id === req.id
          ? {
              ...r,
              status: 'rejected',
              verdictLabel: 'رفضه مدير النظام',
              verdictText: 'تم رفض طلب التعديل، تبقى البيانات الحالية دون تغيير',
              timeline: [
                { label: 'مراجعة الذكاء', state: 'done' },
                { label: 'رفض الاعتماد', state: 'rejected' },
              ],
            }
          : r
      )
    );
    this.showToast(`تم رفض الطلب ${req.id}`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
