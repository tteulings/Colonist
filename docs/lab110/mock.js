// Injected mockups of the proposed standalone Tournament (Phase 1). Example numbers, not measured.
const { chromium } = require('playwright');
const D='/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lab110/shots/';
const CSS=`
.mk .tpl{display:flex;gap:6px;flex-wrap:wrap}
.mk .chip{border:var(--btn-border,1px solid rgba(0,0,0,.12));background:var(--btn);color:var(--ink);border-radius:999px;padding:6px 11px;font-size:12px;font-weight:650;min-height:34px}
.mk .chip.on{outline:2px solid var(--accent)}
.mk .seat{display:grid;grid-template-columns:14px 44px minmax(0,1fr) 22px;gap:9px;align-items:center;min-height:56px;border-top:1px solid var(--sep,rgba(0,0,0,.08))}
.mk .seat:first-of-type{border-top:0}
.mk .seat>i{width:12px;height:12px;border-radius:50%;background:var(--seat)}
.mk .av{position:relative;width:44px;height:44px;display:grid;place-items:center}
.mk .av .lf{position:absolute;inset:-6px;width:56px;height:56px;margin:0;left:-6px;top:-6px}
.mk .av .disc{width:34px;height:34px;border-radius:50%;background:var(--chip);display:grid;place-items:center}
.mk .seat b{display:block;font-size:14px;line-height:1.15}
.mk .seat small{color:var(--ink-soft);font-size:11.5px;display:flex;gap:6px;align-items:center}
.mk .dots i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--sep,rgba(0,0,0,.18));margin-right:2px}
.mk .dots i.on{background:var(--accent)}
.mk .ii{width:20px;height:20px;border-radius:50%;border:1.5px solid var(--ink-soft);color:var(--ink-soft);font:700 12px/17px Georgia,serif;text-align:center;display:inline-block;vertical-align:middle;margin-left:5px}
.mk .tog{display:flex;justify-content:space-between;align-items:center;min-height:40px;font-size:13px}
.mk .sw{width:40px;height:24px;border-radius:12px;background:var(--accent);position:relative}.mk .sw:after{content:"";position:absolute;right:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff}
.mk .sw.off{background:var(--sep,#bbb)}.mk .sw.off:after{right:auto;left:3px}
.mk .tbl{display:grid;grid-template-columns:minmax(0,1fr) 50px 36px 36px;gap:7px 6px;align-items:center;font-size:12.5px}
.mk .tbl .hd{font-size:10.5px;color:var(--ink-soft);font-weight:650}
.mk .tbl .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700}
.mk .who{display:flex;gap:7px;align-items:center;min-width:0;font-weight:700}
.mk .who .m{width:24px;height:24px;border-radius:50%;background:var(--chip);display:grid;place-items:center;flex:none;box-shadow:0 0 0 2px var(--seat)}
.mk .ci{display:block;color:var(--ink-soft);font-size:10.5px;font-weight:500}
.mk .bar{grid-column:1/-1;margin:-3px 0 4px}
.mk .verdict{font-family:var(--font-display);font-size:16px;line-height:1.25;margin:0}
.mk .verdict.ok{color:var(--accent)}
.mk .run{display:flex;gap:8px}.mk .run .lb-btn{flex:1}
.mk .sheet{position:fixed;left:0;right:0;bottom:0;max-height:78%;overflow:hidden;background:var(--bg);border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.35);padding:10px 12px 14px;z-index:50}
.mk .sheet h3{margin:4px 2px 8px;font-size:15px}
.mk .opt{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:46px;padding:3px 6px;border-radius:10px}
.mk .opt.on{background:var(--chip);outline:2px solid var(--accent)}
.mk .opt b{font-size:13.5px;display:block}.mk .opt small{color:var(--ink-soft);font-size:11px}
.mk .scrim{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:40}
.mk .rr{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:3px 9px;align-items:center;padding:9px 0;border-top:1px solid var(--sep,rgba(0,0,0,.08));font-size:12.5px}
.mk .rr:first-of-type{border-top:0}
.mk .rr .ck{width:20px;height:20px;border-radius:6px;border:2px solid var(--ink-soft)}.mk .rr .ck.on{background:var(--accent);border-color:var(--accent)}
.mk .rr .tt{font-weight:700}.mk .rr small{color:var(--ink-soft);display:block;font-weight:500;font-size:11px}
.mk .chips{display:flex;gap:3px;margin-top:2px}
.mk .chips .m{width:18px;height:18px;border-radius:50%;background:var(--chip);display:grid;place-items:center;box-shadow:0 0 0 1.5px var(--seat)}
.mk .cmp{background:var(--chip);border-radius:12px;padding:9px 10px;font-size:12.5px;margin-top:6px}
`;
const BODY = (m)=>{
 const {profileMini,levelFrame,BOT_PROFILES:P,FRAME_KIND}=m;
 const COL=['#D1453A','#3C75C6','#F08A2E','#2A8556'];
 const dots=n=>`<span class="dots">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
 const mini=(k,s=18)=>profileMini(k,s);
 const av=(k)=>`<span class="av">${levelFrame(k==='mine'?'custom':k,44)}<span class="disc">${k==='mine'?'<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 11l7-7 3 3-7 7H2zM8 5l3 3"/></svg>':mini(k,22)}</span></span>`;
 const seat=(i,k,sub)=>`<div class="seat" style="--seat:${COL[i]}"><i></i>${av(k)}<div><b>${k==='mine'?'My custom bot':P[k].label}</b><small>${k==='mine'?sub:dots(P[k].level)+' '+P[k].tagline}</small></div><span class="ii">i</span></div>`;
 const m_=(k,i)=>`<span class="m" style="--seat:${COL[i]}">${mini(k,15)}</span>`;
 const band=(lo,hi,p,f,i)=>`<div class="lb-band bar" style="--seat:${COL[i]}"><span style="left:${lo}%;width:${hi-lo}%"></span><u style="left:${f}%"></u><em style="left:calc(${p}% - 1.5px)"></em></div>`;
 const row=(i,k,lbl,p,lo,hi,vp,t,f=25)=>`<span class="who"><span class="m" style="--seat:${COL[i]}">${mini(k,15)}</span>${lbl}</span><span class="num">${p}%<span class="ci">±${((hi-lo)/2).toFixed(0)}</span></span><span class="num">${vp}</span><span class="num">${t}</span>${band(lo,hi,p,f,i)}`;
 const settings=`<div class="lb-card"><div class="lb-row"><span>Games</span><div class="lb-seg"><button>20</button><button class="on">100</button><button>200</button><button>500</button></div></div>
  <div class="lb-row"><span>Board</span><div class="lb-seg"><button class="on">Random</button><button>Balanced</button></div></div>
  <div class="tog"><span>Everyone plays every seat<span class="ii">i</span></span><span class="sw"></span></div>
  <div class="tog"><span>Same dice for all<span class="ii">i</span></span><span class="sw"></span></div>
  <div class="lb-row"><span>Speed</span><div class="lb-seg"><button>Watch</button><button class="on">Instant</button></div></div>
  <button class="lb-btn primary">Start 100 games · about 2 min</button></div>`;
 return {
 lineup:`<div class="mk"><div class="lb-card"><div class="lt-head"><h2>Line-up</h2><small>4 seats</small></div>
  <div class="lb-seg" style="margin-bottom:8px"><button>2</button><button>3</button><button class="on">4</button><button disabled>5-6</button></div>
  <div class="tpl" style="margin-bottom:6px"><button class="chip on">1 vs 3</button><button class="chip">Round robin</button><button class="chip">Mirror</button><button class="chip">Shuffle</button></div>
  ${seat(0,'expert')}${seat(1,'intermediate')}${seat(2,'intermediate')}${seat(3,'intermediate')}
  <p class="lb-fine" style="margin-top:6px">Tap a seat to pick its bot.</p></div>${settings}</div>`,
 pick:`<div class="mk"><div class="scrim"></div><div class="sheet"><h3>Seat 2 · pick a bot</h3>
  <div class="opt on"><span class="av" style="width:34px;height:34px">${levelFrame('custom',34)}<span class="disc" style="width:26px;height:26px">✎</span></span><div><b>My custom bot</b><small>made in Analysis · Intermediate + 2 weights</small></div><span class="ii">i</span></div>
  ${['master','expert','builder','trader','shark','intermediate','beginner','simple'].map(k=>`<div class="opt"><span class="av" style="width:34px;height:34px">${levelFrame(k,34)}<span class="disc" style="width:26px;height:26px">${mini(k,17)}</span></span><div><b>${P[k].label}</b><small>${P[k].tagline}</small></div>${dots(P[k].level)}</div>`).join('')}
  <div class="opt" style="opacity:.5"><span style="width:34px"></span><div><b>Super Expert</b><small>added when it ships</small></div></div></div></div>`,
 run:`<div class="mk"><div class="lb-card"><div class="lt-head"><h2>Running</h2><small>41 of 100 · about 70 s left</small></div><div class="lb-prog"><i style="width:41%"></i></div>
  <div class="tbl" style="margin-top:10px"><span class="hd">bot</span><span class="hd" style="text-align:right">wins</span><span class="hd" style="text-align:right">VP</span><span class="hd" style="text-align:right">turns</span>
  ${row(0,'expert','Expert',46,32,61,8.4,71)}${row(1,'intermediate','Intermediate ×3',18,15,22,7.1,71,75)}</div>
  <p class="lb-fine">Still too close to call. Bars narrow as games finish.</p><button class="lb-btn stop" style="margin-top:6px">Stop (41/100)</button></div></div>`,
 res:`<div class="mk"><div class="lb-card"><div class="lt-head"><h2>Result</h2><small>100 games · Random · same dice</small></div>
  <p class="verdict ok">Expert beats Intermediate: 41% vs 20% each. 95% sure.</p>
  <div class="tbl" style="margin-top:12px"><span class="hd">bot (n = games)</span><span class="hd" style="text-align:right">wins ±95%</span><span class="hd" style="text-align:right">VP</span><span class="hd" style="text-align:right">turns</span>
  ${row(0,'expert','Expert · 100',41,32,51,8.9,72)}${row(1,'intermediate','Intermediate · 100',20,13,28,7.3,72,25)}${row(2,'intermediate','Intermediate · 100',20,13,28,7.2,72,25)}${row(3,'intermediate','Intermediate · 100',19,12,27,7.2,72,25)}</div>
  <p class="lb-fine">Line = even share (25%). Same bot in several seats is one row each.</p>
  <div class="run" style="margin-top:8px"><button class="lb-btn primary">Save run</button><button class="lb-btn">Run again</button></div>
  <div style="display:flex;gap:14px;margin-top:8px"><button class="lb-link">Swap seats</button><button class="lb-link">Share result</button></div></div>
  <div class="lb-card"><div class="lt-head"><h2>Unsure case</h2><small>example</small></div><p class="verdict">Expert and Builder: no clear difference yet. Run more games.</p><p class="lb-fine">38% vs 33%, 100 games each. Needs about 400 games to tell apart.</p></div></div>`,
 saved:`<div class="mk"><div class="lb-card"><div class="lt-head"><h2>Saved runs</h2><small>on this phone · 3 selected max 2</small></div>
  <div class="rr"><span class="ck on"></span><div><span class="tt">Expert vs 3× Intermediate</span><small>Today 14:02 · 100 games · Random</small><span class="chips">${m_('expert',0)}${m_('intermediate',1)}${m_('intermediate',2)}${m_('intermediate',3)}</span></div><b>41%</b></div>
  <div class="rr"><span class="ck on"></span><div><span class="tt">My custom bot vs 3× Intermediate</span><small>Today 13:41 · 100 games · Random</small><span class="chips">${m_('intermediate',0)}${m_('intermediate',1)}${m_('intermediate',2)}${m_('intermediate',3)}</span></div><b>29%</b></div>
  <div class="rr"><span class="ck"></span><div><span class="tt">Round robin: Shark, Builder, Trader, Expert</span><small>Yesterday · 200 games · Balanced</small><span class="chips">${m_('shark',0)}${m_('builder',1)}${m_('trader',2)}${m_('expert',3)}</span></div><b>–</b></div>
  <div class="cmp"><b>Compare</b><br>Expert 41% vs My custom bot 29%: both against 3× Intermediate, same dice. <b>Gap 12 points, 90% sure.</b></div>
  <div class="run" style="margin-top:8px"><button class="lb-btn">Compare 2</button><button class="lb-btn">Delete</button></div></div></div>`};
};
(async()=>{
 const b=await chromium.launch();
 for (const [name,pal] of [['sunny','light'],['night','night']]) {
  const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const p=await ctx.newPage();
  await p.addInitScript(pal=>{try{localStorage.setItem('colonist.palette',pal)}catch(e){}},pal);
  await p.goto('http://localhost:8110/lab.html');
  await p.waitForFunction(()=>window.__lab&&window.__lab.ready,null,{timeout:60000});
  await p.tap('#tabTournament'); await p.waitForTimeout(600);
  await p.addStyleTag({content:CSS});
  const mk=await p.evaluate(`import('/src/bot-profiles.js').then(m=>({k:Object.keys(m)}))`);
  for (const [key,file] of [['lineup','1-lineup'],['pick','2-picker'],['run','3-running'],['res','4-results'],['saved','5-saved']]) {
   await p.evaluate(async ([key,body])=>{
     const m=await import('/src/bot-profiles.js');
     document.querySelectorAll('.mk').forEach(e=>e.remove());
     const html=new Function('m','BODY','return ('+body+')(m)')(m,null)[key];
     const pane=document.querySelector('#paneTournament'); pane.querySelectorAll(':scope>*:not(.mk)').forEach(e=>e.style.display='none');
     pane.insertAdjacentHTML('beforeend',html);
     if(key==='pick'){ // keep the line-up behind the sheet
       const m2=new Function('m','BODY','return ('+body+')(m)')(m,null).lineup; pane.insertAdjacentHTML('afterbegin',m2); }
     document.querySelector('.lb-boardcol').style.display='none';
     window.scrollTo(0,0);
   },[key,BODY.toString()]);
   await p.waitForTimeout(300);
   await p.screenshot({path:D+`mock-${name}-${file}.png`});
   if(key==='lineup'||key==='res') await p.screenshot({path:D+`mock-${name}-${file}-full.png`,fullPage:true});
  }
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
