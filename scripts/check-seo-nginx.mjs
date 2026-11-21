const httpGet = async (url, options = {}) => new Promise((resolve, reject) => {
  import('node:http').then(({ get }) => {
    get(url, options, res => {
      const chunks = []; res.on('data', b => chunks.push(b)); res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode, headers: { get: name => res.headers[name.toLowerCase()] ?? null }, text: async () => Buffer.concat(chunks).toString('utf8') }));
    }).on('error', reject);
  }).catch(reject);
});

// Integration check against the same nginx template used by Dockerfile.dev.
// After npm run build: NGINX_BINARY=/path/to/nginx NGINX_MIME_TYPES=/path/to/mime.types node scripts/check-seo-nginx.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm, cp, rename } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:net';
import { loadSeo } from './build-seo.mjs';
const seo = await loadSeo();
const binary=process.env.NGINX_BINARY || 'nginx';
const mime=process.env.NGINX_MIME_TYPES || '/etc/nginx/mime.types';
const build=resolve(process.argv[2] || 'dist/frontend');
const temp=await mkdtemp(join(tmpdir(),'seo-nginx-'));
const listener=createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
let child;
try {
  await mkdir(join(temp,'logs'));
  // Reproduce Dockerfile.dev's final browser layout, including its CSR index rename.
  const browser = join(temp, 'html');
  await cp(join(build, 'browser'), browser, { recursive: true });
  try { await rename(join(browser, 'index.csr.html'), join(browser, 'index.html')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(join(temp,'identity.inc'),'');
  const template=(await readFile('nginx/dev.conf.template','utf8'))
    .replaceAll('/etc/nginx/seo-map.conf',join(build,'seo-map.conf'))
    .replaceAll('/etc/nginx/mime.types',mime)
    .replaceAll('/etc/nginx/ws-identity.inc',join(temp,'identity.inc'))
    .replaceAll('/usr/share/nginx/html',browser)
    .replace('listen 4200',`listen 127.0.0.1:${port}`);
  const config=join(temp,'nginx.conf');
  await writeFile(config,`pid ${temp}/nginx.pid;error_log stderr;events {} http { access_log off; ${template} }`);
  const args=['-p',temp,'-c',config];
  const validation=spawnSync(binary,[...args,'-t'],{encoding:'utf8'});
  assert.equal(validation.status,0,validation.stderr || validation.error?.message);
  child=spawn(binary,[...args,'-g','daemon off;'],{stdio:['ignore','ignore','pipe']});
  const base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<50;i++){try{await httpGet(base,{headers:{Host:'waseetai.com'}});ready=true;break;}catch{await new Promise(r=>setTimeout(r,20));}}
  assert.ok(ready,'nginx did not start');
  for(const page of seo.PUBLIC_PAGES){
    const r=await httpGet(base+page.path+'?utm_source=check',{headers:{Host:'waseetai.com'}});const body=await r.text();
    assert.equal(r.status,200,page.path);assert.equal(r.headers.get('x-robots-tag'),null,page.path);
    assert.ok(body.includes(`href="${seo.SITE_ORIGIN+page.path}"`),page.path);
    assert.ok(body.includes(`<title>${seo.escapeHtml(page.title+' | '+seo.SITE_NAME)}</title>`),page.path);
  }
  for(const host of ['waseetai.com','www.waseetai.com','dev.waseetai.com','agent.waseetai.com','localhost']){
    const official=seo.isOfficialHost(host);
    for(const path of ['/about/','/pricing','/auth/login','/supper-admin-overview','/checkout/payment','/marketplace/offer/123?token=secret','/marketplace/cart','/marketplace/comparison','/marketplace/tracking','/marketplace/cart/?x=1','/marketplace/%63art','/marketplace/COMPARISON','/marketplace/cart/item','/comparison','/tracking','/marketplace/cart-design']){
      const r=await httpGet(base+path,{headers:{Host:host}});const body=await r.text();
      assert.equal(r.status, 200, `${host}${path} must serve the Angular shell`);
      assert.equal(r.headers.get('x-robots-tag'),official&&seo.pageSeo(path).indexable?null:seo.NOINDEX_ROBOTS,`${host}${path}`);
      if(!seo.pageSeo(path).indexable) assert.ok(!body.includes('rel="canonical"'));
    }
    const robots=await httpGet(base+'/robots.txt',{headers:{Host:host}});
    assert.ok(robots.headers.get('content-type').startsWith('text/plain'));
    assert.equal((await robots.text()).includes('Sitemap:'),official);
    const sitemap=await httpGet(base+'/sitemap.xml',{headers:{Host:host}});
    assert.equal(sitemap.status,official?200:404);
    if(official)assert.ok(sitemap.headers.get('content-type').includes('xml'));
  }
  console.log(`PASS nginx: ${seo.PUBLIC_PAGES.length} initial HTML heads; official/www/dev/agent/local host rules; private routes; robots and sitemap content types.`);
} finally {
  if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}
  await rm(temp,{recursive:true,force:true});
}

