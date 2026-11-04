const { chromium } = require('playwright');
const D='/tmp/claude-0/-home-user-Colonist/d9ceb834-54a4-5da3-a5eb-477cce8e55d6/scratchpad/lab110/shots/';
(async()=>{
 const b=await chromium.launch();
 for (const [name,pal] of [['sunny','light'],['night','night']]) {
  const ctx=await b.newContext({viewport:{width:360,height:780},deviceScaleFactor:2,hasTouch:true,isMobile:true});
  const p=await ctx.newPage();
  await p.addInitScript(pal=>{try{localStorage.setItem('colonist.palette',pal)}catch(e){}},pal);
  await p.goto('http://localhost:8110/lab.html');
  await p.waitForFunction(()=>window.__lab&&window.__lab.ready,null,{timeout:60000});
  await p.waitForTimeout(2500);
  await p.screenshot({path:D+`audit-${name}-1-analysis.png`});
  await p.screenshot({path:D+`audit-${name}-2-analysis-full.png`,fullPage:true});
  await p.tap('#tabTournament'); await p.waitForTimeout(800);
  await p.screenshot({path:D+`audit-${name}-3-tournament-top.png`});
  await p.locator('#labLineupCard').scrollIntoViewIfNeeded();
  await p.evaluate(()=>document.querySelector('#labLineupCard').scrollIntoView({block:'start'}));
  await p.screenshot({path:D+`audit-${name}-4-lineup.png`});
  await p.tap('#labLineup button[data-lu=h2h]'); await p.waitForTimeout(300);
  await p.screenshot({path:D+`audit-${name}-5-h2h.png`});
  await p.tap('#labLineup button[data-lu=field]');
  await p.tap('#labSpeed button[data-speed=instant]');
  await p.tap('#labGames button[data-g="10"]');
  await p.tap('#labRun');
  await p.waitForFunction(()=>window.__lab.sim.done>=3,null,{timeout:120000});
  await p.evaluate(()=>document.querySelector('#labStand').scrollIntoView({block:'start'}));
  await p.screenshot({path:D+`audit-${name}-6-running.png`});
  await p.waitForFunction(()=>!window.__lab.sim.running,null,{timeout:180000});
  await p.waitForTimeout(500);
  await p.evaluate(()=>document.querySelector('#labSummary').scrollIntoView({block:'start'}));
  await p.screenshot({path:D+`audit-${name}-7-results.png`});
  await p.screenshot({path:D+`audit-${name}-8-results-full.png`,fullPage:true});
  await ctx.close();
 }
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
