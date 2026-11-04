const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch();
 const p=await (await b.newContext({viewport:{width:360,height:780},hasTouch:true,isMobile:true})).newPage();
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 await p.goto('http://localhost:8110/lab.html');
 await p.waitForFunction(()=>window.__lab&&window.__lab.ready,null,{timeout:90000});
 await p.tap('#tabTournament'); await p.waitForTimeout(500);
 const t0=Date.now();
 const r=await p.evaluate(async()=>{ const L=window.__lab; L.st.speed='instant';
   const spec=['random','random','random','random'];
   const A=await L.runGames(6,{spec}); const ka=L.sim.results.map(r=>JSON.stringify([r.keys,r.winner,r.turns,r.vp]));
   const B=await L.runGames(6,{spec}); const kb=L.sim.results.map(r=>JSON.stringify([r.keys,r.winner,r.turns,r.vp]));
   const f=(arr)=>arr.map(s=>JSON.parse(s)); const A2=f(ka),B2=f(kb); return {keysSame:JSON.stringify(A2.map(x=>x[0]))===JSON.stringify(B2.map(x=>x[0])), fastSame:A2.every((x,i)=>x[0].includes('master')||JSON.stringify(x)===JSON.stringify(B2[i])), masterGames:A2.filter(x=>x[0].includes('master')).length, keys:L.sim.results.map(r=>r.keys.join('/')), slow:A.slowGames, sumN:A.rows.reduce((a,x)=>a+x.n,0), verdict:A.verdict.line, errs:A.errors+B.errors}; });
 console.log(JSON.stringify(r),Date.now()-t0);
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
