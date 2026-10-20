// VPEX regression check (demo_trial). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/demo_trial.js
const { chromium } = require('playwright');
const BASE=(process.env.BASE || 'http://127.0.0.1:8765/index.html'), OUT=(process.env.SHOTS || require('os').tmpdir());
let pass=0, fail=0; const check=(n,ok,i)=>{ if(ok)pass++; else {fail++; console.log('FAIL',n,i===undefined?'':JSON.stringify(i));} };
async function mk(br,c){ const ctx=await br.newContext({viewport:{width:c.w,height:844},colorScheme:c.s,isMobile:c.w<500,hasTouch:c.w<500}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); await p.route(/gstatic\.com\/firebasejs/, r=>r.abort()); return {ctx,p,errs}; }
(async()=>{ const br=await chromium.launch();
 const CF=[{n:'p-dark',w:390,s:'dark'},{n:'p-light',w:390,s:'light'},{n:'small',w:320,s:'dark'},{n:'desk',w:1280,s:'light'}];
 for (const o of ['insurance','realestate','mca','auto','solar']) for (const c of CF) { const tag=o+'/'+c.n; const {ctx,p,errs}=await mk(br,c);
  await p.goto(BASE+'#demo-'+o); await p.waitForTimeout(2000);
  const s=await p.evaluate(()=>{ const t=document.getElementById('demoTrial'), x=document.getElementById('demoExit'), pill=document.querySelector('.demo-pill'); const r=t&&t.getBoundingClientRect(), rx=x&&x.getBoundingClientRect();
    return { t: t&&t.textContent, x: x&&x.textContent, th: r&&r.height, xh: rx&&rx.height, xw: rx&&rx.width, ph: pill.getBoundingClientRect().height, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
  check(tag+' trial button', s.t==='Start free trial', s); check(tag+' exit button', s.x==='Exit', s);
  check(tag+' buttons >= 36px tall', s.th>=36 && s.xh>=36 && s.xw>=44, s); check(tag+' bar on one line', s.ph<=50, s); check(tag+' no overflow', s.sw<=s.vw, s);
  if (o==='solar' && (c.n==='p-light'||c.n==='small')) await p.screenshot({path:`${OUT}/trial-${o}-${c.n}.png`, clip:{x:0,y:0,width:c.w,height:200}});
  if (c.n==='p-dark') {
    const nav=p.waitForURL(/\?trial=/,{timeout:5000}).catch(()=>null);
    await p.click('#demoTrial'); await nav; await p.waitForTimeout(800);
    const u=new URL(p.url()); check(tag+' tap: lands on ?trial='+o, u.searchParams.get('trial')===o && !u.hash, p.url());
    const ls=await p.evaluate(()=>localStorage.getItem('dovetail_demo')); check(tag+' tap: demo cleared', ls===null, ls);
  }
  check(tag+' no page errors', !errs.length, errs); await ctx.close(); }
 // Sales page (mock backend) with ?trial=: that industry picked, scrolled to the form, cursor in Office name, param removed
 for (const o of ['solar','mca','auto']) { const {ctx,p,errs}=await mk(br,{w:390,s:'light'});
  await p.goto(BASE+'?trial='+o+'#mockbench'); await p.waitForTimeout(2600);
  const s=await p.evaluate(()=>{ const f=document.getElementById('authSub').getBoundingClientRect(); return { ind: document.getElementById('suInd').value, top: Math.round(f.top), focus: document.activeElement && document.activeElement.id, url: location.href, hero: getComputedStyle(document.getElementById('authHero')).display }; });
  check('sales ?trial='+o+': industry picked', s.ind===o, s); check('sales ?trial='+o+': form in view', s.top>=-5 && s.top<300, s);
  check('sales ?trial='+o+': cursor in office name', s.focus==='suOffice', s); check('sales ?trial='+o+': param removed, hash kept', !/trial=/.test(s.url) && /#mockbench/.test(s.url), s.url);
  check('sales ?trial='+o+': sales page still there', s.hero!=='none', s);
  if (o==='solar') await p.screenshot({path:`${OUT}/trial-sales.png`});
  check('sales ?trial='+o+': no errors', !errs.length, errs); await ctx.close(); }
 { const {ctx,p,errs}=await mk(br,{w:390,s:'light'}); await p.goto(BASE+'?trial=bogus#mockbench'); await p.waitForTimeout(2200);
   const s=await p.evaluate(()=>({ind:document.getElementById('suInd').value,url:location.href})); check('bogus industry: default kept', s.ind==='insurance', s); check('bogus: no errors', !errs.length, errs); await ctx.close(); }
 { const {ctx,p,errs}=await mk(br,{w:390,s:'light'}); await p.goto(BASE+'#mockbench'); await p.waitForTimeout(2200);
   const s=await p.evaluate(()=>({top:document.getElementById('authHero').getBoundingClientRect().top, focus:document.activeElement&&document.activeElement.id})); check('plain sales page: stays at the top', s.top<200 && s.focus!=='suOffice', s); check('plain: no errors', !errs.length, errs); await ctx.close(); }
 await br.close(); console.log(`trial_test: ${pass} passed, ${fail} failed`); process.exit(fail?1:0); })();
