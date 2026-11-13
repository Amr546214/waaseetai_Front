import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ExamEnvironment } from '../../core/services/exam-environment.service';

/** Instructions for the restricted exam: get Safe Exam Browser, open the exam from it, which devices work, and what this does NOT do. Shown only when the server runs the restricted mode. */
@Component({
	selector: 'ws-exam-environment-instructions',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
	<section class="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4" dir="rtl" data-testid="exam-env-instructions">
		<h3 class="text-base font-extrabold">هذا الاختبار يُفتح من داخل Safe Exam Browser</h3>
		@if (!env().ready) {
			<p class="text-sm text-amber-300" role="alert" data-testid="exam-env-not-ready">وضع الاختبار المقيّد مطلوب لكنه غير مُهيّأ على الخادم بعد، فلا يمكن بدء الاختبار الآن. تواصل مع الدعم.</p>
		} @else {
			<ol class="list-decimal pr-5 space-y-2 text-sm leading-7">
				<li>نزّل برنامج Safe Exam Browser المجاني من الموقع الرسمي: <a [href]="env().downloadUrl" target="_blank" rel="noopener noreferrer" class="underline text-[#2BD4C7]">safeexambrowser.org</a> وثبّته.</li>
				<li>افتح ملف إعدادات الاختبار من هنا (سيفتح البرنامج تلقائيًا):
					@if (env().configUrl; as u) { <a [href]="u" class="underline text-[#2BD4C7]" data-testid="exam-env-open">فتح الاختبار في Safe Exam Browser</a> }
					@if (env().configDownloadUrl; as d) { <span class="text-slate-400"> — أو <a [href]="d" class="underline">نزّل الملف</a> وافتحه بالبرنامج.</span> }
				</li>
				<li>سجّل الدخول داخل البرنامج، ثم ابدأ الاختبار من صفحة التخصصات.</li>
			</ol>
			<ul class="text-sm text-slate-300 space-y-1" data-testid="exam-env-systems">
				@for (sys of env().supportedSystems; track sys.system) {
					<li><strong>{{ sys.system }}</strong>: {{ sys.supported ? 'مدعوم' : 'غير مدعوم' }}@if (sys.note) { — <span class="text-slate-400">{{ sys.note }}</span> }</li>
				}
			</ul>
			@if (!env().testedInRealSeb) {
				<p class="text-xs text-amber-300" role="note" data-testid="exam-env-untested">هذا الوضع لم يُجرَّب بعد في Safe Exam Browser حقيقي (المفاتيح وملف الإعدادات موجودان على الخادم لكن التكامل لم يُختبر). قد لا يعمل على بعض الأنظمة، وفي هذه الحالة تواصل مع الدعم.</p>
			} @else {
				<p class="text-xs text-slate-400" data-testid="exam-env-tested">جُرّب التكامل في SEB حقيقي: {{ env().testedNote }}</p>
			}
		}
		<p class="text-xs text-slate-400" data-testid="exam-env-limits">{{ env().limits }}</p>
		<button type="button" class="px-4 py-2 rounded-xl border border-white/20 text-sm" (click)="recheck.emit()" data-testid="exam-env-recheck">فتحت الاختبار من البرنامج — تحقق مجددًا</button>
	</section>`
})
export class ExamEnvironmentInstructionsComponent {
	readonly env = input.required<ExamEnvironment>();
	readonly recheck = output<void>();
}
