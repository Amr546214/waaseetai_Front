/* ws-light-polish.js — runtime light-mode polish for وسيط AI dashboards/pages.
   In light mode it fixes (across ALL tabs/states/dynamic content):
   1) faint / white text  -> hue-preserving dark color
   2) vanishing section borders & dividers -> visible light divider
   3) dropdowns / modals -> glassy (translucent + blur)
   Re-runs on theme toggle and DOM mutations. Safe no-op in dark mode. */
(function () {
  var BORDER = '#CBD5E1';            // visible light divider
  var GLASS = 'rgba(255,255,255,.72)';
  var applied = [];                  // [el, prop, origVal, origPrio]

  function pc(s){ if(!s) return null; var m=s.match(/rgba?\(([^)]+)\)/); if(!m) return null; var p=m[1].split(',').map(parseFloat); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; }
  function hexC(h){ var m=/^#([0-9a-f]{6})$/i.exec(h); if(!m) return null; var n=parseInt(m[1],16); return {r:(n>>16)&255,g:(n>>8)&255,b:n&255,a:1}; }
  function allCols(s){ var o=[],re=/rgba?\(([^)]+)\)/g,m; while((m=re.exec(s))){var p=m[1].split(',').map(parseFloat);o.push({r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1});} return o; }
  function over(s,b){ var a=s.a+b.a*(1-s.a); if(a===0) return {r:0,g:0,b:0,a:0}; return {r:(s.r*s.a+b.r*b.a*(1-s.a))/a,g:(s.g*s.a+b.g*b.a*(1-s.a))/a,b:(s.b*s.a+b.b*b.a*(1-s.a))/a,a:a}; }
  function lum(c){ var f=function(v){v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);}; return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); }
  function ratio(a,b){ var L1=lum(a),L2=lum(b),hi=Math.max(L1,L2)+.05,lo=Math.min(L1,L2)+.05; return hi/lo; }
  function darkFor(c){ var r=c.r,g=c.g,b=c.b,mn=Math.min(r,g,b),mx=Math.max(r,g,b);
    if(mn>205) return '#0F172A';
    if(mx-mn<42) return '#475569';
    if(r>=g&&r>=b){ if(g>120&&b<115) return '#9A6700'; return '#B42318'; }
    if(g>=r&&g>=b) return '#0A6F64';
    if(b>r&&b>=g){ if(r>110&&r>g) return '#6B27A5'; return '#1D6FE0'; }
    if(g>=120&&b>=120) return '#0A6F64';
    return '#475569'; }
  function lightFor(c){ var r=c.r,g=c.g,b=c.b,mn=Math.min(r,g,b),mx=Math.max(r,g,b);
    if(mx<60) return '#A8B2D1';
    if(mx-mn<42) return '#A8B2D1';
    if(r>=g&&r>=b){ if(g>120&&b<115) return '#FFB400'; return '#FF8C69'; }
    if(g>=r&&g>=b) return '#2BD4C7';
    if(b>r&&b>=g){ if(r>110&&r>g) return '#A56BE0'; return '#5DA0FF'; }
    return '#A8B2D1'; }

  function isLight(){
    try { if(localStorage.getItem('ws-theme')==='light') return true; } catch(e){}
    try { if(localStorage.getItem('waseet_theme')==='light') return true; } catch(e){}
    if(document.getElementById('ws-light')) return true;
    if(document.body && document.body.classList.contains('light')) return true;
    if(document.body && (document.body.classList.contains('light-theme') || document.body.classList.contains('theme-light'))) return true;
    if(document.documentElement && (document.documentElement.classList.contains('light-theme') || document.documentElement.classList.contains('theme-light'))) return true;
    var pr=document.getElementById('page-root');
    if(pr && pr.style && pr.style.getPropertyValue('--pg')) return true;
    return false;
  }
  function pageBase(){
    var b=pc(getComputedStyle(document.body).backgroundColor);
    if(b && b.a>=1) return b;
    return {r:238,g:242,b:250,a:1};
  }
  function visible(el){ var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity)===0) return false; if(el.offsetParent===null&&cs.position!=='fixed') return false; var rc=el.getBoundingClientRect(); return rc.width>0&&rc.height>0; }
  function directText(el){ for(var i=0;i<el.childNodes.length;i++){var n=el.childNodes[i]; if(n.nodeType===3&&n.nodeValue.trim()) return n.nodeValue.trim();} return ''; }
  function effBg(el,fgL,base){
    var acc=null,node=el;
    while(node && node.nodeType===1){
      var cs=getComputedStyle(node),layer=null;
      if(cs.backgroundImage && cs.backgroundImage!=='none'){
        var st=allCols(cs.backgroundImage);
        if(st.length){ layer=st[0]; var bd=1e9; for(var k=0;k<st.length;k++){var d=Math.abs(lum(st[k])-fgL); if(d<bd){bd=d;layer=st[k];}} }
      }
      if(!layer){ var c=pc(cs.backgroundColor); if(c&&c.a>0) layer=c; }
      if(layer) acc = acc===null?layer:over(acc,layer);
      if(acc && acc.a>=0.999) return acc;
      node=node.parentElement;
    }
    return acc===null?base:over(acc,base);
  }
  function setP(el,prop,val){
    applied.push([el,prop,el.style.getPropertyValue(prop),el.style.getPropertyPriority(prop)]);
    el.style.setProperty(prop,val,'important');
  }
  function revert(){ for(var i=0;i<applied.length;i++){var a=applied[i]; if(a[2]) a[0].style.setProperty(a[1],a[2],a[3]); else a[0].style.removeProperty(a[1]);} applied=[]; }

  function run(){ if(mo) mo.disconnect(); try{ doRun(); } finally { reconnect(); } }
  function doRun(){
    revert();
    var light=isLight();
    var base=pageBase();
    // light-mode static rules that pseudo-states need (can't be set as inline per-element):
    // destructive logout hover keeps a warm hue but must clear contrast on the light sidebar.
    var pcss=document.getElementById('ws-polish-css');
    if(light){
      if(!pcss){ pcss=document.createElement('style'); pcss.id='ws-polish-css'; (document.head||document.documentElement).appendChild(pcss); }
      pcss.textContent='body{--teal-txt:#0F8A7F;--ai-txt:#6B27A5;--kahr:#9A6700;color:#1E293B}'
        +'.sb-logout:hover{color:#C2410C !important;background:rgba(194,65,12,.07) !important}'
        +'.sf-links a:hover{color:#0F8A7F !important}'
        +'.t-toggle .seg.is-selected,.theme-toggle .seg.is-selected{background:#fff !important;color:#0F172A !important;box-shadow:0 2px 8px rgba(15,23,42,.12) !important}'
        +'.t-toggle .seg.is-selected svg,.theme-toggle .seg.is-selected svg{color:#0F8A7F !important}'
        +'.user-dropdown{background:rgba(255,255,255,.96) !important;border-color:#E2E8F4 !important;box-shadow:0 20px 56px rgba(15,23,42,.18) !important}'
        +'.user-dropdown .udrop-item{color:#1E293B !important}'
        +'.user-dropdown .udrop-item:hover{background:#EEF2FA !important;color:#070D24 !important}'
        +'.user-dropdown .udrop-item svg{color:#5B6472 !important}'
        +'.user-dropdown [style*="color:#fff"]{color:#1E293B !important}'
        +'.user-dropdown [style*="color:#A8B2D1"]{color:#5B6472 !important}'
        +'.user-dropdown .udrop-sep{background:#E2E8F4 !important}'
        +'.user-dropdown .udrop-logout:hover{color:#C2410C !important;background:rgba(194,65,12,.07) !important}'
        +'.prog-bar,.ac-prog-bar,.lc-track,.lc-smbar,.budget-bar-outer,.es-bar,.tprog-bar,.bs-bar,.emp-prog,.rq-prog-track,.sk-prog-track,.inv-prog-bar,.ai-metric-bar,.fs-warn-bar,.fs-settle-bar,.test-prog-bar,.eb-bar,.bar-track,[role="progressbar"]{background:rgba(7,13,36,.13) !important}'
        /* inline-style progress bar tracks (e.g. rgba(255,255,255,.06/.07/.08) as track bg) */
        +'[style*="rgba(255,255,255,.06)"][style*="border-radius"],[style*="rgba(255,255,255,.07)"][style*="border-radius"],[style*="rgba(255,255,255,.08)"][style*="border-radius"],[style*="rgba(255,255,255, .06)"][style*="border-radius"],[style*="rgba(255,255,255, .07)"][style*="border-radius"],[style*="rgba(255,255,255, .08)"][style*="border-radius"]{background:rgba(7,13,36,.10) !important}'
        +'.step-line:not(.done){background:rgba(7,13,36,.10) !important}'
        +'.wz-connector:not(.done){background:rgba(7,13,36,.10) !important}'
        +'.req-row{border-bottom-color:rgba(7,13,36,.07) !important}'
        +'.ord-row,.inv-row,.trx-row,.dis-row{border-bottom-color:rgba(7,13,36,.07) !important}'
        /* ── input fields ── */
        +'.inp-field,.skills-add-inp,.pref-val,.chat-inp,.msg-inp,.search-inp,.wz-inp{background:#fff !important;border-color:#D8DFEC !important;color:#0F172A !important}'
        +'.skills-chips{background:rgba(7,13,36,.04) !important;border-color:#D8DFEC !important}'
        /* ── secondary / ghost buttons ── */
        +'.btn-secondary,.av-btn,.req-btn-ghost,.tb-btn,.lc-btn-gh,.ofr-neg,.action-btn-ghost,.chat-attach-btn{background:#EEF2FA !important;border-color:#D8DFEC !important;color:#475569 !important}'
        +'a.btn-secondary,button.btn-secondary,a.av-btn,button.av-btn,a.req-btn-ghost,button.req-btn-ghost,a.tb-btn,button.tb-btn,a.lc-btn-gh,button.lc-btn-gh{background:#EEF2FA !important;border-color:#D8DFEC !important;color:#475569 !important}'
        +'.btn-secondary:hover,.av-btn:hover,.req-btn-ghost:hover,.tb-btn:hover{background:#E2E8F4 !important;color:#0F172A !important}'
        /* ── skeleton / loading shimmer ── */
        +'.skeleton-box,.skeleton-row{background:linear-gradient(90deg,rgba(7,13,36,.06) 25%,rgba(7,13,36,.12) 50%,rgba(7,13,36,.06) 75%) !important;background-size:200% 100% !important}'
        /* ── transparent separators / borders ── */
        +'.inner-foot{border-top-color:rgba(7,13,36,.09) !important}'
        +'.prof-tab-nav,.tab-nav,.section-divider{border-bottom-color:rgba(7,13,36,.09) !important}'
        /* ── hardcoded white CSS-class text colors ── */
        +'.form-card-title,.ord-title,.sec-ttl,.od-meta-val,.ofr-nm,.ofr-cell-val,.lc-kpi .v,.t-uname{color:#0F172A !important}'
        +'.lc-ph-main h2,.lc-ring b,.lc-tltop h4,.ord-name a,.pref-label,.inp-label,.prog-label{color:#0F172A !important}'
        /* ── tab nav buttons ── */
        +'.prof-tab-btn,.rep-tab-btn,.tab-btn{color:#475569 !important}'
        +'.prof-tab-btn.active,.rep-tab-btn.active,.tab-btn.active{color:#0F8A7F !important;border-bottom-color:#0F8A7F !important}'
        /* ── od-meta-item / ofr-cell mini info boxes ── */
        +'.od-meta-item,.ofr-cell{background:#fff !important;border-color:#E7EAF1 !important}'
        /* ── od-card (very transparent card) ── */
        +'.od-card{background:#fff !important;border-color:#E7EAF1 !important}'
        /* ── lc-ring / pl-ring donut chart ── */
        +'.lc-ring::before,.pl-ring::before{background:#EEF2FA !important}'
        +'.lc-ring{background:conic-gradient(#0F8A7F 60%,rgba(7,13,36,.12) 0) !important}'
        /* ── lc-proginfo headings ── */
        +'.lc-proginfo .t{color:#0F172A !important}'
        /* ── misc white text CSS classes ── */
        +'.escrow-contract-name,.lc-msg-h b,.lc-tl-hd,.lc-msg-txt,.acc-name{color:#0F172A !important}'
        /* ── wizard stepper steps ── */
        +'.wr-step-num{background:#EEF2FA !important;border-color:#D8DFEC !important;color:#475569 !important}'
        +'.wr-step.active .wr-step-num{background:linear-gradient(135deg,#2BD4C7,#2B7FFF) !important;border-color:transparent !important;color:#fff !important}'
        +'.wr-step.done .wr-step-num{background:rgba(15,138,127,.12) !important;border-color:rgba(15,138,127,.35) !important;color:#0F8A7F !important}'
        /* ── lc-msg separators ── */
        +'.lc-msg{border-bottom-color:rgba(7,13,36,.07) !important}'
        +'.lc-mbar{border-top-color:rgba(7,13,36,.07) !important}'
        /* ── fr-search input ── */
        +'.fr-search input{color:#0F172A !important}'
        +'.fr-search{border-inline-start-color:rgba(7,13,36,.09) !important}'
        /* ── f-inp (wizard/form input variant) ── */
        +'.f-inp,.f-sel{background:#fff !important;border-color:#D8DFEC !important;color:#0F172A !important}'
        /* ── modal ── */
        +'.modal{background:#fff !important;border-color:#E7EAF1 !important}'
        /* ── toggle switch ── */
        +'.sw-track{background:rgba(7,13,36,.18) !important}'
        /* ── set-field rows ── */
        +'.set-field{border-bottom-color:rgba(7,13,36,.08) !important}'
        /* ── chat page ── */
        +'.msg-bubble.other{background:#fff !important;border-color:#E7EAF1 !important;color:#1E293B !important}'
        +'.msg-bubble.sent{color:#0F172A !important}'
        +'.msg-date-divider span{background:#EEF2FA !important;color:#475569 !important}'
        +'.msg-date-divider::before{background:rgba(7,13,36,.10) !important}'
        +'.msg-input-wrap,.msg-input-area{background:rgba(255,255,255,.92) !important;border-top-color:rgba(7,13,36,.08) !important;backdrop-filter:blur(12px) !important}'
        +'.msg-input-wrap textarea,.msg-input-wrap input{color:#0F172A !important}'
        +'.msg-hdr-name{color:#0F172A !important}'
        +'.conv-panel,.conv-panel-hdr,.msg-hdr{border-color:rgba(7,13,36,.08) !important}'
        +'.conv-search{background:#fff !important;border-color:#D8DFEC !important}'
        +'.conv-search input{color:#0F172A !important}'
        /* ── CSS vars override for light ── */
        +'body{--msg-recv-bg:rgba(7,13,36,.04) !important;--msg-recv-bd:rgba(7,13,36,.09) !important;--compose-bg:rgba(255,255,255,.97) !important;--compose-bd:rgba(7,13,36,.08) !important;--ifooter-bg:rgba(246,248,252,.97) !important;--ifooter-bd:rgba(7,13,36,.08) !important}'
        /* ── stat-box ── */
        +'.stat-box{background:#fff !important;border-color:#E7EAF1 !important;box-shadow:0 1px 4px rgba(15,23,42,.06) !important}'
        +'.stat-num{color:#0F172A !important}'
        +'.stat-lbl{color:#475569 !important}'
        /* ── ord-tbl / rep-tbl ── */
        +'.ord-tbl-wrap,.rep-tbl-wrap{background:#fff !important;border-color:#E7EAF1 !important}'
        +'.ord-tbl thead th,.rep-tbl thead th{color:#475569 !important;border-bottom-color:#E7EAF1 !important}'
        +'.ord-tbl tbody td,.rep-tbl tbody td{color:#1E293B !important;border-bottom-color:#F1F5F9 !important}'
        +'.ord-tbl tbody tr:hover,.rep-tbl tbody tr:hover{background:rgba(7,13,36,.04) !important}'
        +'.ord-name{color:#0F172A !important}'
        /* ── filter chips ── */
        +'.filter-chip{background:#EEF3FC !important;border-color:#C9D6F0 !important;color:#1E3A6E !important}'
        +'.filter-chip:hover{background:#DDE8F8 !important;color:#0F172A !important}'
        +'.filter-chip.active{background:rgba(15,138,127,.12) !important;border-color:rgba(15,138,127,.5) !important;color:#0A6F64 !important}'
        +'.filter-chip .fc-count{background:rgba(15,138,127,.15) !important;color:#0A6F64 !important}'
        +'.filter-chip.active .fc-count{background:rgba(15,138,127,.20) !important;color:#0A6F64 !important}'
        /* ── prof-tab-nav / underline tabs ── */
        +'.prof-tab-nav{border-bottom-color:#D8DFEC !important}'
        +'.prof-tab-btn{color:#475569 !important}'
        +'.prof-tab-btn.active{color:#0F8A7F !important;border-bottom-color:#0F8A7F !important}'
        +'.prof-tab-btn:hover:not(.active){color:#0F172A !important;background:rgba(7,13,36,.04) !important}'
        /* ── opill badges ── */
        +'.op-active{background:rgba(15,169,154,.12) !important;color:#0A6F64 !important}'
        +'.op-draft{background:rgba(7,13,36,.06) !important;color:#475569 !important}'
        +'.op-done{background:rgba(43,127,255,.10) !important;color:#1A5FCC !important}'
        +'.op-cancel{background:rgba(255,180,0,.12) !important;color:#8A5A00 !important}'
        +'.op-dispute{background:rgba(255,140,105,.10) !important;color:#B34000 !important}'
        /* ── pref-sec-ttl ── */
        +'.pref-sec-ttl{color:#475569 !important}'
        /* ── inline hardcoded dark-mode text colors ── */
        /* #6B7699 = secondary/muted text in dark → must darken in light */
        +'[style*="color:#6B7699"]{color:#475569 !important}'
        +'[style*="color: #6B7699"]{color:#475569 !important}'
        /* #A8B2D1 = tertiary/dim text in dark → must darken in light */
        +'[style*="color:#A8B2D1"]{color:#5B6472 !important}'
        +'[style*="color: #A8B2D1"]{color:#5B6472 !important}'
        /* #8892B0 dim text in dark */
        +'[style*="color:#8892B0"]{color:#5B6472 !important}'
        /* #2BD4C7 bright teal hardcoded inline → replace with accessible teal in light */
        +'[style*="color:#2BD4C7"]{color:#0F8A7F !important}'
        +'[style*="color: #2BD4C7"]{color:#0F8A7F !important}'
        /* ── بطاقة المستوى والولاء (level-loyalty card) ── */
        /* المشكلة: خلفية rgba شفافة + progress track أبيض = يختفي في الفاتح */
        +'[aria-label="مستوى الولاء"]{background:linear-gradient(135deg,rgba(15,138,127,.09),rgba(43,127,255,.06)) !important;border-color:rgba(15,138,127,.25) !important}'
        +'[aria-label="مستوى الولاء"] [role="progressbar"]{background:rgba(7,13,36,.10) !important}'
        +'[aria-label="مستوى الولاء"] [role="progressbar"]>div{background:linear-gradient(90deg,#0F8A7F,#2B7FFF) !important}';
    } else if(pcss){ pcss.remove(); }
    var TXT=light?darkFor:lightFor, BC=light?BORDER:'rgba(255,255,255,.16)';
    // --- donut/ring conic-gradient track fix (light mode) ---
    if(light){
      var allEls=document.querySelectorAll('[class*="ring"],[class*="donut"],[class*="pl-ring"],[class*="lc-ring"]');
      for(var d=0;d<allEls.length;d++){
        var de=allEls[d], cs2=getComputedStyle(de);
        var bg2=cs2.backgroundImage||cs2.background||'';
        // Replace transparent/white track in conic-gradient with visible gray
        if(bg2.indexOf('conic-gradient')!==-1 || de.style.background.indexOf('conic-gradient')!==-1){
          var src=de.style.background||bg2;
          // Replace white/transparent track colors
          var fixed=src.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0\.[0-9]+|\.0[0-9])\s*\)/g,'rgba(7,13,36,.14)');
          if(fixed!==src) de.style.setProperty('background',fixed,'important');
          // Fix ::before (center hole) — must be EEF2FA not dark
          // Apply via unique data attr + dynamic rule
          de.setAttribute('data-ws-ring','1');
        }
        // Fix inner text color
        var innerB=de.querySelector('b,span');
        if(innerB) innerB.style.setProperty('color','#0F172A','important');
      }
      // Inject ::before fix for rings
      var ringFix=document.getElementById('ws-ring-fix');
      if(!ringFix){
        ringFix=document.createElement('style');
        ringFix.id='ws-ring-fix';
        document.head.appendChild(ringFix);
      }
      ringFix.textContent='[data-ws-ring="1"]::before{background:#EEF2FA !important}';
    } else {
      var rf=document.getElementById('ws-ring-fix'); if(rf) rf.remove();
      // Remove data-ws-ring attrs
      var rElems=document.querySelectorAll('[data-ws-ring]');
      for(var ri=0;ri<rElems.length;ri++) rElems[ri].removeAttribute('data-ws-ring');
    }
    // --- AI identity: force AI-family icons to AI purple (both modes) ---
    var AIC=light?'#6B27A5':'#A56BE0';
    var us=document.getElementsByTagName('use');
    for(var q=0;q<us.length;q++){ var hh=us[q].getAttribute('href')||us[q].getAttribute('xlink:href')||''; if(/#(i-ai|ws-trust-ai|ws-ai-)/.test(hh)){ var sv=us[q].closest('svg'); if(sv) setP(sv,'color',AIC); } }
    var all=document.body.getElementsByTagName('*');
    for(var i=0;i<all.length;i++){
      var el=all[i], cs=getComputedStyle(el);
      var cls=(typeof el.className==='string')?el.className:'';
      // --- glass for dropdowns / modals (light only; dark is glassy by design) ---
      if(light && /\b(user-dropdown|modal-box|modal-ov|modal-overlay|spec-modal)\b/.test(cls)){
        var bgc=pc(cs.backgroundColor);
        if(bgc && bgc.a>0.5 && lum(bgc)>0.6){ setP(el,'background',GLASS); setP(el,'backdrop-filter','blur(22px)'); setP(el,'-webkit-backdrop-filter','blur(22px)'); }
      }
      // --- light card surface+depth: force neutral cards to white #fff so they pop on the tinted page ---
      if(light){ var rad=parseFloat(cs.borderTopLeftRadius)||0; var rcc=el.getBoundingClientRect();
        var colored=/ai-|sc-rec|verdict|sens|escrow|free-bar|teal|tier|banner|disclosure/.test(cls);
        if(rad>=10 && rcc.width>=200 && rcc.height>=56 && !colored){ var eb=effBg(el,1,base); var sat=Math.max(eb.r,eb.g,eb.b)-Math.min(eb.r,eb.g,eb.b);
          if(lum(eb)>0.8 && sat<16){ setP(el,'background','#FFFFFF'); setP(el,'box-shadow','0 2px 10px rgba(15,23,42,.08),0 1px 3px rgba(15,23,42,.05)'); } } }
      if(!visible(el)) continue;
      var rc=el.getBoundingClientRect();
      // --- text ---
      var txt=directText(el);
      if(txt && /[\p{L}\p{N}]/u.test(txt) && !/sr-only|visually-hidden|screen-reader/i.test(cls) && rc.width>=4 && rc.height>=4 && !(el.closest&&(el.closest('.t-toggle')||el.closest('.btn-primary')||el.closest('.search-btn')||el.closest('.svc-lvl,.pc-lvl,.pcard-lvl,.cg-lvl,.prov-level,.ws-level-tag,.name-level-tag,.result-level-pill,.avatar-level-badge,.mem-level,.bk-comm-level,[class*="lvl-badge" i],[class*="level-badge" i],[class*="level-tag" i],[class*="level-pill" i]')))){
        var clipped=(cs.webkitTextFillColor && /rgba\(0, 0, 0, 0\)|transparent/.test(cs.webkitTextFillColor)) || cs.webkitBackgroundClip==='text' || cs.backgroundClip==='text';
        if(!clipped){
          var fg=pc(cs.color);
          if(fg){
            var fgo0=fg.a<1?{r:fg.r,g:fg.g,b:fg.b,a:1}:fg, fgL=lum(fgo0);
            var bg=effBg(el,fgL,base);
            var fgo=fg.a<1?over(fg,bg):fg;
            var r=ratio(fgo,bg);
            if(r<3){
              var sat=Math.max(bg.r,bg.g,bg.b)-Math.min(bg.r,bg.g,bg.b);
              var exA=lum(fgo)>lum(bg)&&lum(bg)<0.18&&sat>40, exB=lum(fgo)<lum(bg)&&lum(bg)>0.82&&sat>40;
              if(!exA&&!exB){ var cand=TXT(fgo); var cc=hexC(cand); if(cc && ratio(cc,bg)<3) cand=light?'#0F172A':'#FFFFFF'; setP(el,'color',cand); }
            }
          }
        }
      }
      // --- borders / dividers ---
      if(rc.width>=8 && rc.height>=5){
        var sides=['top','right','bottom','left'];
        for(var s=0;s<sides.length;s++){
          var bw=parseFloat(cs.getPropertyValue('border-'+sides[s]+'-width'));
          if(!bw||bw<1) continue;
          var bcol=pc(cs.getPropertyValue('border-'+sides[s]+'-color'));
          if(!bcol||bcol.a<0.01) continue;
          var back=effBg(el.parentElement||el,0,base);
          var bco=bcol.a<1?over(bcol,back):bcol;
          if(ratio(bco,back)<1.16 && (light?lum(bco)>0.6:lum(bco)<0.4)){ setP(el,'border-'+sides[s]+'-color',BC); }
        }
      }
    }
  }

  var t=null, mo=null;
  function schedule(){ if(t) clearTimeout(t); t=setTimeout(run,80); }
  function reconnect(){ try{ if(mo&&document.body) mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','id']}); }catch(e){} }
  function setupToggle(){
    if(!document.getElementById('ws-toggle-base')){
      var st=document.createElement('style'); st.id='ws-toggle-base';
      st.textContent='.t-toggle .seg,.theme-toggle .seg{display:inline-flex !important;align-items:center;justify-content:center;gap:5px}'
        +'.t-toggle .seg svg,.theme-toggle .seg svg{width:12px;height:12px;flex-shrink:0}'
        +'.t-toggle .seg.is-selected::before,.theme-toggle .seg.is-selected::before{display:none !important}'
        +'select option,select optgroup{color:#1E293B !important;background:#FFFFFF !important}';
      (document.head||document.documentElement).appendChild(st);
    }
    var SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"></path></svg>';
    var MOON='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path></svg>';
    var segs=document.querySelectorAll('.t-toggle .seg,.theme-toggle .seg,#theme-toggle .seg');
    for(var i=0;i<segs.length;i++){ var s=segs[i];
      if(s.querySelector('svg')) continue;
      var id=(s.id||'').toLowerCase(), txt=(s.textContent||'').replace(/\s/g,'');
      if(id.indexOf('dark')>-1 || txt==='داكن') s.insertAdjacentHTML('afterbegin',MOON);
      else if(id.indexOf('light')>-1 || txt==='فاتح') s.insertAdjacentHTML('afterbegin',SUN);
    }
  }
  // ===== site-only build: dashboard sidebar/dropdown builders removed =====
  function setupSidebarAD(){}
  function setupSidebarAF(){}
  function setupSidebarPR(){}
  function setupSidebar(){}
  function setupSidebarSKCO(){}
  function setupRoleSwitcher(){}
  function setupDropdown(){}
  function activateSidebar(){}
  function applyRoleFilter(){}
  function wsRole(){ return "individual"; }
  function fixChatLink(){}
  function init(){
    try{ mo=new MutationObserver(schedule); }catch(e){}
    /* z-index:1 enforcement */
    (function(){var m=document.querySelector('.main');if(m&&(m.style.zIndex==='2'||m.style.cssText.indexOf('z-index:2')>-1)){m.style.zIndex='1';}})();
    /* Global glassmorphism select styling */
    (function(){
      if(document.getElementById('ws-select-style')) return;
      var ss=document.createElement('style');
      ss.id='ws-select-style';
      ss.textContent='select{-webkit-appearance:none;appearance:none;background-color:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:10px;color:#fff;font-family:\'Tajawal\',system-ui,sans-serif;font-size:13px;padding:10px 14px;cursor:pointer;outline:none;transition:border-color .15s;width:100%}select:focus{border-color:rgba(43,212,199,.4)!important}select option{background-color:#0B1437;color:#fff}';
      document.head.appendChild(ss);
    })();
    /* Global filter chips CSS */
    (function(){
      var fc=document.getElementById('ws-filter-chips');
      if(fc)return;
      fc=document.createElement('style');
      fc.id='ws-filter-chips';
      fc.textContent='.filter-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.filter-chip{padding:7px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:20px;font-size:12px;font-weight:700;color:#A8B2D1;cursor:pointer;font-family:inherit}.filter-chip:hover{background:rgba(255,255,255,.08);color:#fff}.filter-chip.active{background:rgba(43,212,199,.12);border-color:rgba(43,212,199,.30);color:#2BD4C7}.filter-chip .fc-count{min-width:18px;height:18px;border-radius:9px;background:rgba(255,255,255,.08);font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 5px;margin-inline-start:4px}';
      document.head.appendChild(fc);
    })();
    /* Global AI disclosure SVG fix — prevents unsized SVG from expanding */
    (function(){
      if(document.getElementById('ws-ai-disc-fix'))return;
      var ad=document.createElement('style');
      ad.id='ws-ai-disc-fix';
      ad.textContent='.ai-disclosure>svg{width:16px!important;height:16px!important;flex-shrink:0!important;color:#7B2FBE!important}';
      document.head.appendChild(ad);
    })();
    /* Global glassmorphism modal styling */
    (function(){
      if(document.getElementById('ws-modal-glass')) return;
      var mg=document.createElement('style');
      mg.id='ws-modal-glass';
      mg.textContent=
        '.modal-box,.lc-mbox{background:linear-gradient(135deg,rgba(11,20,55,.92),rgba(7,13,36,.95))!important;backdrop-filter:blur(28px)!important;-webkit-backdrop-filter:blur(28px)!important;border:1px solid rgba(255,255,255,.12)!important;border-radius:16px!important}'
       +'.modal-box input,.modal-box input[type="text"],.modal-box input[type="number"],.modal-box textarea,.modal-box select,'
       +'.lc-mbox .lc-inp,.lc-mbox .lc-ta,.lc-mbox .lc-sel,.lc-mbox input,.lc-mbox select'
       +'{background:rgba(255,255,255,.05)!important;border:1px solid rgba(255,255,255,.12)!important;color:#fff!important;border-radius:10px!important}'
       +'.modal-box input:focus,.modal-box textarea:focus,.modal-box select:focus,.lc-mbox .lc-inp:focus,.lc-mbox .lc-ta:focus,.lc-mbox .lc-sel:focus{border-color:rgba(43,212,199,.45)!important;outline:none!important}'
       +'.modal-ttl,.modal-box h3,.lc-mbox h3{color:#fff!important;font-weight:900!important}'
       +'.form-lbl,.lc-fld>label{color:#A8B2D1!important;font-size:13px!important;font-weight:700!important;margin-bottom:7px!important;display:block!important}'
       +'.modal-close,.lc-mclose{background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.12)!important;color:#A8B2D1!important;border-radius:8px!important}'
       +'.modal-close:hover,.lc-mclose:hover{background:rgba(255,255,255,.14)!important;color:#fff!important}'
       +'.btn-cancel,.lc-btn-gh{background:rgba(255,255,255,.07)!important;border:1px solid rgba(255,255,255,.12)!important;color:#A8B2D1!important;border-radius:10px!important}'
       +'.btn-cancel:hover,.lc-btn-gh:hover{background:rgba(255,255,255,.14)!important;color:#fff!important}'
       +'.modal-sep,.lc-sep{background:rgba(255,255,255,.08)!important}'
       +'.rq{color:#FF8C69!important}';
      document.head.appendChild(mg);
    })();
    /* Central Light CSS — page elements only, modals stay dark */
    var CL_CSS='body{background:#EEF2FA}.topbar{background:rgba(246,248,252,.96)!important;border-bottom-color:rgba(43,127,255,.14)!important}.t-page,.t-uname{color:#070D24!important}.sidebar{background:rgba(246,248,252,.94)!important;border-color:rgba(7,13,36,.10)!important}.sb-item{color:#56607D!important}.sb-item.active{background:rgba(43,212,199,.10)!important;color:#007A72!important}.state-card{background:#fff!important;border-color:#E7EAF1!important}.inner-foot{border-top-color:#E7EAF1!important}';
    /* Light mode select fix */
    CL_CSS+='select{background-color:rgba(7,13,36,.06)!important;border-color:rgba(7,13,36,.20)!important;color:#0F172A!important}select option{background-color:#F6F8FC;color:#0F172A}';
    function _applyClLight(){var t=null;try{t=localStorage.getItem('ws-theme')||localStorage.getItem('waseet_theme');}catch(x){}var isL=t==='light'||(document.body&&(document.body.classList.contains('light-theme')||document.body.classList.contains('theme-light')))||(document.documentElement&&(document.documentElement.classList.contains('light-theme')||document.documentElement.classList.contains('theme-light')));var s=document.getElementById('ws-cl');if(isL){if(!s){s=document.createElement('style');s.id='ws-cl';document.head.appendChild(s);}s.textContent=CL_CSS;}else{if(s)s.remove();}}
    _applyClLight();
    document.addEventListener('click',function(e){var el=e.target.closest&&e.target.closest('#btn-light,#btn-dark,#btnLight,#btnDark,.seg,[data-theme]');if(el)setTimeout(_applyClLight,120);},true);
    /* Also re-check _applyClLight when body/html class changes (Angular ThemeService) */
    if('MutationObserver' in window){ try{ var clMo=new MutationObserver(function(){_applyClLight();}); clMo.observe(document.documentElement,{attributes:true,attributeFilter:['class']}); clMo.observe(document.body,{attributes:true,attributeFilter:['class']}); }catch(e){} }
    setupToggle();
    fixChatLink();
    setupSidebarSKCO();
    setupSidebar();
    setupSidebarPR();
    setupSidebarAF();
    setupSidebarAD();
    setupDropdown();
    run();
    document.addEventListener('click', function(e){
      var el=e.target.closest && e.target.closest('#btn-light,#btn-dark,#btnLight,#btnDark,.seg,[data-theme]');
      if(el) setTimeout(run,60);
    }, true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
