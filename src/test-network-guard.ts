// Unit tests must never call a deployed API. Local integration servers and explicit mocks are allowed.
export function assertLocalTestUrl(input: string | URL): void {
 const url = new URL(String(input), 'http://localhost/');
 if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
  throw new Error(`External network is disabled in unit tests (${url.hostname}); provide an HTTP mock.`);
 }
}

export function installTestNetworkGuard(): void {
 const host = globalThis as any;
 if (host.__wsTestNetworkGuardInstalled) return;
 host.__wsTestNetworkGuardInstalled = true;
 const nativeFetch = host.fetch;
 if (typeof nativeFetch === 'function') host.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  try { assertLocalTestUrl(typeof input === 'object' && 'url' in input ? input.url : String(input)); }
  catch (error) { return Promise.reject(error); }
  return nativeFetch(input, init);
 };
 if (host.XMLHttpRequest) {
  const open = host.XMLHttpRequest.prototype.open;
  host.XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
   assertLocalTestUrl(url); return open.call(this, method, url, ...args);
  };
 }
 if (host.WebSocket) host.WebSocket = new Proxy(host.WebSocket, {
  construct(target, args) { assertLocalTestUrl(args[0]); return Reflect.construct(target, args); }
 });
}
