// Bebo local motion commands + dialect/voice option lists.
//
// Ported from the Bebo v4 handoff (cute-robot/bebo-core.mjs `DIALECTS`,
// `ACTIONS`, `normalize`, `chooseDialect`, `commandFor`, `acknowledge`; the
// voice list from bebo-chat.js / server.mjs `VOICES`). Phrases, dialect
// vocabularies, acknowledgements and option lists are copied as-is — nothing
// is invented. Pure functions only: no DOM, no network, no AI.
//
// Routing rule (same as the handoff): a message is a local Bebo command
// ONLY when, after stripping an optional "يا بيبو / bebo" prefix and a
// politeness prefix, it EXACTLY equals one of the listed phrases. Anything
// else (e.g. "ازاي أعمل مشروع؟") is a normal assistant question.

export const BEBO_DIALECTS = {
	egyptian: { label: 'مصري', language: 'ar-EG' },
	saudi: { label: 'سعودي', language: 'ar-SA' },
	gulf: { label: 'خليجي', language: 'ar-KW' },
	msa: { label: 'فصحى', language: 'ar-SA' },
	english: { label: 'English', language: 'en-US' },
} as const;
export type BeboDialect = keyof typeof BEBO_DIALECTS;
/** 'auto' = detect from the user's words (handoff "تلقائي من كلامك"). */
export type BeboDialectChoice = BeboDialect | 'auto';
export const BEBO_DIALECT_IDS = Object.keys(BEBO_DIALECTS) as BeboDialect[];
export const DEFAULT_DIALECT: BeboDialect = 'egyptian';

export const BEBO_VOICES = ['Puck', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Sulafat', 'Charon', 'Leda'] as const;
export type BeboVoice = (typeof BEBO_VOICES)[number];
export const DEFAULT_VOICE: BeboVoice = 'Puck';

export const BEBO_ACTIONS = [
	'jump', 'walk', 'wave', 'happy', 'typing', 'rest', 'sleep', 'idle', 'reset', 'stop',
	'roam_on', 'roam_off', 'scratch', 'dance', 'fly', 'laugh', 'cry', 'plead', 'chase',
] as const;
export type BeboAction = (typeof BEBO_ACTIONS)[number];

export const isBeboDialect = (v: unknown): v is BeboDialect => typeof v === 'string' && Object.hasOwn(BEBO_DIALECTS, v);
export const isBeboVoice = (v: unknown): v is BeboVoice => typeof v === 'string' && (BEBO_VOICES as readonly string[]).includes(v);

export function normalize(text: string): string {
	return String(text || '')
		.toLowerCase()
		.replace(/[ً-ٰٟ]/g, '')
		.replace(/[أإآ]/g, 'ا')
		.replace(/ى/g, 'ي')
		.replace(/[^\p{L}\p{N}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const DIALECT_VOCAB: Record<Exclude<BeboDialect, 'english'>, string[]> = {
	egyptian: ['ايه', 'ليه', 'كدة', 'ده', 'دي', 'ازيك', 'عايز', 'عاوزه', 'عايزة', 'ازاي', 'كده', 'دلوقتي', 'بص', 'بتاع', 'يلا', 'عامل', 'انط', 'امشي'],
	saudi: ['وش', 'ابغي', 'ابي', 'الحين', 'كيفك', 'حياك', 'تبي', 'تقدر', 'عساك'],
	gulf: ['شلونك', 'شلون', 'وايد', 'هلا', 'هني', 'شخبارك', 'شنو', 'زين', 'جذي'],
	msa: ['اريد', 'كيف', 'مرحبا', 'يمكنني', 'استطيع', 'رجاء', 'يرجي', 'اشرح'],
};

export function chooseDialect(text: string, requested: BeboDialectChoice = 'auto', previous: BeboDialect = DEFAULT_DIALECT): BeboDialect {
	if (isBeboDialect(requested)) return requested;
	const t = normalize(text);
	const latin = (t.match(/[a-z]/g) || []).length;
	const arabic = (t.match(/[؀-ۿ]/g) || []).length;
	if (latin > 4 && latin > arabic * 1.5) return 'english';
	const tokens = new Set(t.split(' '));
	const scores = Object.entries(DIALECT_VOCAB)
		.map(([id, words]) => [id, words.filter((w) => tokens.has(w)).length] as const)
		.sort((a, b) => b[1] - a[1]);
	if (scores[0][1] > 0 && scores[0][1] > (scores[1]?.[1] || 0)) return scores[0][0] as BeboDialect;
	return isBeboDialect(previous) ? previous : DEFAULT_DIALECT;
}

const COMMAND_GROUPS: Record<BeboAction, string[]> = {
	stop: ['اسكت', 'اخرس', 'وقف الصوت', 'اوقف الصوت', 'كفاية كلام', 'بس خلاص', 'stop talking', 'be quiet', 'stop'],
	reset: ['ارجع مكانك', 'ارجع لمكانك', 'ارجع مكانك تاني', 'reset', 'go home'],
	roam_on: ['اتحرك لوحدك', 'اتحرك من نفسك', 'تحرك من نفسك', 'wander', 'roam'],
	roam_off: ['بطل تتحرك لوحدك', 'وقف التجول', 'stop roaming'],
	jump: ['انط', 'نط', 'اقفز', 'انط كده', 'يلا انط', 'jump', 'hop'],
	walk: ['امشي', 'اتمشي', 'تمشي', 'تحرك', 'امش', 'امشي شوية', 'walk', 'take a walk'],
	wave: ['سلم', 'سلم عليا', 'سلم علي', 'لوح', 'قول هاي', 'wave', 'wave hello'],
	happy: ['افرح', 'احتفل', 'celebrate', 'be happy'],
	dance: ['ارقص', 'ارقصلي', 'ارقص لي', 'يلا ارقص', 'dance', 'dance for me'],
	scratch: ['اهرش', 'هرش', 'اهرش راسك', 'هرش راسك', 'حك راسك', 'احك راسك', 'scratch', 'scratch your head'],
	fly: ['دبانة', 'دبانه', 'طلع دبانة', 'طلع دبانه', 'هات دبانة', 'هات دبانه', 'كل الدبانة', 'كل الدبانه', 'امسك الدبانة', 'امسك الدبانه', 'catch a fly', 'eat the fly'],
	laugh: ['اضحك', 'اضحك جامد', 'اضحك اوي', 'ضحك', 'ضحكة', 'ضحكه', 'هاهاها', 'laugh', 'laugh hard'],
	cry: ['عيط', 'عيط جامد', 'عيط اوي', 'اعيط', 'ابكي', 'ابك', 'ابكي جامد', 'cry', 'cry hard'],
	plead: ['صعبنيات', 'صعبانيات', 'اعمل صعبنيات', 'اعمل صعبانيات', 'اعمل صعبانيات زي القطط', 'اعمل حركة صعبنيات زي القطط', 'صعبنيات زي القطط', 'صعبانيات زي القطط', 'اعمل عيون قطط', 'عيون قطط', 'عيون قطة', 'عيون قطه', 'اتدلع', 'صعب عليا نفسك', 'beg', 'puppy eyes', 'kitten eyes'],
	chase: ['اجري ورا القطة', 'اجري ورا القطه', 'اجري ورا قطة', 'اجري ورا قطة بتجري', 'اجري ورا قطه', 'اجري وراء القطة', 'اجري ورا البسة', 'العب مع القطة', 'العب مع القطه', 'طارد القطة', 'طارد القطه', 'هات القطة', 'هات القطه', 'chase the cat', 'chase a cat', 'play with the cat'],
	typing: ['افتح اللاب', 'افتح اللابتوب', 'امسك اللاب', 'اكتب', 'اشتغل', 'افتح اللاب واكتب', 'type', 'start typing'],
	rest: ['اقعد', 'ارتاح', 'استريح', 'sit', 'rest'],
	sleep: ['نام', 'روح نام', 'sleep'],
	idle: ['استني', 'قف', 'وقف الحركة', 'توقف', 'wait', 'stand still'],
	// Handoff object order matters for iteration only when phrases overlap;
	// they do not, so a record keyed by action is equivalent.
} as Record<BeboAction, string[]>;

/** Exact-phrase command match (handoff `commandFor`), or null. */
export function commandFor(text: string): BeboAction | null {
	const t = normalize(text)
		.replace(/^(يا\s+)?(بيبو|bebo)\s+/, '')
		.replace(/^(من فضلك|لو سمحت|ممكن|please)\s+/, '')
		.trim();
	if (t.length > 100 || /^(لا|مت|ما|dont|do not|don't)\b/.test(t)) return null;
	for (const [action, phrases] of Object.entries(COMMAND_GROUPS)) if (phrases.includes(t)) return action as BeboAction;
	return null;
}

const ACKNOWLEDGEMENTS: Record<BeboDialect, Record<BeboAction, string>> = {
	egyptian: { laugh: 'هاهاها! مش قادر أمسك نفسي!', cry: 'دموعي بقت شلّال! هاتوا المناديل!', plead: 'طب علشاني أنا؟ بصّ للعيون دي!', chase: 'يا بسبس، استنيني! نلعب استغماية؟', scratch: 'ثانية، فيه حاجة بتقرّصني!', dance: 'على واحدة ونص! شوف الرقصة دي.', fly: 'إيه ده؟ دبّانة! تعالي هنا…', jump: 'حاضر، نطّة حلوة ليك!', walk: 'حاضر، هتمشّى شوية.', wave: 'أهلًا بيك! نورتني.', happy: 'يا سلام! خلّينا نفرح سوا.', typing: 'فتحت اللابتوب، جاهز أشتغل معاك.', rest: 'حاضر، استراحة صغيرة.', sleep: 'تصبح على خير، هنام شوية.', idle: 'حاضر، مستني معاك.', reset: 'رجعت لمكاني.', stop: 'حاضر، وقّفت الصوت.', roam_on: 'تمام، هتحرّك من نفسي شوية.', roam_off: 'تمام، وقّفت التجوّل.' },
	saudi: { laugh: 'هههه! ما قدرت أمسك ضحكتي!', cry: 'دموعي صارت شلّال! وين المناديل؟', plead: 'تكفى، شوف هالعيون!', chase: 'يا بسبس، انتظريني! خلّنا نلعب.', scratch: 'لحظة، أحكّ راسي شوي!', dance: 'أبشر، هذي رقصة لك!', fly: 'وش هذي؟ ذبابة! خلّني أمسكها.', jump: 'أبشر، هذي نطّة لك!', walk: 'أبشر، بتمشّى شوي.', wave: 'يا هلا والله! حيّاك.', happy: 'يا سلام، خلّنا نحتفل!', typing: 'أبشر، فتحت اللابتوب وجاهز أشتغل معك.', rest: 'تمام، باخذ لي راحة.', sleep: 'تصبح على خير.', idle: 'أبشر، أنا بانتظارك.', reset: 'رجعت مكاني.', stop: 'أبشر، وقّفت الصوت.', roam_on: 'أبشر، بتحرّك من نفسي شوي.', roam_off: 'تمام، وقّفت التجوّل.' },
	gulf: { laugh: 'هههه! وايد تضحّك!', cry: 'دموعي صارت شلّال! وين المناديل؟', plead: 'عشاني أنا، شوف هالعيون!', chase: 'يا بسبس، نطريني! خلّنا نلعب.', scratch: 'لحظة، بحكّ راسي شوي!', dance: 'يلا، خلّنا نرقص شوي!', fly: 'شنو هذي؟ ذبابة! بمسكها.', jump: 'حاضر، نطّة حلوة لك!', walk: 'حاضر، بتمشّى شوي.', wave: 'هلا والله! شلونك؟', happy: 'وايد حلو، خلّنا نفرح!', typing: 'فتحت اللابتوب، جاهز أشتغل وياك.', rest: 'حاضر، باخذ راحة شوي.', sleep: 'تصبح على خير.', idle: 'حاضر، أنا موجود.', reset: 'ردّيت مكاني.', stop: 'حاضر، وقّفت الصوت.', roam_on: 'زين، بتحرّك من نفسي شوي.', roam_off: 'حاضر، وقّفت التجوّل.' },
	msa: { laugh: 'هاهاها! لا أستطيع التوقف عن الضحك!', cry: 'يا لها من دموع! أحتاج منديلًا!', plead: 'من أجلي، رجاءً! انظر إلى عينيّ!', chase: 'انتظريني أيتها القطة! لنلعب معًا.', scratch: 'لحظة، سأحكّ رأسي قليلًا.', dance: 'حسنًا، إليك رقصة صغيرة!', fly: 'هناك ذبابة! سأحاول الإمساك بها.', jump: 'حسنًا، سأقفز الآن.', walk: 'حسنًا، سأمشي قليلًا.', wave: 'مرحبًا بك! يسعدني لقاؤك.', happy: 'رائع، لنحتفل معًا!', typing: 'فتحت الحاسوب، وأنا جاهز للعمل معك.', rest: 'حسنًا، سأستريح قليلًا.', sleep: 'تصبح على خير.', idle: 'حسنًا، أنا بانتظارك.', reset: 'عدت إلى مكاني.', stop: 'حسنًا، أوقفت الصوت.', roam_on: 'حسنًا، سأتحرك تلقائيًا.', roam_off: 'أوقفت التجوّل التلقائي.' },
	english: { laugh: 'Hahaha! I cannot stop giggling!', cry: 'Oh no, cartoon waterfalls! Tissues, please!', plead: 'Pretty please? Look at these kitten eyes!', chase: 'Wait for me, kitty! Let us play.', scratch: 'One second, a little head scratch!', dance: 'Here comes my little dance!', fly: 'A fly! Let me catch it.', jump: 'Sure! Here comes a little jump.', walk: 'Sure, I will take a short walk.', wave: 'Hello there! Good to see you.', happy: 'Wonderful! Let us celebrate.', typing: 'Laptop open. Ready to work with you!', rest: 'Time for a little break.', sleep: 'Good night!', idle: 'Sure, I am here when you need me.', reset: 'Back in my spot.', stop: 'Okay, audio stopped.', roam_on: 'Sure, I will wander around a little.', roam_off: 'Automatic wandering is off.' },
};

export function acknowledge(action: BeboAction, dialect: BeboDialect): string {
	return ACKNOWLEDGEMENTS[dialect]?.[action] || ACKNOWLEDGEMENTS.egyptian[action] || '';
}
