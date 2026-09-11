import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
	selector: 'app-join-marketer',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './join-marketer.component.html',
	styleUrls: ['./join-marketer.component.css']
})
export class JoinMarketerComponent {
	openFaq = -1;

	faqs = [
		{ q: 'هل أحتاج متابعين كثيرين للانضمام؟', a: 'لا. يمكنك البدء بأي عدد. العمولة تُحسب عند إفراج معاملة مالية من عميل أتى عبر رابطك.' },
		{ q: 'كم تبلغ العمولة؟', a: 'العمولة نسبة مئوية من قيمة المعاملة المستقرة. النسبة تختلف حسب نوع الخدمة وتظهر في لوحة تحكمك.' },
		{ q: 'متى أستلم عمولتي؟', a: 'العمولة تُضاف إلى محفظتك عند إفراج المرحلة. يمكنك سحبها أسبوعياً بحد أدنى 300 ريال.' },
		{ q: 'هل يمكنني إحالة نفسي؟', a: 'لا. الإحالة الذاتية والحسابات المرتبطة مرفوضة وعند ثبوتها تُلغى العمولة.' },
		{ q: 'ما هي قاعدة First-Touch؟', a: 'أول وسيط موثق يجلب المستخدم يبقى صاحب ارتباط الإحافة مدى الحياة ما لم يُبطَل لسبب موثق.' }
	];

	benefits = [
		{ icon: 'link', title: 'رابط مخصص', desc: 'رابط إحالة خاص بك تشاركه في أي مكان' },
		{ icon: 'chart', title: 'لوحة تحكم', desc: 'تتبع الإحالات والعمولات والمستويات' },
		{ icon: 'wallet', title: 'سحب مرن', desc: 'سحب أسبوعي بحد أدنى 300 ريال' },
		{ icon: 'levels', title: '15 مستوى', desc: 'تقدم عبر المستويات ومزايا إضافية' }
	];

	toggleFaq(i: number) {
		this.openFaq = this.openFaq === i ? -1 : i;
	}
}
