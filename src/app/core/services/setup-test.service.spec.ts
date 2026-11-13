import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { SetupTestService } from './setup-test.service';
import { ExamEnvironmentService } from './exam-environment.service';
import { vi } from 'vitest';

let envState: any = { restricted: false };
let postFn: any = vi.fn(() => of({ data: { ticket: 'T1' } }));
const provide = () => TestBed.configureTestingModule({ providers: [{ provide: HttpClient, useValue: { post: (...a: any[]) => postFn(...a) } }, { provide: ExamEnvironmentService, useValue: { load: (cb: any) => cb(envState), satisfied: () => !envState.restricted || (envState.ready && envState.verified) } }] });

describe('setup test cached question progression', () => {
 let service: SetupTestService;
 let socket: any;
 const questions = [0,1,2].map(index => ({ id: String(index), index, total: 3, text: `سؤال ${index}`, options: ['أ','ب'] }));
 beforeEach(() => {
  socket = { handlers: {} as any, emit: vi.fn(), disconnect: vi.fn(), on(e: string, h: any) { this.handlers[e] = h; } };
  (globalThis as any).__socketIoModule = () => ({ io: () => socket });
  envState = { restricted: false }; postFn = vi.fn(() => of({ data: { ticket: 'T1' } }));
  provide(); service = TestBed.inject(SetupTestService); service.startTest();
  socket.handlers['setup_test:ready']({totalQuestions: 3, questions});
 });
 afterEach(() => service.disconnect());
 it('advances instantly and ignores delayed older server questions', () => {
  service.submitAnswer('0',0); service.submitAnswer('1',1);
  expect(service.currentQuestion()?.id).toBe('2');
  socket.handlers['setup_test:question'](questions[1]);
  expect(service.currentQuestion()?.id).toBe('2');
  service.submitAnswer('2',0);
  socket.handlers['setup_test:question'](questions[2]);
  expect(service.currentQuestion()).toBeNull();
 });
 it('does not emit duplicate answers or invalid options', () => {
  service.submitAnswer('0',9); expect(service.currentQuestion()?.id).toBe('0');
  service.submitAnswer('0',1); service.submitAnswer('0',1);
  expect(socket.emit.mock.calls.filter((c: any[]) => c[0] === 'setup_test:answer')).toHaveLength(1);
 });
 it('supports an older server that does not send the question batch', () => {
  service.startTest(); socket.handlers['setup_test:ready']({totalQuestions: 3});
  expect(socket.emit).toHaveBeenCalledWith('setup_test:get_question',expect.any(Object));
  socket.handlers['setup_test:question'](questions[0]);
  expect(service.currentQuestion()?.id).toBe('0');
 });
});

describe('setup test in the restricted exam mode', () => {
 let socket: any;
 beforeEach(() => { socket = { handlers: {} as any, emit: vi.fn(), disconnect: vi.fn(), on(e: string, h: any) { this.handlers[e] = h; } }; (globalThis as any).__socketIoModule = () => ({ io: () => socket }); postFn = vi.fn(() => of({ data: { ticket: 'T1' } })); });
 it('an unverified browser: nothing is generated, no socket is opened, the page is told to show the instructions', () => {
  envState = { restricted: true, ready: true, verified: false }; provide();
  const svc = TestBed.inject(SetupTestService); svc.startTest();
  expect(svc.needsExamEnvironment()).toBe(true); expect(svc.isGenerating()).toBe(false);
  expect(postFn).not.toHaveBeenCalled(); expect(socket.emit).not.toHaveBeenCalled();
 });
 it('a verified Safe Exam Browser gets a ticket on the HTTP route and the same test starts with it', () => {
  envState = { restricted: true, ready: true, verified: true }; provide();
  const svc = TestBed.inject(SetupTestService); svc.startTest();
  expect(postFn.mock.calls[0][0]).toMatch(/exam-environment\/ticket$/);
  expect(socket.emit).toHaveBeenCalledWith('setup_test:init', { token: expect.any(String), examTicket: 'T1' });
  expect(svc.needsExamEnvironment()).toBe(false);
 });
 it('the normal mode is unchanged: no ticket, init carries only the token', () => {
  envState = { restricted: false }; provide();
  const svc = TestBed.inject(SetupTestService); svc.startTest();
  expect(postFn).not.toHaveBeenCalled();
  expect(socket.emit).toHaveBeenCalledWith('setup_test:init', { token: expect.any(String) });
 });
 it('a failed ticket request stops with a clear message, no socket', () => {
  envState = { restricted: true, ready: true, verified: true }; postFn = vi.fn(() => throwError(() => new Error('x'))); provide();
  const svc = TestBed.inject(SetupTestService); svc.startTest();
  expect(svc.errorMsg()).toContain('Safe Exam Browser'); expect(socket.emit).not.toHaveBeenCalled();
 });
});
