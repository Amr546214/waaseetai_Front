import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface Tier { name: string; comm: string; req: string; perks: string[]; featured?: boolean; }

@Component({
	selector: 'app-join-marketer',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './join-marketer.component.html',
	styleUrls: ['./join-marketer.component.css']
})
export class JoinMarketerComponent {
	/** Open FAQ items (design P-SP-005 toggles each item independently). */
	private open = new Set<number>();

	/**
	 * Design layout (P-SP-005 "مستويات الوسيط"), but with the platform's real broker ladder:
	 * 15 levels, commission rising from 3% (مسوّق) to 18% (رابط مؤسسي) — the design's
	 * 3 tiers at 5/10/15% by monthly sales do not exist.
	 */
	tiers: Tier[] = [
		{ name: 'مسوّق', comm: '3٪', req: 'المستوى 1 من 15', perks: ['رابط تتبع شخصي', 'لوحة أرباح', 'سحب أسبوعي بحد أدنى 300 ريال'] },
		{ name: 'موجّه', comm: '10٪', req: 'المستوى 8 من 15', perks: ['كل مزايا المستويات السابقة', 'نسبة أعلى مع كل مستوى', 'حذف عميل لا ينقص مستواك'] },
		{ name: 'رابط مؤسسي', comm: '18٪', req: 'المستوى 15 من 15', perks: ['أعلى عمولة', 'كل مزايا المستويات السابقة', 'ارتباط إحالة مدى الحياة'], featured: true }
	];

	faqs = [
		{ q: 'هل أحتاج متابعين كثيرين للانضمام؟', a: 'لا — يمكن لأي شخص الانضمام بصرف النظر عن حجم متابعيه. المهم هو جودة الترويج والقدرة على إقناع الآخرين.' },
		{ q: 'كيف يُتتبع البيع الذي جاء عن طريقي؟', a: 'كل وسيط يحصل على رابط فريد. أول وسيط موثق يجلب المستخدم يبقى صاحب ارتباط الإحالة مدى الحياة (قاعدة First-Touch) ما لم يُبطَل لسبب موثق.' },
		{ q: 'هل يمكنني أن أكون وسيطاً ومقدم خدمة في آن واحد؟', a: 'نعم — الحسابان منفصلان في اللوحة لكن يمكن تفعيل كليهما من حساب واحد.' },
		{ q: 'متى أستلم عمولتي؟', a: 'العمولة تُضاف إلى محفظتك عند إفراج المرحلة. يمكنك سحبها أسبوعياً بحد أدنى 300 ريال.' },
		{ q: 'هل يمكنني إحالة نفسي؟', a: 'لا. الإحالة الذاتية والحسابات المرتبطة مرفوضة وعند ثبوتها تُلغى العمولة.' }
	];

	isOpen(i: number): boolean { return this.open.has(i); }

	toggleFaq(i: number) {
		if (this.open.has(i)) this.open.delete(i); else this.open.add(i);
	}
}
