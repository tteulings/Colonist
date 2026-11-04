const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:360,height:780},hasTouch:true,isMobile:true})).newPage();
 p.on('pageerror',e=>console.log('PAGEERR',e.message)); p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 await p.goto('http://localhost:8110/lab.html');
 await p.waitForFunction(()=>window.__lab&&window.__lab.ready,null,{timeout:90000});
 await p.tap('#tabTournament'); await p.waitForTimeout(500);
 const t0=Date.now();
 const r=await p.evaluate(async()=>{ const L=window.__lab; L.st.speed='instant';
   const a=await L.runGames(8,{spec:['expert','intermediate','intermediate','intermediate']});
   const b=await L.runGames(6,{spec:['simple','beginner']});
   const c=await L.runGames(6,{spec:['simple','beginner','intermediate']});
   return {a:a.rows.map(x=>[x.key,x.n,x.wins]),av:a.verdict.line,b:b.rows.map(x=>[x.key,x.n,x.wins]),c:c.rows.map(x=>[x.key,x.n,x.wins]),errs:[a.errors,b.errors,c.errors]}; });
 console.log(JSON.stringify(r),Date.now()-t0);
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
