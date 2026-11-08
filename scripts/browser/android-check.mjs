import assert from 'node:assert/strict';
import {browser,sleep} from './browser.mjs';

const b=await browser(1440,1000);
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS',name);};
const straightDeviceFrames=`(()=>{const frames=[...document.querySelectorAll('.android-device-frame')];return frames.length===4&&frames.every(frame=>getComputedStyle(frame).transform==='none');})()`;
const widescreenTv=`(()=>{const screen=document.querySelector('.device-frame-tv .android-device-screen');if(!screen)return false;const rect=screen.getBoundingClientRect();return rect.height>0&&Math.abs(rect.width/rect.height-16/9)<0.04;})()`;
// Capture the composited canvas so WebGL's default drawing-buffer clearing does
// not turn these checks into comparisons of empty canvas.toDataURL() results.
async function robotSnapshot(){
  const clip=await b.evaluate('(()=>{const rect=document.querySelector(".android-robot-scene canvas").getBoundingClientRect();return {x:Math.floor(rect.left+scrollX),y:Math.floor(rect.top+scrollY),width:Math.floor(rect.width),height:Math.floor(rect.height),scale:1};})()');
  const {data}=await b.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,clip});
  return data;
}
try{
  await b.go('/android');
  await b.until('!!document.querySelector(".android-qr-card img")');
  await b.until('document.querySelector(".android-robot-scene")?.dataset.state==="ready"');
  await b.evaluate('document.fonts.ready');
  check('Android hero renders a live 3D scene',await b.evaluate('(()=>{const canvas=document.querySelector(".android-robot-scene canvas");return !!canvas&&canvas.width>0&&canvas.height>0;})()'));
  check('Robot stands directly on the page without a frame or background panel',await b.evaluate('[".android-character",".android-robot-scene",".android-robot-canvas"].every(selector=>{const style=getComputedStyle(document.querySelector(selector));return style.backgroundColor==="rgba(0, 0, 0, 0)"&&style.backgroundImage==="none"&&style.boxShadow==="none"&&[style.borderTopWidth,style.borderRightWidth,style.borderBottomWidth,style.borderLeftWidth].every(width=>parseFloat(width)===0);})'));
  check('Android page exposes all four device options',await b.evaluate('document.querySelectorAll(".android-device-card").length===4'));
  check('Every device preview faces straight forward',await b.evaluate(straightDeviceFrames));
  check('TV preview has a widescreen 16:9 display',await b.evaluate(widescreenTv));
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
  check('Robot interactions are accessible buttons',await b.evaluate('[".android-motion-toggle",".android-replay-button",".android-greet-button"].every(selector=>{const button=document.querySelector(selector);return button?.tagName==="BUTTON"&&!button.disabled&&(button.getAttribute("aria-label")||button.textContent).trim().length>0;})'));
  await b.evaluate('document.querySelector(".android-motion-toggle").click()');
  await b.until('document.querySelector(".android-robot-scene").dataset.motion==="paused"');
  check('Robot motion can be paused',await b.evaluate('document.querySelector(".android-motion-toggle").getAttribute("aria-pressed")==="true"'));
  await sleep(250);
  const pausedFrame=await robotSnapshot();
  await sleep(250);
  check('Paused robot pixels stay still',pausedFrame===await robotSnapshot());
  await b.evaluate('document.querySelector(".android-motion-toggle").click()');
  await b.until('document.querySelector(".android-robot-scene").dataset.motion==="playing"');
  check('Robot motion can be resumed',await b.evaluate('document.querySelector(".android-motion-toggle").getAttribute("aria-pressed")==="false"'));
  const entrance=await b.evaluate('document.querySelector(".android-robot-scene").dataset.entrance');
  await b.evaluate('document.querySelector(".android-replay-button").click()');
  await b.until(`document.querySelector('.android-robot-scene').dataset.entrance!==${JSON.stringify(entrance)}`);
  check('Replay restarts the robot entrance',await b.evaluate('document.querySelector(".android-robot-scene").dataset.motion==="playing"'));
  await sleep(250);
  const walkingFrame=await robotSnapshot();
  await sleep(300);
  check('Replayed entrance visibly moves the robot',walkingFrame!==await robotSnapshot());
  const greeting=await b.evaluate('document.querySelector(".android-robot-greeting").textContent');
  await b.evaluate('document.querySelector(".android-greet-button").click()');
  await b.until(`document.querySelector('.android-robot-greeting').textContent!==${JSON.stringify(greeting)}`);
  check('Saying hello gives an accessible robot response',await b.evaluate('(()=>{const greeting=document.querySelector(".android-robot-greeting");return greeting.getAttribute("aria-live")==="polite"&&greeting.textContent.trim().length>0;})()'));
  await b.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await b.until('document.querySelector(".android-robot-scene").dataset.motion==="reduced"');
  check('Reduced-motion preference keeps the 3D character available without animation',await b.evaluate('document.querySelector(".android-robot-scene").dataset.state==="ready"'));
  await sleep(250);
  const reducedFrame=await robotSnapshot();
  await sleep(250);
  check('Reduced-motion robot pixels stay still',reducedFrame===await robotSnapshot());
  await b.send('Emulation.setEmulatedMedia',{features:[]});
  await b.until('document.querySelector(".android-robot-scene").dataset.motion==="playing"');
  for(const width of [320,390,768,1024,1920]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:width<760?844:1080,deviceScaleFactor:1,mobile:width<760});
    await sleep(100);
    check(`Android page fits a ${width}px viewport`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    check(`Device previews stay upright with a widescreen TV at ${width}px`,await b.evaluate(`(${straightDeviceFrames})&&(${widescreenTv})`));
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
  await b.until('document.querySelector(".android-robot-scene")?.dataset.state==="ready"');
  await b.evaluate('document.querySelector(".android-robot-scene canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext()');
  await b.until('document.querySelector(".android-robot-scene").dataset.state==="fallback"');
  check('Losing the graphics context restores the Android fallback',await b.evaluate('(()=>{const canvas=document.querySelector(".android-robot-canvas canvas");return !!document.querySelector(".android-robot-fallback")&&(!canvas||getComputedStyle(canvas).visibility==="hidden");})()'));
  check('Android page has no uncaught browser exceptions',b.errors.length===0);
}finally{await b.close();}

// Old TV browsers can lack WebGL. Verify the page stays useful when creation fails.
const fallback=await browser(390,844);
try{
  await fallback.send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};})()`});
  await fallback.go('/android');
  await fallback.until('document.querySelector(".android-robot-scene")?.dataset.state==="fallback"');
  check('Browsers without WebGL receive the Android character fallback',await fallback.evaluate('!!document.querySelector(".android-robot-fallback")'));
  check('Fallback exposes only the visible character to screen readers',await fallback.evaluate('document.querySelector(".android-robot-canvas").getAttribute("aria-hidden")==="true" && document.querySelector(".android-robot-fallback svg").getAttribute("role")==="img"'));
  check('Replay restarts the fallback character too',await fallback.evaluate('new Promise(resolve=>{const previous=document.querySelector(".android-robot-fallback svg");document.querySelector(".android-replay-button").click();requestAnimationFrame(()=>resolve(previous!==document.querySelector(".android-robot-fallback svg")));})'));
  check('APK access remains available without WebGL',await fallback.evaluate('document.querySelector(".android-download-button").href==="https://drive.google.com/drive/folders/1YqsCN_xvCM9YciicLLgqMUqVxkwqZ1tT?usp=sharing"'));
  check('WebGL fallback has no uncaught browser exceptions',fallback.errors.length===0);
}finally{await fallback.close();}
