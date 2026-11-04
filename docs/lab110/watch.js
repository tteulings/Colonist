const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:360,height:780},hasTouch:true,isMobile:true})).newPage();
p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto('http://localhost:8110/lab.html');await p.waitForFunction(()=>window.__lab&&window.__lab.ready,null,{timeout:90000});
await p.tap('#tabTournament');
const r=await p.evaluate(async()=>{const L=window.__lab;L.st.speed='watch';const pr=L.runGames(1,{spec:['simple','beginner','intermediate']});await new Promise(r=>setTimeout(r,1500));const mid=!document.querySelector('#labWatch').hidden&&document.querySelector('#labWatch').textContent.slice(0,60);const a=await pr;return {mid,rows:a.rows.length,errs:a.errors,watching:L.sim.watching,hidden:document.querySelector('#labWatch').hidden}});
console.log(JSON.stringify(r));await b.close();})();
