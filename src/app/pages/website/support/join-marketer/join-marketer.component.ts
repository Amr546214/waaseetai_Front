import { Component, computed, inject } from '@angular/core';
import { LevelsService } from '../../../../core/levels/levels.service';
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

	private levels = inject(LevelsService);

	constructor() { this.levels.ensureLoaded(); }

	/**
	 * The broker ladder shown on the page comes from the backend table (GET /levels): level 1, level 8 and level 15 with THEIR real commission.
	 * Until it answers (or if it fails) no percentage is shown: nothing is typed here.
	 */
	tiers = computed<Tier[]>(() => {
		const pick = (n: number, perks: string[], featured = false): Tier | null => {
			const l = this.levels.level('MARKETER', n);
			return l ? { name: l.name, comm: l.percent + '٪', req: `المستوى ${n} من 15`, perks, featured } : null;
		};
		return [
			pick(1, ['رابط تتبع شخصي', 'لوحة أرباح', 'سحب أسبوعي بحد أدنى 300 دولار']),
			pick(8, ['كل مزايا المستويات السابقة', 'نسبة أعلى مع كل مستوى', 'حذف عميل لا ينقص مستواك']),
			pick(15, ['أعلى عمولة', 'كل مزايا المستويات السابقة', 'ارتباط إحالة مدى الحياة'], true),
		].filter((t): t is Tier => !!t);
	});

	/** "1–4.5٪": the real range of the ladder, or '' while unknown. */
	commissionRange = computed(() => {
		const r = this.levels.range('MARKETER')();
		return r ? `${r.min}–${r.max}٪` : '';
	});

	/** The example uses the level-8 percentage from the table (never a typed figure). */
	example = computed(() => {
		const l = this.levels.level('MARKETER', 8);
		return l ? { percent: l.percent, amount: Math.round(5000 * l.percent) / 100 } : null;
	});

	faqs = [
		{ q: 'هل أحتاج متابعين كثيرين للانضمام؟', a: 'لا — يمكن لأي شخص الانضمام بصرف النظر عن حجم متابعيه. المهم هو جودة الترويج والقدرة على إقناع الآخرين.' },
		{ q: 'كيف يُتتبع البيع الذي جاء عن طريقي؟', a: 'كل وسيط يحصل على رابط فريد. أول وسيط موثق يجلب المستخدم يبقى صاحب ارتباط الإحالة مدى الحياة (قاعدة First-Touch) ما لم يُبطَل لسبب موثق.' },
		{ q: 'هل يمكنني أن أكون وسيطاً ومقدم خدمة في آن واحد؟', a: 'نعم — الحسابان منفصلان في اللوحة لكن يمكن تفعيل كليهما من حساب واحد.' },
		{ q: 'متى أستلم عمولتي؟', a: 'العمولة تُضاف إلى محفظتك عند إفراج المرحلة. يمكنك سحبها أسبوعياً بحد أدنى 300 دولار.' },
		{ q: 'هل يمكنني إحالة نفسي؟', a: 'لا. الإحالة الذاتية والحسابات المرتبطة مرفوضة وعند ثبوتها تُلغى العمولة.' }
	];

	isOpen(i: number): boolean { return this.open.has(i); }

	toggleFaq(i: number) {
		if (this.open.has(i)) this.open.delete(i); else this.open.add(i);
	}
}
