import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Specialties } from './specialties';

describe('specialty sample AI draft uses actual service data without manufacturing proof', () => {
 let c: Specialties; let service: any;
 const sample = () => c.samples()[0];
 beforeEach(() => {
  service={suggestSampleDraft:vi.fn()};
  c=Object.create(Specialties.prototype);
  Object.assign(c,{
   specialtyService:service,
   samples:signal([{id:'s1',subSpecialty:'قانون ضريبي',title:'مذكرة امتثال',description:'وصف العمل الحقيقي الذي نفذه مقدم الخدمة',technologies:[],technologiesInput:'',publicFile:new File(['work'],'real.pdf'),publicFileName:'real.pdf',proofFiles:[new File(['proof'],'proof.pdf')],proofFileNames:['proof.pdf']}]),
   draftingSamples:signal(new Set<string>()),stepError:signal(null),selectedSpecId:signal('law'),filteredSpecialties:signal([{id:'law',name:'قانون'}]),
  });
 });
 it('uses specialty-aware upstream text while preserving uploaded files and proof identity', async () => {
  const before=sample(); service.suggestSampleDraft.mockReturnValue(of({data:{title:'عنوان من الخدمة',description:'صياغة من الخدمة',technologiesUsed:['مراجعة العقود']}}));
  await c.autoFillSample('s1');
  expect(service.suggestSampleDraft).toHaveBeenCalledWith(expect.objectContaining({specialtyName:'قانون',subSpecialties:['قانون ضريبي'],title:'مذكرة امتثال'}));
  expect(sample().title).toBe('عنوان من الخدمة');expect(sample().publicFile).toBe(before.publicFile);expect(sample().proofFiles[0]).toBe(before.proofFiles[0]);
 });
 it('keeps existing data on failure, without substituting canned examples', async () => {
  const before=sample(); service.suggestSampleDraft.mockReturnValue(throwError(() => new Error('offline')));
  await c.autoFillSample('s1');expect(sample()).toBe(before);expect(c.stepError()).toContain('بياناتك وملفاتك كما هي');expect(c.draftingSamples().size).toBe(0);
 });
 it('requires the user own draft before any AI call', async () => {
  sample().title=''; await c.autoFillSample('s1');expect(service.suggestSampleDraft).not.toHaveBeenCalled();expect(c.stepError()).toContain('عملك الفعلي');
 });
 it('drops stale suggestions after edits made during the request', async () => {
  const response=new Subject<any>();service.suggestSampleDraft.mockReturnValue(response);
  const pending=c.autoFillSample('s1');sample().title='عنوان جديد كتبه المستخدم';
  response.next({data:{title:'رد قديم',description:'رد قديم',technologiesUsed:[]}});await pending;
  expect(sample().title).toBe('عنوان جديد كتبه المستخدم');expect(c.stepError()).toContain('لم يُطبّق المقترح القديم');
 });
 it('only starts one request for double click on the same sample', async () => {
  const response=new Subject<any>();service.suggestSampleDraft.mockReturnValue(response);
  const pending=c.autoFillSample('s1');await c.autoFillSample('s1');expect(service.suggestSampleDraft).toHaveBeenCalledTimes(1);
  response.error(new Error('offline'));await pending;
 });
});
