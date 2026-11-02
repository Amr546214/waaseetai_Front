import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { CreateRequest } from './create-request';

describe('AI full draft respects edits made while it runs', () => {
 let fixture: any; let c: CreateRequest; let response: Subject<any>;
 beforeEach(async () => {
  await TestBed.configureTestingModule({imports:[CreateRequest],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting()]}).compileComponents();
  fixture=TestBed.createComponent(CreateRequest); c=fixture.componentInstance;
  c.setTitle('متجر لبيع الملابس'); c.setDescription('وصف المتجر المكتوب من المستخدم قبل التحليل');
  response=new Subject(); vi.spyOn((c as any).projectApi,'getAiDraftSuggestion').mockReturnValue(response);
 });
 afterEach(() => {fixture.destroy();TestBed.resetTestingModule();});
 it('discards late output after the user changes the title', () => {
  c.triggerAiFullSuggest(); c.setTitle('منصة تعليمية جديدة');
  response.next({data:{suggestedTitle:'عنوان المتجر القديم',suggestedDescription:'نتيجة قديمة'}});
  expect(c.title()).toBe('منصة تعليمية جديدة'); expect(c.description()).not.toBe('نتيجة قديمة');
  expect(c.isFetchingAiDraft()).toBe(false);
 });
 it('preserves a description edited during generation', () => {
  c.triggerAiFullSuggest(); c.setDescription('نص جديد كتبه المستخدم أثناء الانتظار');
  response.next({data:{suggestedTitle:'عنوان آخر',suggestedDescription:'نتيجة قديمة'}});
  expect(c.description()).toBe('نص جديد كتبه المستخدم أثناء الانتظار');
 });
 it('still applies a current response when its input has not changed', () => {
  c.triggerAiFullSuggest(); response.next({data:{suggestedTitle:'عنوان محسّن للمتجر',suggestedDescription:'وصف محسّن لنفس المتجر بالبيانات الحالية'}});
  expect(c.title()).toBe('عنوان محسّن للمتجر'); expect(c.description()).toContain('وصف محسّن');
 });
});
