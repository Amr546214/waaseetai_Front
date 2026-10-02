/* Bebo standalone browser build: no credentials, no local server. */
(()=>{

const DIALECTS = {
  egyptian:{label:'مصري',language:'ar-EG',prompt:'العامية المصرية الطبيعية'},
  saudi:{label:'سعودي',language:'ar-SA',prompt:'اللهجة السعودية الطبيعية'},
  gulf:{label:'خليجي',language:'ar-KW',prompt:'اللهجة الخليجية الطبيعية'},
  msa:{label:'فصحى',language:'ar-SA',prompt:'العربية الفصحى المعاصرة'},
  english:{label:'English',language:'en-US',prompt:'natural English'}
};
const ACTIONS = new Set(['jump','walk','wave','happy','typing','rest','sleep','idle','reset','stop','roam_on','roam_off','scratch','dance','fly','laugh','cry','plead','chase']);
function normalize(text){
  return String(text||'').toLowerCase().replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
}
function chooseDialect(text,requested='auto',previous='egyptian'){
  if(Object.hasOwn(DIALECTS,requested))return {dialect:requested,source:'selected'};
  const t=normalize(text);
  const latin=(t.match(/[a-z]/g)||[]).length,arabic=(t.match(/[\u0600-\u06ff]/g)||[]).length;
  if(latin>4&&latin>arabic*1.5)return {dialect:'english',source:'detected'};
  const tokens=new Set(t.split(' '));
  const vocab={
    egyptian:['ايه','ليه','كدة','ده','دي','ازيك','عايز','عاوزه','عايزة','ازاي','كده','دلوقتي','بص','بتاع','يلا','عامل','انط','امشي'],
    saudi:['وش','ابغي','ابي','الحين','كيفك','حياك','تبي','تقدر','عساك'],
    gulf:['شلونك','شلون','وايد','هلا','هني','شخبارك','شنو','زين','جذي'],
    msa:['اريد','كيف','مرحبا','يمكنني','استطيع','رجاء','يرجي','اشرح']
  };
  const scores=Object.entries(vocab).map(([id,words])=>[id,words.filter(w=>tokens.has(w)).length]).sort((a,b)=>b[1]-a[1]);
  if(scores[0][1]>0&&scores[0][1]>(scores[1]?.[1]||0))return {dialect:scores[0][0],source:'detected'};
  return {dialect:Object.hasOwn(DIALECTS,previous)?previous:'egyptian',source:'previous'};
}
function commandFor(text){
  let t=normalize(text).replace(/^(يا\s+)?(بيبو|bebo)\s+/,'').replace(/^(من فضلك|لو سمحت|ممكن|please)\s+/,'').trim();
  if(t.length>100||/^(لا|مت|ما|dont|do not|don't)\b/.test(t))return null;
  const groups={
    stop:['اسكت','اخرس','وقف الصوت','اوقف الصوت','كفاية كلام','بس خلاص','stop talking','be quiet','stop'],
    reset:['ارجع مكانك','ارجع لمكانك','ارجع مكانك تاني','reset','go home'],
    roam_on:['اتحرك لوحدك','اتحرك من نفسك','تحرك من نفسك','wander','roam'],
    roam_off:['بطل تتحرك لوحدك','وقف التجول','stop roaming'],
    jump:['انط','نط','اقفز','انط كده','يلا انط','jump','hop'],
    walk:['امشي','اتمشي','تمشي','تحرك','امش','امشي شوية','walk','take a walk'],
    wave:['سلم','سلم عليا','سلم علي','لوح','قول هاي','wave','wave hello'],
    happy:['افرح','احتفل','celebrate','be happy'],
    dance:['ارقص','ارقصلي','ارقص لي','يلا ارقص','dance','dance for me'],
    scratch:['اهرش','هرش','اهرش راسك','هرش راسك','حك راسك','احك راسك','scratch','scratch your head'],
    fly:['دبانة','دبانه','طلع دبانة','طلع دبانه','هات دبانة','هات دبانه','كل الدبانة','كل الدبانه','امسك الدبانة','امسك الدبانه','catch a fly','eat the fly'],
    laugh:['اضحك','اضحك جامد','اضحك اوي','ضحك','ضحكة','ضحكه','هاهاها','laugh','laugh hard'],
    cry:['عيط','عيط جامد','عيط اوي','اعيط','ابكي','ابك','ابكي جامد','cry','cry hard'],
    plead:['صعبنيات','صعبانيات','اعمل صعبنيات','اعمل صعبانيات','اعمل صعبانيات زي القطط','اعمل حركة صعبنيات زي القطط','صعبنيات زي القطط','صعبانيات زي القطط','اعمل عيون قطط','عيون قطط','عيون قطة','عيون قطه','اتدلع','صعب عليا نفسك','beg','puppy eyes','kitten eyes'],
    chase:['اجري ورا القطة','اجري ورا القطه','اجري ورا قطة','اجري ورا قطة بتجري','اجري ورا قطه','اجري وراء القطة','اجري ورا البسة','العب مع القطة','العب مع القطه','طارد القطة','طارد القطه','هات القطة','هات القطه','chase the cat','chase a cat','play with the cat'],
    typing:['افتح اللاب','افتح اللابتوب','امسك اللاب','اكتب','اشتغل','افتح اللاب واكتب','type','start typing'],
    rest:['اقعد','ارتاح','استريح','sit','rest'],
    sleep:['نام','روح نام','sleep'],
    idle:['استني','قف','وقف الحركة','توقف','wait','stand still']
  };
  for(const [action,phrases]of Object.entries(groups))if(phrases.includes(t))return action;
  return null;
}
const acknowledgements={
  egyptian:{laugh:'هاهاها! مش قادر أمسك نفسي!',cry:'دموعي بقت شلّال! هاتوا المناديل!',plead:'طب علشاني أنا؟ بصّ للعيون دي!',chase:'يا بسبس، استنيني! نلعب استغماية؟',scratch:'ثانية، فيه حاجة بتقرّصني!',dance:'على واحدة ونص! شوف الرقصة دي.',fly:'إيه ده؟ دبّانة! تعالي هنا…',jump:'حاضر، نطّة حلوة ليك!',walk:'حاضر، هتمشّى شوية.',wave:'أهلًا بيك! نورتني.',happy:'يا سلام! خلّينا نفرح سوا.',typing:'فتحت اللابتوب، جاهز أشتغل معاك.',rest:'حاضر، استراحة صغيرة.',sleep:'تصبح على خير، هنام شوية.',idle:'حاضر، مستني معاك.',reset:'رجعت لمكاني.',stop:'حاضر، وقّفت الصوت.',roam_on:'تمام، هتحرّك من نفسي شوية.',roam_off:'تمام، وقّفت التجوّل.'},
  saudi:{laugh:'هههه! ما قدرت أمسك ضحكتي!',cry:'دموعي صارت شلّال! وين المناديل؟',plead:'تكفى، شوف هالعيون!',chase:'يا بسبس، انتظريني! خلّنا نلعب.',scratch:'لحظة، أحكّ راسي شوي!',dance:'أبشر، هذي رقصة لك!',fly:'وش هذي؟ ذبابة! خلّني أمسكها.',jump:'أبشر، هذي نطّة لك!',walk:'أبشر، بتمشّى شوي.',wave:'يا هلا والله! حيّاك.',happy:'يا سلام، خلّنا نحتفل!',typing:'أبشر، فتحت اللابتوب وجاهز أشتغل معك.',rest:'تمام، باخذ لي راحة.',sleep:'تصبح على خير.',idle:'أبشر، أنا بانتظارك.',reset:'رجعت مكاني.',stop:'أبشر، وقّفت الصوت.',roam_on:'أبشر، بتحرّك من نفسي شوي.',roam_off:'تمام، وقّفت التجوّل.'},
  gulf:{laugh:'هههه! وايد تضحّك!',cry:'دموعي صارت شلّال! وين المناديل؟',plead:'عشاني أنا، شوف هالعيون!',chase:'يا بسبس، نطريني! خلّنا نلعب.',scratch:'لحظة، بحكّ راسي شوي!',dance:'يلا، خلّنا نرقص شوي!',fly:'شنو هذي؟ ذبابة! بمسكها.',jump:'حاضر، نطّة حلوة لك!',walk:'حاضر، بتمشّى شوي.',wave:'هلا والله! شلونك؟',happy:'وايد حلو، خلّنا نفرح!',typing:'فتحت اللابتوب، جاهز أشتغل وياك.',rest:'حاضر، باخذ راحة شوي.',sleep:'تصبح على خير.',idle:'حاضر، أنا موجود.',reset:'ردّيت مكاني.',stop:'حاضر، وقّفت الصوت.',roam_on:'زين، بتحرّك من نفسي شوي.',roam_off:'حاضر، وقّفت التجوّل.'},
  msa:{laugh:'هاهاها! لا أستطيع التوقف عن الضحك!',cry:'يا لها من دموع! أحتاج منديلًا!',plead:'من أجلي، رجاءً! انظر إلى عينيّ!',chase:'انتظريني أيتها القطة! لنلعب معًا.',scratch:'لحظة، سأحكّ رأسي قليلًا.',dance:'حسنًا، إليك رقصة صغيرة!',fly:'هناك ذبابة! سأحاول الإمساك بها.',jump:'حسنًا، سأقفز الآن.',walk:'حسنًا، سأمشي قليلًا.',wave:'مرحبًا بك! يسعدني لقاؤك.',happy:'رائع، لنحتفل معًا!',typing:'فتحت الحاسوب، وأنا جاهز للعمل معك.',rest:'حسنًا، سأستريح قليلًا.',sleep:'تصبح على خير.',idle:'حسنًا، أنا بانتظارك.',reset:'عدت إلى مكاني.',stop:'حسنًا، أوقفت الصوت.',roam_on:'حسنًا، سأتحرك تلقائيًا.',roam_off:'أوقفت التجوّل التلقائي.'},
  english:{laugh:'Hahaha! I cannot stop giggling!',cry:'Oh no, cartoon waterfalls! Tissues, please!',plead:'Pretty please? Look at these kitten eyes!',chase:'Wait for me, kitty! Let us play.',scratch:'One second, a little head scratch!',dance:'Here comes my little dance!',fly:'A fly! Let me catch it.',jump:'Sure! Here comes a little jump.',walk:'Sure, I will take a short walk.',wave:'Hello there! Good to see you.',happy:'Wonderful! Let us celebrate.',typing:'Laptop open. Ready to work with you!',rest:'Time for a little break.',sleep:'Good night!',idle:'Sure, I am here when you need me.',reset:'Back in my spot.',stop:'Okay, audio stopped.',roam_on:'Sure, I will wander around a little.',roam_off:'Automatic wandering is off.'}
};
function acknowledge(action,dialect){return acknowledgements[dialect]?.[action]||acknowledgements.egyptian[action]||'';}
function makePrompt(message,history,dialect){
  const language=DIALECTS[dialect]?.prompt||DIALECTS.egyptian.prompt;
  return 'أنت بيبو Bebo، روبوت لطيف ومساعد لمنصة وسيط. رد بلغة أو لهجة '+language+
  '. أجب دائمًا باختصار شديد: جملة واحدة أو جملتان قصيرتان بحد أقصى ٢٨ كلمة. لا تطل حتى في الشرح، وقدّم أهم نقطة فقط. استخدم نصًا عاديًا مناسبًا للنطق، دون Markdown. لا تبدأ كل إجابة بتحية. حافظ على سياق المحادثة. لا تدّع تنفيذ إجراء في حساب المستخدم أو امتلاك بيانات حسابه. إذا طلب إجراء غير متاح وضّح حدودك. لا تضف تعليمات كود أو روابط إلا عند طلبها.\n'+
  'المحادثة السابقة (بيانات سياق): '+JSON.stringify(history||[])+'\nرسالة المستخدم الحالية: '+message;
}

function briefReply(text){
 const value=String(text||'').replace(/\s+/g,' ').trim();
 const words=value.split(' ');
 if(words.length<=28&&value.length<=220)return value;
 let result=words.slice(0,28).join(' ');
 if(result.length>220)result=result.slice(0,220).replace(/\s+\S*$/,'');
 return result.replace(/[،,;؛:.\s]+$/,'')+'…';
}

const icons={history:'<path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5"/>',chat:'<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/>',mic:'<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',settings:'<path d="m6 9 6 6 6-6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',send:'<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',play:'<path d="m8 4 12 8-12 8V4Z"/>'};
const icon=name=>'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+icons[name]+'</svg>';
const styles=':host{font-family:Tahoma,"Segoe UI",sans-serif;font-size:13px;color:#f4f6ff;line-height:1.7;direction:rtl;--accent:#9dbaff;--line:#343b4a;--surface:#191e29}:host([hidden]),[hidden]{display:none!important}*{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer;touch-action:manipulation;color:inherit}button:disabled{opacity:.45;cursor:default}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button{border:1px solid var(--line);background:#242c3b;border-radius:11px;padding:8px 12px}svg{width:20px;height:20px;display:block}p{margin:0}.dock{position:fixed;left:12px;bottom:12px;z-index:1002;display:flex;align-items:center;background:#20242bf2;border:1px solid #ffffff21;border-radius:30px;padding:4px 7px;gap:2px;box-shadow:0 6px 22px #0003;direction:ltr;backdrop-filter:blur(12px)}.dock button{border:0;background:none;border-radius:20px;padding:9px}.dock button:hover,.icon:hover{background:#ffffff13}.dock .divider{height:18px;border-left:1px solid #ffffff25;margin:0 2px}.panel{position:fixed;left:16px;bottom:166px;z-index:1003;width:min(400px,calc(100vw - 24px));height:min(600px,calc(100dvh - 184px));min-height:260px;display:flex;flex-direction:column;background:var(--surface);border:1px solid #46516a;border-radius:22px;box-shadow:0 24px 90px #0007;overflow:hidden}.head{display:flex;align-items:center;gap:10px;padding:17px 18px 12px;border-bottom:1px solid var(--line);background:linear-gradient(130deg,#29324a,#1b2230)}.avatar{width:36px;height:36px;border:1px solid #7395eb;border-radius:12px;display:grid;place-items:center;color:#a9c9ff;font:19px monospace;background:#111a31;direction:ltr}.title{flex:1}.title b{font-size:15px}.subtitle{display:block;font-size:10px;color:#b7c2d9}.icon{border:0;background:none;padding:7px;border-radius:9px}.status-row{display:flex;gap:7px;align-items:center;padding:9px 18px;color:#adbdd9;font-size:10px;min-height:34px}.dot{width:6px;height:6px;border-radius:50%;background:#9bcfbb;flex-shrink:0}:host([data-mode="listening"]) .dot{background:#ffadbc;box-shadow:0 0 0 4px #ffadbc16}:host([data-mode="speaking"]) .dot{background:#a2baff;animation:pulse .75s ease-in-out infinite}.log{flex:1;min-height:55px;overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:12px;padding:8px 16px 16px;scrollbar-width:thin}.message{max-width:93%;padding:11px 13px;border:1px solid var(--line);border-radius:14px 14px 4px 14px;white-space:pre-wrap;overflow-wrap:anywhere;background:#242d40;align-self:flex-start;line-height:1.8}.message.user{background:#38558b;border-color:#46669e;border-radius:14px 14px 14px 4px;align-self:flex-end}.message .who{display:block;font-size:9px;letter-spacing:.3px;color:#c0cce1;margin-bottom:4px}.welcome{color:#b5bfd4;font-size:12px;padding:4px 2px 10px;line-height:1.9}.welcome b{color:#f4f6ff;display:block;font-size:15px;margin-bottom:6px}.examples{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.examples button{font-size:11px;padding:5px 9px;background:transparent}.settings{padding:12px 16px;background:#121925;border-bottom:1px solid var(--line);display:grid;grid-template-columns:1fr 1fr;gap:10px}label{font-size:10px;color:#b4bfd5;display:grid;gap:4px}select{width:100%;min-width:0;padding:6px 7px;background:#202a3c;border:1px solid var(--line);border-radius:8px;color:#edf3ff;font-size:11px}.notice{margin:0 14px 8px;font-size:11px;color:#ffcfa2;line-height:1.7;overflow-wrap:anywhere}.audio-row{display:flex;gap:6px;padding:0 15px 9px;align-items:center}.audio-row button{font-size:10px;display:flex;align-items:center;gap:6px;padding:5px 9px}.audio-row svg{width:14px;height:14px}.audio-row .stop{margin-inline-start:auto}.composer{display:flex;align-items:center;gap:6px;margin:0 12px 9px;padding:6px;background:#101722;border:1px solid #3a4863;border-radius:14px}.composer input{flex:1;min-width:0;border:0;background:none;color:#edf3ff;padding:7px 4px;outline-offset:0;font-size:12px}.send{background:#9dbaff;color:#152446;border:0;padding:8px}.mic{border:0;background:none;padding:8px}.mic[aria-pressed="true"],.dock button[aria-pressed="true"]{color:#ffb1c1;background:#aa344425}.foot{padding:0 15px 11px;font-size:9px;color:#8e9bb2;display:flex;justify-content:space-between;gap:7px}.link{border:0;background:none;padding:0;color:#b0c6fa;font-size:9px}@keyframes pulse{50%{box-shadow:0 0 0 5px #9dbaff20}}@media(max-width:480px){.panel{left:12px;bottom:155px;height:calc(100dvh - 172px);border-radius:17px}.head{padding:12px 14px}.settings{padding:9px 12px}.message{font-size:12px}.log{gap:9px}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}';

const compactStyles='.dock{gap:0;padding:3px 5px}.dock button{padding:8px}.dock svg{width:17px;height:17px}.input-wrap{position:fixed;left:8px;bottom:12px;width:min(330px,calc(100vw - 16px));z-index:1002}.composer{margin:0;padding:5px 7px;min-height:45px;border-radius:28px;background:#1f2228ed;border-color:#ffffff29;box-shadow:0 5px 20px #0003;backdrop-filter:blur(16px)}.composer input{font-size:12px;padding:5px;line-height:1.5}.composer .send{border-radius:50%;padding:6px;background:#91b6f0}.composer .send svg{width:16px;height:16px}.composer .mic{padding:6px}.composer .mic svg{width:17px;height:17px}.foot{font-size:9px;padding:4px 13px 0;color:#a9b5cc}.popup{position:fixed;left:8px;bottom:220px;width:min(310px,calc(100vw - 16px));z-index:1002;background:linear-gradient(140deg,#282d37f8,#1f2228f5);border:1px solid #ffffff32;border-radius:19px;box-shadow:0 12px 35px #0004;padding:12px 15px;backdrop-filter:blur(16px)}.popup:after{content:"";position:absolute;bottom:-6px;left:var(--tail,45px);width:10px;height:10px;transform:rotate(45deg);background:#202329;border-right:1px solid #ffffff32;border-bottom:1px solid #ffffff32}.popup.below:after{bottom:auto;top:-6px;transform:rotate(225deg)}.say{font-size:13px;line-height:1.85;padding-inline-end:2px;overflow-wrap:anywhere;white-space:pre-wrap}.popup .status-row{padding:0 0 5px;min-height:0;font-size:9px;color:#a6b4d1}.popup .notice{margin:7px 0 0;font-size:11px}.popup .audio-row{padding:8px 0 0;min-height:0}.popup .audio-row:has(button:not([hidden])){display:flex}.popup .audio-row:not(:has(button:not([hidden]))){display:none}.audio-row button{border:0;background:#ffffff0b;font-size:10px;padding:4px 8px;border-radius:15px}.dismiss{position:absolute;left:6px;top:5px;padding:5px;background:none;border:0;color:#a8b1c1}.dismiss svg{width:12px;height:12px}.settings{position:fixed;width:min(330px,calc(100vw - 16px));left:8px;bottom:220px;z-index:1004;border:1px solid #4a5266;border-radius:17px;box-shadow:0 12px 40px #0005;background:#202631}.settings-hint{grid-column:1/-1;font-size:9px;color:#aab8d1}.panel{left:12px;bottom:186px;width:min(390px,calc(100vw - 24px));height:min(540px,calc(100dvh - 202px));min-height:200px;z-index:1005}.history-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid var(--line);padding:12px 16px;color:#93a1ba;font-size:9px}.head{padding:14px 16px}.log{padding-top:16px}.welcome b{font-size:14px}@media(max-width:480px){.panel{bottom:186px;height:calc(100dvh - 202px)}.popup{font-size:12px}.say{font-size:12px}.input-wrap{width:min(330px,calc(100vw - 16px))}}@media(max-height:450px){.panel{bottom:85px;height:calc(100dvh - 100px);min-height:140px}}';

class BeboChat extends HTMLElement{
 constructor(){
  super();this.attachShadow({mode:'open'});this.history=[];this.lastDialect='egyptian';this.sequence=0;this._mode='idle';
  this.shadowRoot.innerHTML='<style>'+styles+compactStyles+'</style>'+
  '<div class="dock" aria-label="محادثة بيبو"><button id="open" aria-label="اكتب لبيبو" aria-expanded="true">'+icon('chat')+'</button><span class="divider"></span><button id="dock-mic" aria-label="اتكلم مع بيبو" aria-pressed="false">'+icon('mic')+'</button><button id="history-open" aria-label="المحادثة كاملة" aria-expanded="false">'+icon('history')+'</button><button id="dock-settings" aria-label="إعدادات الصوت واللهجة" aria-expanded="false">'+icon('settings')+'</button></div>'+
  '<section class="popup" aria-label="رد بيبو"><button id="dismiss-bubble" class="dismiss" aria-label="إخفاء السحابة">'+icon('close')+'</button><div class="status-row" role="status"><span class="dot"></span><span id="status">بيبو معاك</span></div><p class="say" dir="auto" aria-live="polite">أهلًا! اكتب لي تحت، أو اضغط المايك وكلّمني.</p><p class="notice" role="status" hidden></p><div class="audio-row"><button id="replay" hidden>'+icon('play')+'<span>اسمع الرد</span></button><button id="stop" class="stop" hidden>'+icon('stop')+'إيقاف</button></div></section>'+
  '<div class="input-wrap"><form class="composer"><button type="button" id="mic" class="mic" aria-label="ابدأ التسجيل الصوتي" aria-pressed="false">'+icon('mic')+'</button><input id="message" aria-label="رسالتك لبيبو" maxlength="2000" placeholder="اكتب لبيبو…" autocomplete="off" dir="auto"><button class="send" type="submit" aria-label="ابعت الرسالة">'+icon('send')+'</button></form><div class="foot"><span id="dialect-note">مصري · تلقائي</span><span>Enter ↵</span></div></div>'+
  '<div class="settings" hidden><label>اللهجة<select id="dialect"><option value="auto">تلقائي من كلامك</option>'+Object.entries(DIALECTS).map(([id,d])=>'<option value="'+id+'">'+d.label+'</option>').join('')+'</select></label><label>الصوت<select id="voice">'+['Puck','Kore','Fenrir','Aoede','Zephyr','Sulafat','Charon','Leda'].map(v=>'<option>'+v+'</option>').join('')+'</select></label><label>طريقة الرد<select id="output"><option value="audio">صوت وكتابة</option><option value="text">كتابة بس</option></select></label><label>جودة الصوت<select id="model"><option value="gemini-3.8-flash-lite-tts">Flash-Lite · سريع</option><option value="gemini-3.8-flash-tts">Flash · جودة أعلى</option></select></label><p class="settings-hint">لتفريغ الكلام الإنجليزي، اختار English قبل المايك.</p></div>'+
  '<section class="panel" role="region" aria-label="المحادثة كاملة" hidden><header class="head"><span class="avatar" aria-hidden="true">&gt;_</span><div class="title"><b>المحادثة كاملة</b><span class="subtitle">كل كلامك مع بيبو في مكان واحد</span></div><button id="close" class="icon" aria-label="اقفل سجل المحادثة">'+icon('close')+'</button></header><div class="log" role="log" aria-live="off"><div class="welcome"><b>أهلًا، أنا بيبو 👋</b>ردودي قصيرة وتظهر في السحابة. هنا تقدر ترجع لكل الرسائل.<div class="examples"><button data-command="انط">انط ↑</button><button data-command="افتح اللاب">افتح اللاب ⌨</button><button data-command="عرّفني بنفسك">عرّفني بنفسك</button></div></div></div><div class="history-foot"><button class="link" id="clear">مسح المحادثة</button><span>السجل داخل الجلسة الحالية</span></div></section>';
  this.$=s=>this.shadowRoot.querySelector(s);
  this.$('#open').onclick=()=>this.toggleComposer();this.$('#history-open').onclick=()=>this.$('.panel').hidden?this.showHistory():this.close();this.$('#dismiss-bubble').onclick=()=>{this.stop();this.$('.popup').hidden=true;};this.$('#close').onclick=()=>this.close();
  this.$('#dock-settings').onclick=()=>this.settings();
  this.$('#dock-mic').onclick=this.$('#mic').onclick=()=>this.listen();
  this.$('#stop').onclick=()=>this.stop();this.$('#clear').onclick=()=>this.clear();this.$('#replay').onclick=()=>this.replay();
  this.$('form').onsubmit=e=>{e.preventDefault();this.send();};
  this.shadowRoot.querySelectorAll('[data-command]').forEach(b=>b.onclick=()=>this.send(b.dataset.command));
  this.shadowRoot.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();this.close();}});
  for(const id of ['dialect','voice','output','model'])this.$('#'+id).onchange=()=>{
   this.stop();this.savePreferences();this.dialectNote();if(['voice','model'].includes(id))this.releaseAudio();this.$('#replay').hidden=!this.lastReply||this.$('#output').value==='text'||this.lastReply.action==='stop';
  };
  this._place=()=>this.positionDock();this._hidden=()=>{if(document.hidden)this.stop();};
 }
 connectedCallback(){
  try{const prefs=JSON.parse(localStorage.getItem('bebo.preferences')||'{}');for(const id of ['dialect','voice','output','model'])if([...this.$('#'+id).options].some(o=>o.value===prefs[id]))this.$('#'+id).value=prefs[id];}catch{}
  this.Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!this.Recognition)for(const id of ['mic','dock-mic'])this.$('#'+id).title='الإملاء الصوتي غير متاح هنا؛ جرّب Chrome أو Edge.';
  this.robot=this.getAttribute('robot')?document.querySelector(this.getAttribute('robot')):null;
  this.robot?.addEventListener('robotmove',this._place);
  window.addEventListener('resize',this._place);document.addEventListener('visibilitychange',this._hidden);
  this.positionDock();this.dialectNote();this.checkStatus();
  this.bubbleSizeObserver=new ResizeObserver(()=>this.positionDock());for(const selector of ['.popup','.settings','.input-wrap'])this.bubbleSizeObserver.observe(this.$(selector));
 }
 disconnectedCallback(){this.bubbleSizeObserver?.disconnect();this.stop();this.robot?.removeEventListener('robotmove',this._place);window.removeEventListener('resize',this._place);document.removeEventListener('visibilitychange',this._hidden);this.releaseAudio();this.audioContext?.close().catch(()=>{});}
 get robots(){return [...document.querySelectorAll(this.getAttribute('robots')||this.getAttribute('robot')||'cute-robot')];}
 get api(){return (this.getAttribute('api-base')||'https://waseet-ai-api-1041761245251.us-central1.run.app/v1/bebo').replace(/\/$/,'');}
 open(focus=true){
  this.$('.input-wrap').hidden=false;this.$('#open').setAttribute('aria-expanded','true');
  this.$('.panel').hidden=true;this.$('#history-open').setAttribute('aria-expanded','false');
  this.$('.popup').hidden=false;this.positionDock();if(focus)this.$('#message').focus();
 }
 toggleComposer(){if(this.$('.input-wrap').hidden)this.open();else{this.$('.input-wrap').hidden=true;this.$('#open').setAttribute('aria-expanded','false');if(this.recognizer)this.stop();}}
 showHistory(){this.$('.panel').hidden=false;this.$('#history-open').setAttribute('aria-expanded','true');this.$('.popup').hidden=true;this.$('.settings').hidden=true;this.$('#dock-settings').setAttribute('aria-expanded','false');this.$('.log').scrollTop=this.$('.log').scrollHeight;this.$('#close').focus();}
 close(){this.$('.panel').hidden=true;this.$('#history-open').setAttribute('aria-expanded','false');this.$('.popup').hidden=false;this.positionDock();this.$('#history-open').focus();}
 settings(force){
  const panel=this.$('.settings');panel.hidden=force===true?false:!panel.hidden;
  this.$('#dock-settings').setAttribute('aria-expanded',String(!panel.hidden));this.$('.popup').hidden=!panel.hidden;this.positionDock();
 }
 positionDock(){
  const rect=this.robot?.getBoundingClientRect();if(!rect)return;const middle=rect.left+rect.width/2;
  const dock=this.$('.dock'),width=dock.offsetWidth||150;
  dock.style.left=Math.max(8,Math.min(innerWidth-width-8,middle-width/2))+'px';
  dock.style.bottom=Math.max(8,innerHeight-rect.bottom-39)+'px';
  const input=this.$('.input-wrap'),inputWidth=input.offsetWidth||330;
  input.style.left=Math.max(8,Math.min(innerWidth-inputWidth-8,middle-inputWidth/2))+'px';
  input.style.bottom=Math.max(5,innerHeight-rect.bottom-101)+'px';
  for(const selector of ['.popup','.settings']){
   const box=this.$(selector);if(box.hidden)continue;const w=box.offsetWidth,h=box.offsetHeight;
   const left=Math.max(8,Math.min(innerWidth-w-8,middle-w/2));
   box.style.left=left+'px';box.style.setProperty('--tail',Math.max(16,Math.min(w-22,middle-left-5))+'px');
   const above=rect.top-h-7,below=rect.bottom+108;
   const top=above>=8?above:Math.min(innerHeight-h-8,below);
   box.style.top=Math.max(8,top)+'px';box.style.bottom='auto';box.classList.toggle('below',above<8);
  }
 }
 savePreferences(){try{localStorage.setItem('bebo.preferences',JSON.stringify(Object.fromEntries(['dialect','voice','output','model'].map(id=>[id,this.$('#'+id).value]))));}catch{}}
 dialectNote(){const selected=this.$('#dialect').value;this.$('#dialect-note').textContent=DIALECTS[selected==='auto'?this.lastDialect:selected].label+(selected==='auto'?' · تقدير تلقائي، تقدر تغيّره':' · باختيارك');}
 notice(message=''){this.$('.notice').textContent=message;this.$('.notice').hidden=!message;if(message)this.$('.popup').hidden=false;this.positionDock();}
 mode(mode,status){
  this._mode=mode;this.dataset.mode=mode;
  const say=this.$('.say');if(mode==='thinking')say.textContent='ثانية واحدة… بفكّر معاك.';else if(mode==='listening')say.textContent='بسمعك… قول لي أعمل إيه.';else if(this.lastReply)say.textContent=this.lastReply.text;else if(mode==='idle')say.textContent='أنا هنا… اكتب لي أو كلّمني.';
  if(mode!=='idle'&&this.$('.panel').hidden)this.$('.popup').hidden=false;this.positionDock();this.$('#status').textContent=status||({idle:'جاهز أسمعك',thinking:'بفكّر في ردّك…',loading:'بجهّز صوتي…',listening:'بسمعك… اتكلم دلوقتي',speaking:'بيبو بيتكلم…'}[mode]);
  this.$('#stop').hidden=mode==='idle';
  for(const id of ['mic','dock-mic'])this.$('#'+id).setAttribute('aria-pressed',String(mode==='listening'));
  if(['thinking','listening','speaking'].includes(mode))for(const robot of this.robots)robot.play(mode,{loop:true});
  if(mode==='idle')for(const robot of this.robots)if(['thinking','speaking','listening'].includes(robot.state))robot.play('idle');
  this.dispatchEvent(new CustomEvent('bebostatus',{detail:{mode,status:this.$('#status').textContent},bubbles:true}));
 }
 async checkStatus(){
  try{const r=await fetch(this.api+'/status');const d=await r.json();if(!r.ok||!d.configured)this.notice('تعذر الاتصال بخدمة بيبو. تأكد من الإنترنت؛ أوامر الحركة متاحة.');}
  catch{this.notice('شغّل المشروع بـ start.cmd عشان المحادثة والصوت يتصلوا بالخادم.');}
 }
 bubble(role,text){
  const div=document.createElement('div');div.className='message '+role;div.dir='auto';
  const label=document.createElement('span');label.className='who';label.textContent=role==='user'?'أنت':'بيبو';
  const content=document.createElement('span');content.textContent=text;div.append(label,content);this.$('.log').append(div);
  this.$('.log').scrollTop=this.$('.log').scrollHeight;
  if(role==='assistant'){this.$('.say').textContent=text;this.$('.popup').hidden=!this.$('.panel').hidden;this.positionDock();}
 }
 clear(){this.stop();this.history=[];this.lastReply=null;this.$('.say').textContent='نبدأ من جديد؟ أنا معاك.';this.releaseAudio();this.shadowRoot.querySelectorAll('.message').forEach(n=>n.remove());this.$('#replay').hidden=true;this.notice();}
 stop(){
  this.stopMeter();++this.sequence;this.controller?.abort();this.controller=null;
  if(this.recognizer){this.recognizer.onend=null;this.recognizer.onresult=null;this.recognizer.onerror=null;try{this.recognizer.abort();}catch{}this.recognizer=null;}
  if(this.audio){this.audio.onended=null;this.audio.onplaying=null;this.audio.onerror=null;this.audio.pause();}
  this.mode('idle');if(this.lastReply&&this.$('#output').value==='audio'&&this.lastReply.action!=='stop')this.$('#replay').hidden=false;
 }
 releaseAudio(){this.stopMeter();if(this.mediaGraph){this.mediaGraph.source.disconnect();this.mediaGraph.analyser.disconnect();this.mediaGraph=null;}if(this.audio){this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio.remove();this.audio=null;}if(this.audioURL){URL.revokeObjectURL(this.audioURL);this.audioURL=null;}}
 execute(action){
  if(!ACTIONS.has(action))return;
  for(const robot of this.robots){
   robot.paused=false;
   if(action==='roam_on'||action==='roam_off')robot.toggleAttribute('roam',action==='roam_on');
   else if(action==='reset')robot.resetPosition();
   else if(action==='stop'){if(['speaking','listening','thinking'].includes(robot.state))robot.play('idle');}
   else robot.play(action,{loop:['typing','sleep','rest','idle'].includes(action)});
  }
  this.dispatchEvent(new CustomEvent('bebocommand',{detail:{action},bubbles:true}));
 }
 async send(value){
  const message=(typeof value==='string'?value:this.$('#message').value).trim();
  if(!message)return;if(message.length>2000){this.notice('الرسالة طويلة. اختصرها لأقل من ٢٠٠٠ حرف.');return;}
  this.open(false);this.stop();this.warmAudio();this.releaseAudio();this.lastReply=null;this.notice();this.$('#replay').hidden=true;this.$('#message').value='';
  this.bubble('user',message);const prior=this.history.slice(-10);this.history.push({role:'user',content:message});this.history=this.history.slice(-20);
  const id=this.sequence;this.controller=new AbortController();
  const dialect=this.$('#dialect').value;const action=commandFor(message);
  try{
   let result;
   if(action){const chosen=chooseDialect(message,dialect,this.lastDialect);result={reply:acknowledge(action,chosen.dialect),action,dialect:chosen.dialect};}
   else{this.mode('thinking');const response=await fetch(this.api+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,history:prior,dialect,previousDialect:this.lastDialect}),signal:this.controller.signal});result=await this.json(response);}
   if(id!==this.sequence)return;
   if(typeof result.reply!=='string'||!result.reply.trim())throw new Error('ما وصلنيش رد واضح. جرّب تاني.');
   result.reply=briefReply(result.reply);this.mode('idle');this.lastDialect=Object.hasOwn(DIALECTS,result.dialect)?result.dialect:this.lastDialect;this.dialectNote();
   this.bubble('assistant',result.reply);this.history.push({role:'assistant',content:result.reply});this.history=this.history.slice(-20);
   this.lastReply={text:result.reply,dialect:this.lastDialect,action:ACTIONS.has(result.action)?result.action:null};
   if(this.lastReply.action)this.execute(this.lastReply.action);
   this.dispatchEvent(new CustomEvent('beboreply',{detail:{...this.lastReply},bubbles:true}));
   if(this.$('#output').value==='audio'&&result.action!=='stop')await this.speak(id);
  }catch(error){if(id!==this.sequence||error.name==='AbortError')return;this.mode('idle');this.notice(error.message||'حصلت مشكلة في الاتصال. جرّب تاني.');}
 }
 async json(response){let result;try{result=await response.json();}catch{throw new Error('الخادم غير متاح. شغّله بـ start.cmd.');}if(!response.ok)throw new Error(result.error?.message||'حصلت مشكلة في الخدمة.');return result;}
 warmAudio(){
  const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)return;
  try{if(!this.audioContext||this.audioContext.state==='closed')this.audioContext=new Context();this.audioContext.resume().catch(()=>{});}catch{}
 }
 startMeter(audio){
  this.stopMeter();
  if(!this.audioContext||this.audioContext.state!=='running')return;
  try{
   if(!this.mediaGraph||this.mediaGraph.audio!==audio){
    const source=this.audioContext.createMediaElementSource(audio),analyser=this.audioContext.createAnalyser();
    analyser.fftSize=512;source.connect(analyser);analyser.connect(this.audioContext.destination);
    this.mediaGraph={audio,source,analyser,data:new Float32Array(analyser.fftSize)};
   }
   const measure=()=>{
    if(this._mode!=='speaking'||audio.paused)return;
    const {analyser,data}=this.mediaGraph;analyser.getFloatTimeDomainData(data);
    let energy=0;for(const sample of data)energy+=sample*sample;
    const level=Math.min(1,Math.sqrt(energy/data.length)*7);
    for(const robot of this.robots)robot.setSpeechLevel?.(level);
    this.meterFrame=requestAnimationFrame(measure);
   };
   measure();
  }catch{for(const robot of this.robots)robot.setSpeechLevel?.(null);}
 }
 stopMeter(){cancelAnimationFrame(this.meterFrame);this.meterFrame=0;for(const robot of this.robots)robot.setSpeechLevel?.(null);}

 async speak(id=this.sequence){
  if(!this.lastReply)return;this.mode('loading');this.$('#replay').hidden=true;
  try{
   const response=await fetch(this.api+'/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:this.lastReply.text,dialect:this.lastReply.dialect,voice:this.$('#voice').value,model:this.$('#model').value}),signal:this.controller?.signal});
   if(!response.ok){await this.json(response);return;}
   const blob=await response.blob();if(id!==this.sequence)return;
   if(!blob.size||!blob.type.startsWith('audio/'))throw new Error('ملف الصوت غير صالح.');
   this.releaseAudio();this.audioURL=URL.createObjectURL(blob);this.audio=new Audio(this.audioURL);this.audio.hidden=true;this.shadowRoot.append(this.audio);await this.playAudio(id);
  }catch(error){if(id!==this.sequence||error.name==='AbortError')return;this.mode('idle');this.$('#replay').hidden=false;this.notice('الرد النصي موجود. تعذّر تجهيز الصوت: '+error.message);}
 }
 async playAudio(id=this.sequence){
  if(!this.audio)return;const audio=this.audio;
  audio.onplaying=()=>{if(id!==this.sequence)return;this.notice();if(this.lastReply?.action){this._mode='speaking';this.dataset.mode='speaking';this.$('#status').textContent='بيبو بيتكلم…';this.$('#stop').hidden=false;}else this.mode('speaking');this.startMeter(audio);this.positionDock();};
  audio.onended=()=>{if(id===this.sequence){this.stopMeter();this.mode('idle');this.$('#replay').hidden=false;}};
  audio.onerror=()=>{if(id===this.sequence){this.stopMeter();this.mode('idle');this.notice('المتصفح ما قدرش يشغّل الصوت. جرّب تسمعه تاني.');this.$('#replay').hidden=false;}};
  try{audio.currentTime=0;await audio.play();if(id!==this.sequence)audio.pause();}
  catch(error){if(id!==this.sequence)return;this.mode('idle');this.$('#replay').hidden=false;this.notice(error.name==='NotAllowedError'?'الصوت جاهز. اضغط «اسمع الرد» عشان المتصفح يسمح بتشغيله.':'تعذّر تشغيل الصوت. اضغط «اسمع الرد» للمحاولة.');}
 }
 async replay(){if(!this.lastReply)return;this.stop();this.warmAudio();this.notice();this.controller=new AbortController();const id=this.sequence;if(this.audio)await this.playAudio(id);else await this.speak(id);}
 listen(){
  this.open(false);if(this.recognizer){try{this.recognizer.stop();}catch{}return;}
  this.stop();this.warmAudio();this.notice();
  if(!this.Recognition){this.notice('التعرّف على الكلام مش مدعوم في المتصفح ده. افتح نفس الرابط في Chrome أو Edge، أو اكتب رسالتك.');return;}
  if(!window.isSecureContext){this.notice('المايك محتاج HTTPS أو localhost. الكتابة متاحة.');return;}
  const recog=new this.Recognition();this.recognizer=recog;const id=this.sequence;
  recog.lang=DIALECTS[this.$('#dialect').value==='auto'?this.lastDialect:this.$('#dialect').value].language;
  recog.continuous=false;recog.interimResults=true;recog.maxAlternatives=1;let finalText='',failed=false;
  recog.onstart=()=>{if(id===this.sequence)this.mode('listening');};
  recog.onresult=event=>{if(id!==this.sequence)return;let interim='';for(let i=event.resultIndex;i<event.results.length;i++){if(event.results[i].isFinal)finalText+=event.results[i][0].transcript+' ';else interim+=event.results[i][0].transcript;}this.$('#message').value=(finalText+interim).trim().slice(0,2000);this.$('.say').textContent=this.$('#message').value||'بسمعك…';this.positionDock();};
  recog.onerror=event=>{
   if(id!==this.sequence)return;failed=true;
   const errors={'not-allowed':'اسمح بالمايك من إعدادات المتصفح، وبعدها اضغط المايك تاني.','service-not-allowed':'خدمة التعرّف الصوتي غير متاحة هنا. جرّب Chrome أو Edge.','audio-capture':'مش لاقي مايك متاح. وصّله وجرّب تاني.','no-speech':'ما سمعتش كلام. اضغط المايك وجرّب تاني.','network':'خدمة التعرّف الصوتي محتاجة اتصال. تقدر تكتب رسالتك دلوقتي.','language-not-supported':'لغة الإملاء غير مدعومة في المتصفح. اختار لغة تانية أو اكتب رسالتك.'};
   this.notice(errors[event.error]||'التسجيل وقف. تقدر تجرّب تاني أو تكتب رسالتك.');
  };
  recog.onend=()=>{if(id!==this.sequence)return;this.recognizer=null;this.mode('idle');if(finalText.trim()&&!failed)this.send(finalText.trim());};
  try{this.mode('listening');recog.start();}catch{this.recognizer=null;this.mode('idle');this.notice('مش قادر أفتح المايك. جرّب تاني من متصفح بيدعم الإملاء.');}
 }
}
if(!customElements.get('bebo-chat'))customElements.define('bebo-chat',BeboChat);

})();
