const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
for(const path of ['','widget/','reviewer/']){
const page=await browser.newPage();
await page.goto('http://127.0.0.1:8765/ui/'+path);
await page.waitForTimeout(6000);
await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
const results=await page.evaluate(()=>axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
console.log(path||'home',JSON.stringify(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))));
assert.equal(results.violations.length, 0, JSON.stringify(results.violations.map(v => v.id)));
await page.setViewportSize({width:320,height:800});
await page.waitForTimeout(1500);
console.log('reflow',await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth})));
assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Page overflows at 320px');
await page.close();
}
await browser.close();
})();
