import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadSeo, renderShell, buildSeo } from './build-seo.mjs';
const seo = await loadSeo();
const html = await readFile('src/index.html', 'utf8');
const routes = await readFile('src/app/pages/website/website.routes.ts', 'utf8');
const routePaths = [...routes.matchAll(/path\s*:\s*'([^']*)'/g)].map(m => '/' + m[1]);

test('sitemap contains only real public content, including every published article', async () => {
  const xml = await readFile('public/sitemap.xml', 'utf8');
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(urls).size, urls.length);
  assert.deepEqual(urls, seo.PUBLIC_PAGES.map(p => seo.SITE_ORIGIN + p.path));
  for (const page of seo.PUBLIC_PAGES) {
    assert.ok(routePaths.includes(page.path) || (page.path.startsWith('/blog/') && routePaths.includes('/blog/:slug')), page.path);
    assert.ok(page.title && page.description, page.path);
  }
  for (const bad of ['/services', '/plans', '/brokers', '/security', '/deals', '/cart', '/auth/login']) assert.ok(!urls.includes(seo.SITE_ORIGIN + bad));
  // Every literal public-content route is covered; these routes are user state or private operations, not landing pages.
  const privatePaths = new Set(['/cart', '/favorites', '/compare-services', '/compare-providers', '/custom-request', '/support/report-problem', '/support/track-request']);
  for (const path of routePaths.filter(p => !p.includes(':') && !p.startsWith('/checkout/') && !privatePaths.has(p))) assert.ok(urls.includes(seo.SITE_ORIGIN + path), `missing ${path}`);
});
test('all initial public HTML heads have independent canonical/title/description, and a stable official share image', () => {
  const titles = new Set();
  for (const p of seo.PUBLIC_PAGES) {
    const doc = renderShell(html, p, seo);
    assert.ok(doc.includes(`href="${seo.SITE_ORIGIN + p.path}"`));
    assert.equal((doc.match(/rel="canonical"/g) || []).length, 1);
    assert.ok(doc.includes(seo.escapeHtml(p.title + ' | ' + seo.SITE_NAME)));
    assert.ok(doc.includes(`name="description" content="${seo.escapeHtml(p.description)}"`));
    assert.ok(!doc.includes('https://dev.waseetai.com/'));
    titles.add(/<title>([^<]*)<\/title>/.exec(doc)[1]);
  }
  assert.equal(titles.size, seo.PUBLIC_PAGES.length);
  assert.ok(!renderShell(html, seo.PUBLIC_PAGES[0], seo, false).includes('rel="canonical"'));
});
test('host allowlist rejects dev, agent, arbitrary suffixes and spoofed hosts', () => {
  for (const host of ['waseetai.com','www.waseetai.com']) assert.equal(seo.isOfficialHost(host), true);
  for (const host of ['dev.waseetai.com','agent.waseetai.com','waseetai.com.evil.test','localhost','']) assert.equal(seo.isOfficialHost(host), false);
});
test('query/hash/trailing slash are removed without changing the actual public path', () => {
  assert.equal(seo.pageSeo('/about/?utm_source=x#team').path, '/about');
  assert.equal(seo.pageSeo('/pricing').title, 'الأسعار والعمولات');
  assert.equal(seo.pageSeo('/marketplace/offer/123?token=secret').path, '/marketplace/offer/123');
  for (const p of ['/supper-admin-overview','/supper-admin-overview/users','/auth/login','/checkout/payment','/admin-invite?token=secret','/not-a-real-page','/favorites']) assert.equal(seo.pageSeo(p).indexable, false, p);
});
test('reserved marketplace application paths are never treated as public service slugs', () => {
  for (const path of ['/marketplace/cart', '/marketplace/comparison', '/marketplace/tracking', '/marketplace/cart/?utm_source=x#item', '/marketplace/%63art', '/marketplace/COMPARISON', '/marketplace/cart/item']) {
    assert.equal(seo.pageSeo(path).indexable, false, path);
    assert.ok(!seo.PUBLIC_PAGES.some(p => p.path === path));
  }
  for (const path of ['/marketplace/design-logo', '/marketplace/offer/123', '/marketplace/cart-design']) assert.equal(seo.pageSeo(path).indexable, true, path);
});
test('metadata escapes text and JSON-LD cannot close its script; no invented address is emitted', () => {
  const text = '</script><img src=x onerror=alert(1)>';
  const doc = renderShell(html, {...seo.PUBLIC_PAGES[0], title: text, description: text}, seo);
  assert.ok(!doc.includes(`<title>${text}`));
  const schema = seo.schemaJson(seo.organizationSchema(text, 'help@example.test', '+123'));
  assert.ok(!schema.includes('</script>'));
  assert.equal(JSON.parse(schema)['@graph'][0].name, text);
  assert.ok(!('address' in seo.organizationSchema()['@graph'][0]));
});
test('build emits route-specific shells and a host policy for the actual static Docker runtime', async () => {
  const out = await mkdtemp(join(tmpdir(), 'seo-build-'));
  try {
    await mkdir(join(out,'browser'));
    await import('node:fs/promises').then(fs => fs.writeFile(join(out,'browser/index.csr.html'), html));
    await buildSeo(out);
    const conf = await readFile(join(out,'seo-map.conf'),'utf8');
    assert.ok(conf.includes('map $uri $ws_request_path'));
    for (const path of seo.PRIVATE_MARKETPLACE_PATHS) assert.ok(conf.includes(`"${path}" 0;`));
    assert.ok(conf.includes('map $ws_request_path $ws_public_path'));
    assert.ok(conf.includes('default "noindex, nofollow"'));
    assert.ok(conf.includes('"1:1" ""'));
    const i = seo.PUBLIC_PAGES.findIndex(p => p.path === '/about');
    assert.ok((await readFile(join(out,`browser/_seo/page-${i}.html`),'utf8')).includes('href="https://waseetai.com/about"'));
    assert.ok(!(await readFile(join(out,'browser/index.csr.html'),'utf8')).includes('rel="canonical"'));
    assert.equal(await readFile(join(out,'browser/sitemap.xml'),'utf8'),await readFile('public/sitemap.xml','utf8'));
    const docker = await readFile('Dockerfile.dev','utf8');
    assert.ok(docker.includes('/app/dist/frontend/seo-map.conf'));
  } finally { await rm(out,{recursive:true,force:true}); }
});

test('Express SSR entry enforces the same host boundary and serves actual crawler files', async () => {
  const {build} = await import('esbuild');
  const bundled = await build({entryPoints:['src/seo-http.ts'],bundle:true,write:false,platform:'node',format:'esm'});
  const {seoHeaders} = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
  const {default:express} = await import('express');
  const app=express();app.use(seoHeaders);app.use((_req,res)=>res.type('html').send('<h1>shell</h1>'));
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    for (const host of ['waseetai.com','www.waseetai.com','dev.waseetai.com','agent.waseetai.com']) {
      const official=host==='waseetai.com'||host==='www.waseetai.com';
      const page=await httpGet(base+'/about',{headers:{Host:host}});
      assert.equal(page.headers.get('x-robots-tag'),official?null:seo.NOINDEX_ROBOTS);
      const robots=await httpGet(base+'/robots.txt',{headers:{Host:host}});
      assert.ok(robots.headers.get('content-type').startsWith('text/plain'));
      assert.equal((await robots.text()).includes('Sitemap:'),official);
      const sitemap=await httpGet(base+'/sitemap.xml',{headers:{Host:host}});
      assert.equal(sitemap.status,official?200:404);
      if(official) assert.ok((await sitemap.text()).includes('<urlset'));
    }
    for (const url of ['/auth/login','/supper-admin-overview','/checkout/payment','/no-such-page','/marketplace/cart','/marketplace/comparison/?id=x','/marketplace/tracking','/marketplace/%63art']) {
      const r=await httpGet(base+url,{headers:{Host:'waseetai.com'}});
      assert.equal(r.headers.get('x-robots-tag'),seo.NOINDEX_ROBOTS);
    }
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

const httpGet = async (url, options = {}) => new Promise((resolve, reject) => {
  import('node:http').then(({ get }) => {
    get(url, options, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: { get: name => res.headers[name.toLowerCase()] ?? null }, text: async () => Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  }).catch(reject);
});
