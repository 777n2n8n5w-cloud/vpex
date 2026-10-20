// VPEX regression check (history_badges). Run like tests/smoke.js: python3 -m http.server 8765 in the repo root, then NODE_PATH=<dir with playwright> node tests/history_badges.js
const { chromium } = require('playwright');
(async()=>{ const br=await chromium.launch(); const res={};
for (const sch of ['light','dark']) { const ctx=await br.newContext({viewport:{width:390,height:844},colorScheme:sch}); const p=await ctx.newPage();
await p.route(/gstatic|googleapis/, r=>r.abort()); await p.goto((process.env.BASE || 'http://127.0.0.1:8765/index.html') + '#demo-insurance'); await p.waitForTimeout(2000);
await p.evaluate(()=>[...document.querySelectorAll('.view-tab')].find(x=>x.textContent.trim()==='History').click()); await p.waitForTimeout(400);
const ids = sch==='light' ? [null, ...await p.evaluate(()=>[...new Set([...document.styleSheets].flatMap(s=>{try{return [...s.cssRules]}catch(e){return []}}).map(r=>(r.selectorText||'').match(/data-theme="([a-z0-9]+)"/)).filter(Boolean).map(m=>m[1]))])] : [null];
for (const id of ids) {
 const r=await p.evaluate(id=>{ if(id) document.documentElement.setAttribute('data-theme',id); else document.documentElement.removeAttribute('data-theme');
  const cv=document.createElement('canvas'); cv.width=cv.height=1; const g=cv.getContext('2d',{willReadFrequently:true});
  const px=c=>{g.clearRect(0,0,1,1); g.fillStyle='#000'; g.fillStyle=c; g.fillRect(0,0,1,1); return [...g.getImageData(0,0,1,1).data];};
  const lum=a=>{const m=a.slice(0,3).map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*m[0]+.7152*m[1]+.0722*m[2]};
  let worst=99, wk='';
  for (const el of document.querySelectorAll('.qi-status')) { const cs=getComputedStyle(el);
    let base=el.parentElement, bb; while(base){ bb=px(getComputedStyle(base).backgroundColor); if(bb[3]===255) break; base=base.parentElement; } if(!base) bb=[255,255,255,255];
    const t=px(cs.backgroundColor), a=t[3]/255, comp=[0,1,2].map(i=>t[i]*a+bb[i]*(1-a)); const fc=px(cs.color);
    const L1=lum(fc),L2=lum(comp), c=(Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05); if(c<worst){worst=c; wk=el.className;} }
  return [worst, wk]; }, id);
 res[(id||'auto')+'/'+sch]=r; }
await ctx.close(); }
const bad=Object.entries(res).filter(([k,v])=>v[0]<4.5); console.log('themes', Object.keys(res).length, 'under 4.5:', bad.length); bad.slice(0,30).forEach(b=>console.log(b[0], b[1][0].toFixed(2), b[1][1]));
console.log('history_badges: ' + (Object.keys(res).length - bad.length) + ' passed, ' + bad.length + ' failed'); process.exitCode = bad.length ? 1 : 0;
await br.close(); })();
