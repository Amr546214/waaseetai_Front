import { assertLocalTestUrl } from './test-network-guard';
describe('unit test network boundary', () => {
 it('rejects deployed APIs and deceptive localhost prefixes before any request', () => {
  for (const url of ['https://dev.waseetai.com/api','https://www.google-analytics.com','https://localhost.example.com','https://localhost@dev.waseetai.com/api']) expect(() => assertLocalTestUrl(url)).toThrow(/External network is disabled/);
 });
 it('allows explicit loopback test servers and relative fixture URLs', () => {
  for (const url of ['http://127.0.0.1:1234','http://localhost:4200','ws://[::1]:3456','/assets/example.json']) expect(() => assertLocalTestUrl(url)).not.toThrow();
 });
});
