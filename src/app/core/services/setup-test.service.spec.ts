import { SetupTestService } from './setup-test.service';
import { vi } from 'vitest';

describe('setup test cached question progression', () => {
 let service: SetupTestService;
 let socket: any;
 const questions = [0,1,2].map(index => ({ id: String(index), index, total: 3, text: `سؤال ${index}`, options: ['أ','ب'] }));
 beforeEach(() => {
  socket = { handlers: {} as any, emit: vi.fn(), disconnect: vi.fn(), on(e: string, h: any) { this.handlers[e] = h; } };
  (globalThis as any).__socketIoModule = () => ({ io: () => socket });
  service = new SetupTestService(); service.startTest();
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
