import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { AssistantStore } from './assistant.store';
import { AuthStore } from './auth.store';
import { HelpAssistantSocketService, HelpStreamEvent } from '../services/help-assistant-socket.service';
import { SPEECH_RECOGNITION } from '../services/speech-recognition';

describe('AssistantStore multiple conversations and per-user persistence', () => {
	let store:AssistantStore;
	let saved:Map<string,string>;
	let request=0;
	let events:Subject<HelpStreamEvent>;
	let socket:any;
	const token=signal<string|null>('jwt-a');
	const user=signal<any>({id:'a',activeRole:'CLIENT',accountType:'CLIENT'});
	beforeEach(() => {
		saved=new Map(); request=0; events=new Subject<HelpStreamEvent>();
		token.set('jwt-a');user.set({id:'a',activeRole:'CLIENT',accountType:'CLIENT'});
		vi.stubGlobal('localStorage',{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value),removeItem:(key:string)=>saved.delete(key)});
		socket={events$:events.asObservable(),ask:vi.fn(()=>`r${++request}`),cancel:vi.fn(),disconnect:vi.fn()};
		TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthStore,useValue:{token,currentUser:user}},{provide:HelpAssistantSocketService,useValue:socket},{provide:SPEECH_RECOGNITION,useValue:null}]});
		store=TestBed.inject(AssistantStore);TestBed.tick();
	});
	afterEach(()=>vi.unstubAllGlobals());
	function answer(question:string,text:string) {
		store.ask(question);const id=`r${request}`;
		events.next({type:'start',clientRequestId:id});events.next({type:'chunk',clientRequestId:id,chunk:text});events.next({type:'complete',clientRequestId:id});TestBed.tick();
		return store.activeConversationId()!;
	}
	it('keeps separate histories and sends only the selected conversation to the real transport', () => {
		const first=answer('سؤال أ','إجابة أ');
		store.newConversation();const second=answer('سؤال ب','إجابة ب');
		expect(socket.ask.mock.calls[1][1]).toEqual([]);
		store.selectConversation(first);expect(store.messages()[0].text).toBe('سؤال أ');
		store.ask('متابعة أ');
		expect(socket.ask.mock.calls[2][1]).toEqual([{question:'سؤال أ',answer:'إجابة أ'}]);
		events.next({type:'chunk',clientRequestId:'r3',chunk:'جزئي'});
		store.selectConversation(second);
		expect(socket.cancel).toHaveBeenCalledWith('r3');
		events.next({type:'chunk',clientRequestId:'r3',chunk:'متأخر'});events.next({type:'complete',clientRequestId:'r3'});
		expect(store.messages().map(m=>m.text)).toEqual(['سؤال ب','إجابة ب']);
		expect(store.busy()).toBe(false);
	});
	it('reloads all old v1 turns, preserves them through an empty view, and restores selection', () => {
		TestBed.resetTestingModule();
		const messages=Array.from({length:7},(_,i)=>[{role:'user',text:`سؤال ${i}`},{role:'assistant',text:`رد ${i}`}]).flat();
		saved.set('waseet.bebo.session.a.CLIENT',JSON.stringify({version:1,updatedAt:Date.now()-30*86400_000,messages}));
		TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthStore,useValue:{token,currentUser:user}},{provide:HelpAssistantSocketService,useValue:socket},{provide:SPEECH_RECOGNITION,useValue:null}]});
		store=TestBed.inject(AssistantStore);TestBed.tick();
		expect(store.messages()).toHaveLength(14);expect(store.conversations()).toHaveLength(1);
		expect(JSON.parse(saved.get('waseet.bebo.session.a.CLIENT.legacy-v1')!).messages).toHaveLength(14);
		const id=store.activeConversationId()!;
		store.messages.set([]);TestBed.tick();expect(store.conversations()[0].messages).toHaveLength(14);
		expect(store.selectConversation(id)).toBe(true);expect(store.messages()).toHaveLength(14);
		expect(JSON.parse(saved.get('waseet.bebo.session.a.CLIENT')!).conversations[0].messages).toHaveLength(14);
	});
	it('restores each user and role independently after logout, another login, and token refresh', () => {
		answer('خاص أ','جواب أ');
		token.set('jwt-b');user.set({id:'b',activeRole:'CLIENT',accountType:'CLIENT'});TestBed.tick();
		expect(store.messages()).toEqual([]);answer('خاص ب','جواب ب');
		token.set(null);user.set(null);TestBed.tick();expect(store.conversations()).toEqual([]);
		token.set('jwt-a-new');user.set({id:'a',activeRole:'CLIENT',accountType:'CLIENT'});TestBed.tick();
		expect(store.messages().map(m=>m.text)).toEqual(['خاص أ','جواب أ']);
		user.set({id:'a',activeRole:'PROVIDER',accountType:'CLIENT'});TestBed.tick();expect(store.messages()).toEqual([]);
		answer('مقدم خدمة','جواب مقدم');
		user.set({id:'a',activeRole:'CLIENT',accountType:'CLIENT'});TestBed.tick();
		expect(store.messages().map(m=>m.text)).toEqual(['خاص أ','جواب أ']);
		token.set('jwt-a-refresh');TestBed.tick();expect(store.messages()[0].text).toBe('خاص أ');
		expect([...saved.keys()].filter(k=>k.startsWith('waseet.bebo.session.'))).toHaveLength(3);
	});
	it('edits by truncating subsequent turns, regenerates with the preceding context, and preserves other conversations', () => {
		const first=answer('الأول','رد أول');answer('الثاني','رد ثان');
		store.newConversation();const second=answer('محادثة أخرى','رد آخر');store.selectConversation(first);
		expect(store.editMessage(2,'الثاني المعدّل')).toBe(true);
		expect(store.messages().map(m=>m.text)).toEqual(['الأول','رد أول','الثاني المعدّل']);
		expect(socket.ask.mock.calls.at(-1)[1]).toEqual([{question:'الأول',answer:'رد أول'}]);
		store.cancel();expect(store.regenerate()).toBe(true);store.cancel();store.selectConversation(second);
		expect(store.messages()[0].text).toBe('محادثة أخرى');
	});
	it('requires both the user toggle and the server capability to request web grounding', () => {
		store.webSearchEnabled.set(true);store.ask('عادي');expect(socket.ask.mock.calls.at(-1)[2]).not.toHaveProperty('webSearch');store.cancel();
		store.capabilities.set({models:[],voices:[],webSearch:{available:true,provider:'google'}});store.ask('ابحث');expect(socket.ask.mock.calls.at(-1)[2].webSearch).toBe(true);store.cancel();
		store.webSearchEnabled.set(false);store.ask('عادي ثان');expect(socket.ask.mock.calls.at(-1)[2]).not.toHaveProperty('webSearch');store.cancel();
	});
	it('keeps attribution in the live reply while removing it from storage and exported histories', () => {
		store.ask('ابحث');events.next({type:'chunk',clientRequestId:'r1',chunk:'رد بمصدر'});events.next({type:'citations',clientRequestId:'r1',citations:[{docId:'web',title:'مصدر',url:'https://example.com'}],searchSuggestionsHtml:'<div>private-search-query</div>'});events.next({type:'complete',clientRequestId:'r1'});TestBed.tick();
		expect(store.messages().at(-1)?.searchSuggestionsHtml).toContain('private-search-query');
		expect(JSON.stringify(store.exportHistory())).not.toContain('private-search-query');
		expect([...saved.values()].join('')).not.toContain('private-search-query');
		expect(store.exportHistory().conversations[0].messages[1].citations?.[0].title).toBe('مصدر');
	});
	it('removes one conversation and imports safely without replacing an existing id', () => {
		const first=answer('الأولى','إجابة');store.renameConversation(first,'عنوان');store.pinConversation(first);
		store.newConversation();const second=answer('الثانية','إجابة');
		store.deleteConversation(second);expect(store.activeConversationId()).toBe(first);expect(store.conversations()).toHaveLength(1);
		expect(store.conversations()[0]).toMatchObject({title:'عنوان',pinned:true});
		const exported=store.exportHistory();expect(store.importHistory(exported)).toBe(true);expect(store.conversations()).toHaveLength(2);expect(new Set(store.conversations().map(c=>c.id)).size).toBe(2);
	});
	it('warns on unavailable storage while preserving the usable conversation in memory', () => {
		vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('quota');}});answer('سؤال','رد');
		expect(store.messages()[1].text).toBe('رد');expect(store.conversations()).toHaveLength(1);expect(store.storageNotice()).toContain('تعذر حفظ');
	});
});
