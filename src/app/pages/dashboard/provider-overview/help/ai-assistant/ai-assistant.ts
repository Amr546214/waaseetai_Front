import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface ChatMessage {
	role: 'user' | 'assistant';
	text: string;
	links?: [string, string][];
}

const MAX_QUESTION_LENGTH = 500;

@Component({
	selector: 'app-provider-ai-assistant',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	template: `
	<div class="w-full relative z-10 pb-10">
		<!-- Header -->
		<div class="mb-4 flex items-start justify-between gap-3 flex-wrap">
			<div>
				<h1 class="text-xl font-black text-[var(--txt)] mb-1 flex items-center gap-2">
					المساعد الذكي
					<span class="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#0FA99A] bg-[rgba(15,169,154,.12)] border border-[rgba(15,169,154,.26)] rounded-full px-2.5 py-0.5">
						<span class="w-1.5 h-1.5 rounded-full bg-[#0FA99A]"></span>متصل
					</span>
				</h1>
				<p class="text-xs text-[var(--txt-3)]">اسأل عن العروض، التسليم، الضمان، النزاعات، وسحب أرباحك</p>
			</div>
			<a routerLink="/provider-overview/help/live-support" class="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-lg text-[var(--txt)] text-xs font-bold no-underline shrink-0 hover:opacity-80 transition-opacity">
				<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="7" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg>
				تحويل لموظف
			</a>
		</div>

		<!-- Disclosure -->
		<div class="flex items-center gap-3 p-3.5 bg-gradient-to-br from-[rgba(123,47,190,.09)] to-[rgba(43,127,255,.06)] backdrop-blur-md border border-[rgba(123,47,190,.22)] rounded-2xl mb-5">
			<div class="w-[30px] h-[30px] rounded-lg bg-[rgba(123,47,190,.16)] flex items-center justify-center shrink-0 text-[var(--ai-txt,#7B2FBE)]">
				<svg class="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
					<circle cx="12" cy="12" r="2" /><circle cx="4" cy="6" r="1.5" /><circle cx="20" cy="6" r="1.5" />
					<circle cx="4" cy="18" r="1.5" /><circle cx="20" cy="18" r="1.5" /><circle cx="12" cy="3" r="1.5" />
					<circle cx="12" cy="21" r="1.5" />
					<path d="M12 10V5M12 19v-5M10 12H5M19 12h-5M5.6 7.4l3.5 3.5M14.9 14.9l3.5 3.5M5.6 16.6l3.5-3.5M14.9 9.1l3.5-3.5" />
				</svg>
			</div>
			<div class="flex-1">
				<div class="text-[10px] font-extrabold text-[var(--ai-txt,#A56BE0)] tracking-wider mb-0.5">وسيط، المساعد الذكي</div>
				<p class="text-[13px] text-[var(--txt-2,#A8B2D1)]">هذه محادثة مع مساعد آلي يبحث في الأسئلة الشائعة الموثّقة عن المنصة. لا تُشارَك بياناتك الحسّاسة، والقرار النهائي والإجراءات المالية تبقى بيدك أو لدى الفريق المختص</p>
			</div>
		</div>

		<!-- Chat -->
		<div class="bg-[var(--crd-bg,#fff)] border border-[var(--sec-bd,#E7EAF1)] rounded-2xl p-4 flex flex-col" style="min-height: 460px">
			<div class="flex-1 flex flex-col gap-3 overflow-y-auto" style="max-height: 480px">
				@for (m of messages(); track $index) {
					<div class="flex" [class.justify-end]="m.role === 'user'">
						<div class="max-w-[85%] flex flex-col" [class.items-end]="m.role === 'user'">
							<div
								class="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed"
								[class]="m.role === 'user' ? 'bg-gradient-to-br from-[#2BD4C7] to-[#2B7FFF] text-[#070D24] font-semibold' : 'bg-[rgba(123,47,190,.06)] border border-[rgba(123,47,190,.15)] text-[var(--txt)]'"
							>
								{{ m.text }}
							</div>
							@if (m.links?.length) {
								<div class="flex flex-wrap gap-2 mt-2">
									@for (link of m.links; track link[1]) {
										<a [routerLink]="link[1]" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(123,47,190,.10)] border border-[rgba(123,47,190,.26)] rounded-lg text-[11.5px] font-bold text-[var(--ai-txt,#A56BE0)] no-underline hover:bg-[rgba(123,47,190,.18)] transition-colors">
											<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
											{{ link[0] }}
										</a>
									}
								</div>
							}
						</div>
					</div>
				}
				@if (isTyping()) {
					<div class="flex">
						<div class="rounded-2xl px-4 py-3 bg-[rgba(123,47,190,.06)] border border-[rgba(123,47,190,.15)]">
							<span class="ha-typing"><span></span><span></span><span></span></span>
						</div>
					</div>
				}
			</div>

			<!-- Quick chips -->
			<div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--sec-bd,#E7EAF1)]">
				@for (q of quickQuestions; track q) {
					<button type="button" (click)="sendQuick(q)" [disabled]="isTyping()"
						class="px-3 py-1.5 bg-[rgba(123,47,190,.06)] border border-[rgba(123,47,190,.20)] rounded-full text-[12px] font-semibold text-[var(--ai-txt,#A56BE0)] hover:bg-[rgba(123,47,190,.14)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
						{{ q }}
					</button>
				}
			</div>

			<!-- Input -->
			<div class="mt-3 flex items-end gap-2">
				<textarea
					[(ngModel)]="draft"
					(keydown.enter)="onEnter($event)"
					[disabled]="isTyping()"
					[maxlength]="maxQuestionLength"
					rows="1"
					placeholder="اكتب سؤالك هنا..."
					class="flex-1 resize-none rounded-xl border border-[var(--sec-bd,#E7EAF1)] bg-transparent px-3.5 py-2.5 text-[13px] text-[var(--txt)] outline-none focus:border-[#A56BE0]"
				></textarea>
				<button
					type="button"
					(click)="send()"
					[disabled]="isTyping() || !draft.trim()"
					class="shrink-0 px-5 py-2.5 bg-gradient-to-br from-[#7B2FBE] to-[#A56BE0] rounded-full text-white font-extrabold text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
				>
					{{ isTyping() ? 'جارٍ البحث...' : 'إرسال' }}
				</button>
			</div>
			<div class="mt-1.5 flex items-center justify-between">
				<span class="text-[10.5px] text-[var(--txt-3)]">قد يخطئ المساعد الذكي. تحقّق من المعلومات المهمة، وللحالات المعقّدة اطلب التحويل لموظف</span>
				<span class="text-[10px] text-[var(--txt-3)] shrink-0 ms-2">{{ draft.length }}/{{ maxQuestionLength }}</span>
			</div>
		</div>
	</div>
	`,
	styles: [`
		:host { display: block; width: 100%; animation: ws-fade 0.2s ease forwards; }
		@keyframes ws-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

		@keyframes ha-blink { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
		.ha-typing { display: inline-flex; gap: 5px; align-items: center; }
		.ha-typing span { width: 7px; height: 7px; border-radius: 50%; background: #A56BE0; animation: ha-blink 1.2s infinite; }
		.ha-typing span:nth-child(2) { animation-delay: .2s; }
		.ha-typing span:nth-child(3) { animation-delay: .4s; }
	`],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderAiAssistantComponent {
	readonly maxQuestionLength = MAX_QUESTION_LENGTH;

	draft = '';

	messages = signal<ChatMessage[]>([
		{
			role: 'assistant',
			text: 'مرحبًا، أنا المساعد الذكي لوسيط AI. أجيبك فورًا عن العروض، التسليم، الضمان، النزاعات، وسحب أرباحك. اكتب سؤالك بلغتك، أو اختر من المواضيع السريعة بالأسفل',
		},
	]);

	isTyping = signal(false);

	quickQuestions = [
		'كيف يعمل الضمان؟',
		'كيف أرفع التسليم؟',
		'متى أستلم أرباحي؟',
		'كيف أُقيَّم من العميل؟',
		'ماذا أفعل عند نزاع؟',
	];

	// Client-side keyword matching against a fixed FAQ list — an honest,
	// transparent FAQ search, not a real AI call (there's no backend endpoint
	// for that on this page). The brief delay is a UX pacing choice, not a
	// simulation of "AI thinking".
	private knowledgeBase: { k: string[]; a: string; links: [string, string][] }[] = [
		{
			k: ['ضمان', 'الضمان', 'افرج', 'أفرج', 'افراج', 'إفراج'],
			a: 'يُحتجز مبلغ الطلب في حساب ضمان مرخّص فور توقيع العقد، ولا يصل إليك إلا بعد قبول العميل للتسليم. بمجرد أن يضغط العميل «قبول التسليم» يُحوَّل المبلغ تلقائيًّا إلى محفظتك، فيمكنك بعدها طلب سحبه',
			links: [['العقود والضمان', '/provider-overview/finance/wallet']],
		},
		{
			k: ['تسليم', 'التسليم', 'ارفع', 'أرفع', 'اسلم', 'أسلم', 'تسليم العمل', 'كيف اسلم'],
			a: 'بعد إنجاز العمل، ادخل إلى صفحة متابعة المشروع النشط وارفع ملفات التسليم مع وصف موجز للإنجاز، ثم أرسلها للعميل للمراجعة. إن قَبِل العميل التسليم يُغلَق المشروع ويُحوَّل المبلغ من الضمان إلى محفظتك تلقائيًّا',
			links: [['مشاريعي النشطة', '/provider-overview/projects/active']],
		},
		{
			k: ['عروض', 'العروض', 'عرض', 'تقديم عرض', 'كيف اقدم', 'أقدم عرض', 'كيف أقدم'],
			a: 'تصفّح الطلبات المتاحة من صفحة استكشاف الطلبات، واختر ما يناسب تخصصك، ثم قدّم عرضك بالسعر والمدة وتفاصيل التنفيذ. تظهر الطلبات مرتّبة حسب توافقها مع تخصصك، ويقارن العميل عرضك مع عروض مقدّمين آخرين قبل الاختيار',
			links: [['استكشاف الطلبات', '/provider-overview/explore-requests']],
		},
		{
			k: ['نزاع', 'النزاع', 'خلاف', 'شكوى', 'اختلفت'],
			a: 'إذا اختلفت مع العميل افتح نزاعًا من صفحة النزاعات وأرفق الأدلة الداعمة لموقفك. يبقى المبلغ محتجزًا في الضمان حتى يصدر الفريق المختص قراره بعد مراجعة الطرفين',
			links: [['النزاعات', '/provider-overview/disputes']],
		},
		{
			k: ['سحب', 'السحب', 'أرباحي', 'ارباحي', 'متى استلم', 'متى أستلم', 'تحويل الأرباح', 'الدفع', 'ارباح'],
			a: 'بعد اعتماد إغلاق المشروع تُضاف أرباحك إلى محفظتك مباشرة، ويمكنك طلب سحبها إلى حسابك البنكي من صفحة سحب الأرباح. تُنفَّذ طلبات السحب خلال المدة المعلنة في الصفحة، وتظهر حالة كل عملية في سجلّ معاملات محفظتك',
			links: [['سحب الأرباح', '/provider-overview/finance/withdraw']],
		},
		{
			k: ['تقييم', 'التقييم', 'تقييمي', 'يقيمني', 'تقييم العميل', 'تصنيف'],
			a: 'بعد إغلاق المشروع يقيّمك العميل بناءً على جودة العمل والالتزام بالمواعيد والتواصل. يظهر تقييمك على ملفك العام ويؤثر في ترتيب ظهورك للعملاء وفي مستوى تصنيفك على المنصة',
			links: [['مستوى التصنيف', '/provider-overview/profile/level']],
		},
		{
			k: ['نماذج', 'نموذج', 'رفع مشروع', 'السوق', 'نماذجي', 'بيع خدمة', 'خدمة جاهزة'],
			a: 'يمكنك عرض خدماتك الجاهزة (نماذج الأعمال) في السوق ليطّلع عليها العملاء ويشتروها مباشرة دون انتظار طلب مخصّص. أضف نموذجك من مركز النماذج والخدمات وحدّد سعره ووصفه، وبعد اعتماده يظهر في السوق',
			links: [['مركز النماذج والخدمات', '/provider-overview/business-models/center']],
		},
		{
			k: ['بريد', 'جوال', 'كلمة المرور', 'تعديل', 'أعدل', 'اعدل', 'رقم'],
			a: 'البيانات الحسّاسة كالبريد والجوال وكلمة المرور تُعدّل عبر مسار محكوم من صفحة طلبات تعديل الملف، ليراجعها الفريق المختص قبل تطبيقها حفاظًا على أمان حسابك',
			links: [['طلبات تعديل الملف', '/provider-overview/profile/requests']],
		},
	];

	send() {
		const question = this.draft.trim();
		if (!question || this.isTyping()) return;
		this.draft = '';
		this.ask(question);
	}

	sendQuick(text: string) {
		if (this.isTyping()) return;
		this.ask(text);
	}

	onEnter(event: Event) {
		const keyboardEvent = event as KeyboardEvent;
		if (keyboardEvent.shiftKey) return;
		event.preventDefault();
		this.send();
	}

	private ask(question: string) {
		this.messages.update((list) => [...list, { role: 'user', text: question }]);
		this.isTyping.set(true);

		setTimeout(() => {
			this.isTyping.set(false);
			const match = this.knowledgeBase.find((item) => item.k.some((kw) => question.includes(kw)));

			const answer = match
				? { text: match.a, links: match.links }
				: {
						text: 'لم أجد إجابة مطابقة لسؤالك في الأسئلة الشائعة. يمكنك إعادة صياغة سؤالك، أو التحويل لموظف دعم بشري لمتابعة حالتك',
						links: [
							['الدعم المباشر', '/provider-overview/help/live-support'],
							['فتح تذكرة دعم', '/provider-overview/help/tickets/new'],
						] as [string, string][],
					};

			this.messages.update((list) => [...list, { role: 'assistant', text: answer.text, links: answer.links }]);
		}, 800);
	}
}
