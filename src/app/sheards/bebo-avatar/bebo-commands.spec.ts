import { BEBO_ACTIONS, BEBO_DIALECTS, BEBO_VOICES, acknowledge, chooseDialect, commandFor, normalize } from './bebo-commands';
import { BEBO_POSES } from './bebo-loader';

// Local Bebo command routing (port of the Bebo v4 handoff bebo-core.mjs).

describe('Bebo local commands (handoff commandFor)', () => {
	it('known Arabic commands map to their handoff action', () => {
		expect(commandFor('ارقص')).toBe('dance');
		expect(commandFor('انط')).toBe('jump');
		expect(commandFor('سلم عليا')).toBe('wave');
		expect(commandFor('عيط')).toBe('cry');
		expect(commandFor('نام')).toBe('sleep');
		expect(commandFor('ارجع مكانك')).toBe('reset');
		expect(commandFor('افتح اللاب')).toBe('typing');
		expect(commandFor('اسكت')).toBe('stop');
	});

	it('known English commands map too (case/punctuation-insensitive)', () => {
		expect(commandFor('Dance!')).toBe('dance');
		expect(commandFor('wave hello')).toBe('wave');
		expect(commandFor('JUMP')).toBe('jump');
		expect(commandFor('go home')).toBe('reset');
	});

	it('Bebo name / politeness prefixes and Arabic spelling variants are tolerated', () => {
		expect(commandFor('يا بيبو ارقص')).toBe('dance');
		expect(commandFor('بيبو، انط')).toBe('jump');
		expect(commandFor('لو سمحت ارقص')).toBe('dance');
		expect(commandFor('please dance')).toBe('dance');
		expect(commandFor('اضحك!!')).toBe('laugh');
		expect(commandFor('إرقص')).toBe('dance'); // hamza normalized
	});

	it('platform questions and non-exact phrases are NOT commands (never hijacked)', () => {
		for (const q of [
			'ازاي أعمل مشروع؟',
			'كيف يعمل حساب الضمان؟',
			'ارقص معايا في المشروع ده ازاي',
			'how do I stop a project?',
			'اكتب لي وصف مشروع',
			'امشي في خطوات السحب',
			'What is Waseet?',
			'',
		]) {
			expect(commandFor(q)).toBeNull();
		}
	});

	it('negations are never commands', () => {
		expect(commandFor('لا ترقص')).toBeNull();
		expect(commandFor("don't dance")).toBeNull();
		expect(commandFor('ما تنطش')).toBeNull();
	});

	it('overlong input is never a command', () => {
		expect(commandFor('ارقص '.repeat(40))).toBeNull();
	});

	it('every command action except reset/stop/roam is a real Bebo pose', () => {
		for (const a of BEBO_ACTIONS) {
			if (['reset', 'stop', 'roam_on', 'roam_off'].includes(a)) continue;
			expect(BEBO_POSES as readonly string[]).toContain(a);
		}
	});

	it('acknowledgements follow the dialect, falling back to Egyptian', () => {
		expect(acknowledge('dance', 'egyptian')).toBe('على واحدة ونص! شوف الرقصة دي.');
		expect(acknowledge('dance', 'english')).toBe('Here comes my little dance!');
		expect(acknowledge('wave', 'saudi')).toBe('يا هلا والله! حيّاك.');
	});
});

describe('Bebo dialects / voices (handoff lists)', () => {
	it('dialects and their recognition languages are exactly the handoff DIALECTS', () => {
		expect(Object.fromEntries(Object.entries(BEBO_DIALECTS).map(([k, v]) => [k, v.language]))).toEqual({
			egyptian: 'ar-EG', saudi: 'ar-SA', gulf: 'ar-KW', msa: 'ar-SA', english: 'en-US',
		});
	});

	it('voices are exactly the handoff list (8 Gemini voices)', () => {
		expect([...BEBO_VOICES]).toEqual(['Puck', 'Kore', 'Fenrir', 'Aoede', 'Zephyr', 'Sulafat', 'Charon', 'Leda']);
	});

	it('chooseDialect: explicit choice wins; otherwise detects from vocabulary / script; else keeps previous', () => {
		expect(chooseDialect('ايه ده', 'msa')).toBe('msa');
		expect(chooseDialect('عايز اعرف ازاي')).toBe('egyptian');
		expect(chooseDialect('وش الحين')).toBe('saudi');
		expect(chooseDialect('شلونك')).toBe('gulf');
		expect(chooseDialect('كيف يمكنني')).toBe('msa');
		expect(chooseDialect('How does escrow work')).toBe('english');
		expect(chooseDialect('الضمان', 'auto', 'gulf')).toBe('gulf');
	});

	it('normalize strips diacritics/punctuation and unifies alef/ya forms', () => {
		expect(normalize('  أَهْلاً، يا بيبو!! ')).toBe('اهلا يا بيبو');
		expect(normalize('مستشفى')).toBe('مستشفي');
	});

	it('long-tail handoff phrases are recognised', () => {
		expect(commandFor('اجري ورا قطة بتجري')).toBe('chase');
		expect(commandFor('صعب عليا نفسك')).toBe('plead');
		expect(commandFor('stand still')).toBe('idle');
		expect(commandFor('stop roaming')).toBe('roam_off');
		expect(commandFor('كل الدبانة')).toBe('fly');
	});
});
