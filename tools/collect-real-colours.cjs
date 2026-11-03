// Metadata only. NEVER rewrites application source colours.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),postcss=require('postcss');
const code=ts.transpileModule(fs.readFileSync('src/app/core/identity/colour-model.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}};vm.runInNewContext(code,sandbox);const {parseColour,colourId,colourCss,COLOUR_LITERAL,paintContext,paintProperty,coreColourCandidates,stableColourName}=sandbox.exports;
const rows=new Map();let known=0;
function collect(value,property,file){if(!paintProperty(property)||/url\s*\(|var\s*\(/i.test(value))return;for(const raw of value.match(COLOUR_LITERAL)||[]){const c=parseColour(raw);if(!c)continue;const context=paintContext(property);if(coreColourCandidates(c,context).length){known++;continue;}const id=colourId(c),name=stableColourName(context,id);let row=rows.get(name);if(!row){row={name,type:'color',scope:'palette',label:({'text':'نص','background':'خلفية','border':'حدود','shadow':'ظل','detail':'قيمة عامة'})[context]+' — '+colourCss(c),dark:colourCss(c),context,colour:id,uses:0,refs:[]};rows.set(name,row);}if(row.colour!==id||row.context!==context)throw Error('Palette hash collision');row.uses++;if(!row.refs.includes(file))row.refs.push(file);}}
function css(text,file){try{postcss.parse(text).walkDecls(d=>collect(d.value,d.prop,file));}catch{}}
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory()){if(!p.includes('/site-control')&&!p.includes('/core/identity'))walk(p);continue;}if(!/\.(css|html|ts)$/.test(p)||/\.spec\.ts$|\.d\.ts$/.test(p))continue;const text=fs.readFileSync(p,'utf8'),file=p.replaceAll(path.sep,'/');if(p.endsWith('.css'))css(text,file);else{
 for(const m of text.matchAll(/\bstyle="([^"]*)"/g))css('x{'+m[1]+'}',file);
 for(const m of text.matchAll(/((?:text|bg|border|border-[trblxy]|ring|outline|decoration|fill|stroke)-\[)(#[\da-f]{3,8}|rgba?\([^\]\s]+\))(\])/gi))collect(m[2],m[1].startsWith('bg')?'background':m[1].startsWith('text')?'color':m[1].startsWith('border')?'border-color':'detail',file);
 for(const m of text.matchAll(/styles:\s*\[\s*`([^$]*?)`\s*\]/g))css(m[1],file);
}}}
walk('src');const palette=[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name));
fs.writeFileSync('src/app/core/identity/colour-palette.generated.json',JSON.stringify(palette,null,2)+'\n');fs.writeFileSync('src/app/core/identity/colour-palette-names.generated.json',JSON.stringify(palette.map(r=>r.name))+'\n');const backend=process.argv.find(a=>a.startsWith('--backend='))?.slice(10);if(backend)fs.copyFileSync('src/app/core/identity/colour-palette.generated.json',path.join(backend,'src/config/site-identity-palette.generated.json'));
console.log(JSON.stringify({paletteFields:palette.length,paletteUses:palette.reduce((n,r)=>n+r.uses,0),knownUses:known,sourceFilesRewritten:0}));
