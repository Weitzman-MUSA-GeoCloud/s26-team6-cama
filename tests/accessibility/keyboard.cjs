const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
for(const route of ['widget/','reviewer/']){
 const page=await browser.newPage();await page.route('**/photon.komoot.io/**',r=>r.fulfill({json:{features:[{geometry:{coordinates:[-75.16,39.95]},properties:{housenumber:'1234',street:'Market Street',city:'Philadelphia',state:'Pennsylvania'}}]}}));
 await page.goto('http://127.0.0.1:8765/ui/'+route,{waitUntil:'domcontentloaded'});await page.waitForTimeout(6000);
 await page.keyboard.press('Tab');assert.equal(await page.locator('.skip-link').evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Enter');assert.equal(await page.locator('main').evaluate(e=>e===document.activeElement),true);
 await page.locator('#address-input').fill('1234 Market');await page.waitForTimeout(1500);
 if(await page.locator('[role=option]').count()){
 await page.locator('#address-input').press('ArrowDown');assert.equal(await page.locator('#address-input').getAttribute('aria-activedescendant'),'address-option-0');
 await page.locator('#address-input').press('Escape');assert.equal(await page.locator('#address-input').getAttribute('aria-expanded'),'false');
 }else throw Error('Suggestions did not load');
 console.log(route,'keyboard passed');await page.close();
}await browser.close()})();
