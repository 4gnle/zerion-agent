import { test, expect } from '@playwright/test';
const intent={status:'ready',sellToken:'ETH',buyToken:'USDC',chain:'arbitrum',amountType:'percentage',amount:'50',recipient:'self',reason:'none'};
for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
 test(`simulation lifecycle ${viewport.width}px`,async({page})=>{
  await page.setViewportSize(viewport);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  let calls=0;
  await page.route('**/api/intent',async route=>{calls++;await new Promise(r=>setTimeout(r,350));await route.fulfill({json:{intent}});});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Wallet Agent'})).toBeVisible();
  await expect(page.getByText('Demo wallet',{exact:true})).toBeVisible();
  await page.screenshot({path:`.local/idle-${viewport.width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Swap half my ETH for USDC'}).click();
  await expect(page.getByLabel('What would you like to do?')).toBeFocused();
  await page.getByLabel('What would you like to do?').press('Enter');
  await expect(page.getByText('Understanding your instruction…',{exact:true}).last()).toBeVisible();
  await page.screenshot({path:`.local/loading-${viewport.width}.png`,fullPage:true});
  await expect(page.getByRole('button',{name:'Simulate swap',exact:true})).toBeVisible();
  await page.screenshot({path:`.local/review-${viewport.width}.png`,fullPage:true});
  await page.getByText('Details',{exact:true}).click();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Simulate swap',exact:true}).click();
  await expect(page.getByText('Waiting for swap confirmation…',{exact:true}).last()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Simulation complete'})).toBeVisible();
  await page.screenshot({path:`.local/success-${viewport.width}.png`,fullPage:true});
  expect(calls).toBe(1);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Start another swap'}).click();
  await expect(page.getByLabel('What would you like to do?')).toHaveValue('');
 });
}
test('double submit, error and retry keep the flow recoverable',async({page})=>{
 let calls=0;await page.route('**/api/intent',async route=>{calls++;await new Promise(r=>setTimeout(r,300));await route.fulfill({status:503,json:{code:'AI_UNAVAILABLE',error:'Sentence interpretation is unavailable. Check API access or try again.'}});});
 await page.goto('/');await page.getByLabel('What would you like to do?').fill('Swap half my ETH for USDC');
 await page.getByLabel('What would you like to do?').press('Enter');await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Couldn’t continue'})).toBeVisible();expect(calls).toBe(1);
 await page.screenshot({path:'.local/error.png',fullPage:true});await page.getByRole('button',{name:'Edit and try again'}).click();await expect(page.getByLabel('What would you like to do?')).toBeFocused();
});
