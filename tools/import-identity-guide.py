"""Import the owner's bundled identity document without executing it in the admin origin.
Usage: python tools/import-identity-guide.py /path/to/identity.dc.html
The generated preview is static reference material. Only Angular editors publish changes.
"""
from pathlib import Path
import hashlib, json, re, sys
source = Path(sys.argv[1]).read_text()
match = re.search(r'(<script type="__bundler/template">)(.*?)(</script>)', source, re.S)
if not match:
    raise SystemExit('Expected a bundled identity document')
template = json.loads(match[2])
policy = "default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: data:; style-src 'unsafe-inline' blob: data:; img-src blob: data:; font-src blob: data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
meta = '<meta http-equiv="Content-Security-Policy" content="' + policy + '"><meta name="referrer" content="no-referrer">'
# External font links are unnecessary: all font bytes are bundled in this file.
template = re.sub(r'<link[^>]*href="https?://[^>]*>', '', template)
bridge = '''<script>
(function () {
 let ready = false;
 const targets = {s01:'colors',s02:'typography',s03:'icons',s04:'layout',s08:'assets'};
 function install() {
  document.querySelectorAll('section[id]').forEach(section => {
   const id=section.id.split('-').pop(), target=targets[id];
   if (!target || section.querySelector('[data-identity-edit]')) return;
   const heading=section.querySelector('h2'); if (!heading) return;
   const button=document.createElement('button'); button.type='button';
   button.dataset.identityEdit=target; button.textContent='تعديل على الموقع';
   button.style.cssText='font:700 12px Tajawal,system-ui;cursor:pointer;border:1px solid currentColor;border-radius:999px;padding:7px 14px;margin:4px 0 12px;background:transparent;color:inherit';
   button.onclick=()=>parent.postMessage({type:'waseet-identity-edit',section:target},'*');
   heading.after(button);
  });
  if (!ready && document.querySelector('[data-identity-edit]')) { ready=true; parent.postMessage({type:'waseet-identity-ready'},'*'); }
 }
 new MutationObserver(install).observe(document.documentElement,{childList:true,subtree:true});
 install();
})();
</script>'''
template = template.replace('<head>', '<head>' + meta, 1).replace('</body>', bridge + '</body>')
encoded = json.dumps(template, ensure_ascii=False).replace('</', '<\\/')
source = source[:match.start(2)] + encoded + source[match.end(2):]
source = source.replace('<head>', '<head>' + meta, 1)
out = Path('public/assets/site-control/identity-guide')
out.mkdir(parents=True, exist_ok=True)
(out/'index.html').write_text(source)
(out/'source.json').write_text(json.dumps({'source':'Owner supplied: هوية وسيط AI.dc.html', 'sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(), 'generator':'tools/import-identity-guide.py','role':'Isolated original reference; edits use the existing versioned API'}, ensure_ascii=False, indent=2)+'\n')
print('Imported identity reference:', len(source), 'characters')
