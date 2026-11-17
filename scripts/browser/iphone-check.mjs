import assert from 'node:assert/strict';
import {browser} from './browser.mjs';

for(const profile of [{name:'desktop',width:1440,height:900},{name:'iphone',width:390,height:844},{name:'small-iphone',width:320,height:650}]){
  const b=await browser(profile.width,profile.height);
  const check=(name,value)=>{assert.ok(value,`${profile.name}: ${name}`);console.log('PASS',profile.name,name);};
  try{
    await b.go('/iphone');
    await b.until('!!document.querySelector(".iphone-steps li")');
    check('Safari installation guide has four steps',await b.evaluate('document.querySelectorAll(".iphone-steps li").length===4 && document.body.textContent.includes("Open as Web App")'));
    check('Apple branding and Cinera icon load',await b.evaluate('[...document.querySelectorAll(".iphone-page img")].every(image=>image.complete&&image.naturalWidth>0)'));
    check('Guide and update instructions are visible',await b.evaluate('!!document.querySelector(".iphone-updates") && !!document.querySelector(".iphone-apple-guide")'));
    check('iPhone guide is linked from navigation and footer',await b.evaluate(`!!document.querySelector('#main-menu a[href="/iphone"]') && !!document.querySelector('.site-footer a[href="/iphone"]')`));
    check('Page fits viewport',await b.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
    check('No iPhone page JavaScript exceptions',b.errors.length===0);
    await b.screenshot(`iphone-${profile.name}.png`);
  }finally{await b.close();}
}
