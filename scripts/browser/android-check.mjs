import assert from 'node:assert/strict';
import {browser,sleep} from './browser.mjs';

const b=await browser(1440,1000);
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS',name);};
try{
  await b.go('/android');
  await b.until('!!document.querySelector(".android-qr-card img")');
  await b.evaluate('document.fonts.ready');
  check('Android page exposes all four device options',await b.evaluate('document.querySelectorAll(".android-device-card").length===4'));
  check('All APK buttons open the supplied Drive folder in a separate tab',await b.evaluate(`[...document.querySelectorAll('.android-download-button')].every(link=>link.href==='https://drive.google.com/drive/folders/1YqsCN_xvCM9YciicLLgqMUqVxkwqZ1tT?usp=sharing'&&link.target==='_blank'&&link.rel.includes('noopener'))`));
  check('Download QR renders successfully',await b.evaluate('document.querySelector(".android-qr-card img").naturalWidth>0'));
  await b.screenshot('android-desktop.png');
  for(const [index,phrase] of [[1,'Phones use the Cinera web app'],[2,'Use the web app on your Android tablet'],[3,'not a native desktop installer']]){
    await b.evaluate(`document.querySelectorAll('.android-guide-devices button')[${index}].click()`);
    await b.until(`document.querySelector('.android-guide-content').textContent.includes(${JSON.stringify(phrase)})`);
    check(`Device guide ${index} distinguishes web access from TV installation`,await b.evaluate('document.querySelectorAll(".android-guide-devices [aria-pressed=true]").length===1 && document.querySelector(".android-guide-cta a").getAttribute("href")==="/"'));
  }
  await b.evaluate('document.querySelector(".android-device-tv button").click()');
  await b.until('document.activeElement.id==="android-guide-title"');
  check('Device cards move focus to the installation guide',await b.evaluate('document.querySelector(".android-guide-content").textContent.includes("Cinera-Android-TV.apk")'));
  await b.evaluate('document.querySelector("#android-question-2").click()');
  await b.until('document.querySelector("#android-question-2").getAttribute("aria-expanded")==="true"');
  check('FAQ exposes platform compatibility and closes previous answer',await b.evaluate('!document.querySelector("#android-answer-2").hidden && document.querySelector("#android-answer-0").hidden'));
  await b.evaluate('window.scrollTo({top:0,behavior:"instant"})');
  await b.until('document.querySelector(".android-hero-art .android-mascot").classList.contains("is-waving")');
  await b.evaluate('document.querySelector(".android-motion-toggle").click()');
  await b.until('!document.querySelector(".android-hero-art .android-mascot").classList.contains("is-waving")');
  check('Mascot animation can be paused',await b.evaluate('document.querySelector(".android-motion-toggle").getAttribute("aria-pressed")==="true"'));
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  check('Reduced-motion preference disables the waving animation',await b.evaluate('getComputedStyle(document.querySelector(".android-wave-arm")).animationName==="none"'));
  await b.send('Emulation.setEmulatedMedia',{features:[]});
  for(const width of [320,390,768,1024,1920]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:width<760?844:1080,deviceScaleFactor:1,mobile:width<760});
    await sleep(100);
    check(`Android page fits a ${width}px viewport`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    if(width<760){
      check(`All five mobile navigation links fit at ${width}px`,await b.evaluate(`(()=>{const links=[...document.querySelectorAll('.mobile-bottom-nav a')];const rects=links.map(x=>x.getBoundingClientRect());return links.length===5&&rects.every(r=>r.width>0&&r.left>=0&&r.right<=innerWidth&&Math.abs(r.top-rects[0].top)<2);})()`));
      await b.screenshot(`android-${width}.png`);
    }
  }
  await b.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await b.go('/watchlist');
  await b.evaluate(`document.querySelector('.mobile-bottom-nav a[href="/android"]').click()`);
  await b.until('location.pathname==="/android" && !!document.querySelector("#android-title")');
  check('Mobile navigation opens the Android page',true);
  await b.evaluate('document.querySelector(".menu-toggle").click()');
  await b.until('!!document.querySelector(".menu-panel.is-open")');
  await sleep(300);
  await b.screenshot('android-menu-mobile.png');
  check('Hamburger menu has a prominent Android download button',await b.evaluate('!!document.querySelector(".menu-android-download svg") && document.querySelector(".menu-android-download").getAttribute("href")==="/android"'));
  await b.evaluate('document.querySelector(".menu-android-download").click()');
  await b.until('!document.querySelector(".menu-panel.is-open")');
  await b.evaluate('document.querySelector(".android-footer-callout").scrollIntoView({block:"center",behavior:"instant"})');
  await b.until('document.querySelector(".android-footer-callout .android-mascot").classList.contains("is-waving")');
  check('Footer has a flat waving robot and Android page link',await b.evaluate('!!document.querySelector(".android-footer-callout .is-flat") && document.querySelector(".android-footer-callout a").getAttribute("href")==="/android"'));
  await b.screenshot('android-footer-mobile.png');
  await b.send('Network.setUserAgentOverride',{userAgent:'Mozilla/5.0 (Linux; Android 9; SHIELD Android TV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.210 Safari/537.36'});
  await b.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await b.go('/android');
  await b.until('document.documentElement.classList.contains("tv-device")');
  await b.evaluate('document.querySelector(".android-download-button").focus()');
  await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowDown',windowsVirtualKeyCode:40});
  check('TV remote navigation reaches another visible control',await b.evaluate('document.activeElement!==document.querySelector(".android-download-button") && document.activeElement.tagName!=="BODY"'));
  await b.screenshot('android-tv.png');
  await b.send('Emulation.setDeviceMetricsOverride',{width:3840,height:2160,deviceScaleFactor:1,mobile:false});
  await sleep(150);
  check('Android page fits a 4K TV viewport',await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
  await b.screenshot('android-tv-4k.png');
  check('Android page has no uncaught browser exceptions',b.errors.length===0);
}finally{await b.close();}
