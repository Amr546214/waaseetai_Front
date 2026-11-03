// Offline DOM smoke check of the actual generated bundle, not a pixel/browser proof.
const fs = require('node:fs');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const blobs = new Map(); let next = 0;
const errors = [], requests = [];
class OfflineResources extends ResourceLoader {
 fetch(url) {
  requests.push(url.split(':')[0]);
  if (blobs.has(url)) return blobs.get(url).arrayBuffer().then(bytes => Buffer.from(bytes));
  errors.push('Unexpected external resource: ' + url);
  return Promise.reject(new Error('No external network allowed'));
 }
}
const vc = new VirtualConsole();
vc.on('jsdomError', error => errors.push(error.message));
vc.on('error', (...args) => errors.push(args.join(' ')));
const source = fs.readFileSync('public/assets/site-control/identity-guide/index.html', 'utf8');
const dom = new JSDOM(source, {
 url: 'https://identity-reference.invalid/', runScripts: 'dangerously', resources: new OfflineResources(),
 pretendToBeVisual: true, virtualConsole: vc,
 beforeParse(w) {
  w.Blob = Blob; w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder; w.DecompressionStream = DecompressionStream;
  w.URL.createObjectURL = blob => { const url = 'blob:https://identity-reference.invalid/' + ++next; blobs.set(url, blob); return url; };
  w.URL.revokeObjectURL = url => blobs.delete(url);
  w.fetch = () => { throw new Error('Network access forbidden'); };
  w.IntersectionObserver = class { constructor(callback) { this.callback = callback; } observe(target) { w.setTimeout(() => this.callback([{ target, isIntersecting: true }]), 0); } disconnect() {} };
  w.requestIdleCallback = callback => w.setTimeout(callback, 0);
 },
});
setTimeout(() => {
 const d = dom.window.document;
 const headings = [...d.querySelectorAll('h2')].map(x => x.textContent.trim());
 const buttons = d.querySelectorAll('[data-identity-edit]');
 const unresolved = (d.body.textContent.match(/\{\{/g) || []).length;
 const result = { headings: headings.length, editButtons: buttons.length, unresolvedTemplates: unresolved, scriptRequests: requests, errors };
 console.log(JSON.stringify(result, null, 2));
 dom.window.close();
 if (headings.length !== 26 || buttons.length !== 10 || unresolved || errors.length || requests.some(s => s !== 'blob')) process.exitCode = 1;
}, 6000);
