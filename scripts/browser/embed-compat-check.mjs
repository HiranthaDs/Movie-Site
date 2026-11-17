import assert from 'node:assert/strict';
import {browser} from './browser.mjs';
import {seed} from '../../worker/seed.js';

// These are Chromium viewport/input profiles, not physical Safari/TV devices.
const profiles=[
  {name:'desktop',width:1440,height:1000},
  {name:'phone',width:390,height:844,touch:true},
  {name:'small-phone',width:320,height:568,touch:true},
  {name:'tablet',width:1024,height:768,touch:true},
  {name:'tv',width:1920,height:1080,tv:true},
];
for(const profile of profiles){
  const b=await browser(profile.width,profile.height);
  const check=(name,value)=>{assert.ok(value,`${profile.name}: ${name}`);console.log('PASS',profile.name,name);};
  try{
    await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.addEventListener('message',event=>{if(event.origin==='https://www.vidy.st'&&event.source===document.querySelector('iframe')?.contentWindow&&event.data==='cinera-fixture-form-submitted')window.fixtureFormSubmitted=true;});`});
    await b.send('Emulation.setTouchEmulationEnabled',{enabled:!!profile.touch,maxTouchPoints:profile.touch?5:1});
    b.on('Fetch.requestPaused',async event=>{
      const url=new URL(event.request.url);
      let body,contentType='application/json';
      if(url.hostname==='www.vidy.st'){
        contentType='text/html';
        // A provider-style script and form, served without a live provider.
        body=`<html><body><h1>Player loaded</h1><form action="javascript:window.parent.postMessage('cinera-fixture-form-submitted','*')"></form><script>document.forms[0].submit()</script></body></html>`;
      }else if(url.pathname.startsWith('/api/title/movie/10378'))body=JSON.stringify(seed.find(item=>item.id===10378));
      else if(url.pathname.startsWith('/api/sources/movie/10378'))body=JSON.stringify({sources:[{id:'compat',type:'iframe',label:'Compatibility player',url:'https://www.vidy.st/movie/10378?autoplay=true'}]});
      else return b.send('Fetch.continueRequest',{requestId:event.requestId});
      await b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:contentType}],body:Buffer.from(body).toString('base64')});
    });
    await b.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'https://www.vidy.st/*'}]});
    await b.go('/watchlist');
    await b.evaluate(`localStorage.setItem('cinera_progress',JSON.stringify({'movie:10378:1:1':{seconds:120,duration:1000,updatedAt:1}}));localStorage.removeItem('cinera_source_preference');`);
    await b.go('/watch/movie/10378'+(profile.tv?'?tv=1':''));
    await b.until('!!document.querySelector(".embed-recovery-actions button")');
    if(profile.tv){
      check('TV uses a remote-focusable full-page launch without an inaccessible iframe',await b.evaluate('!document.querySelector("iframe") && !!document.querySelector(".tv-external-actions button[data-tv-autofocus]")'));
      await b.evaluate('document.querySelector(".tv-external-actions button").click()');
      await b.until('!!document.querySelector(".external-player-dialog")');
      check('TV asks before opening an external player',await b.evaluate('location.hostname!=="www.vidy.st" && new URL(document.querySelector(".external-player-dialog a").href).searchParams.get("progress")==="120"'));
      await b.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}))');
      check('TV D-pad reaches the Open player action',await b.evaluate('document.activeElement===document.querySelector(".external-player-dialog a")'));
      await b.evaluate('window.dispatchEvent(new KeyboardEvent("keydown",{key:"BrowserBack",bubbles:true,cancelable:true}))');
      check('TV Back cancels and stays in Cinera',await b.evaluate('!document.querySelector(".external-player-dialog") && location.pathname.startsWith("/watch/")'));
      await b.evaluate('document.querySelector(".tv-external-actions button").click()');
      await b.until('!!document.querySelector(".external-player-dialog a")');
      await b.evaluate('document.querySelector(".external-player-dialog a").focus()');
      await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
      await b.until('location.hostname==="www.vidy.st"');
      check('TV confirmation opens the selected title with resume',await b.evaluate('location.pathname==="/movie/10378" && new URL(location.href).searchParams.get("progress")==="120"'));
      check('No TV JavaScript exceptions',b.errors.length===0);
      continue;
    }
    await b.until('!!document.querySelector("iframe") && document.querySelector(".video-frame-shell").classList.contains("state-connected")');
    await b.until('window.fixtureFormSubmitted===true');
    check('Player scripts and forms can run',true);
    check('Embedded player has no incompatible sandbox and delegates media capabilities',await b.evaluate(`(()=>{const frame=document.querySelector('iframe');return !frame.hasAttribute('sandbox') && ['autoplay *','encrypted-media *','fullscreen *','picture-in-picture *'].every(value=>frame.allow.includes(value)) && frame.allowFullscreen;})()`));
    check('Recovery remains available when a provider error fires onLoad',await b.evaluate('!!document.querySelector(".embed-recovery-actions button") && !document.querySelector(".player-error")'));
    await b.evaluate(`window.dispatchEvent(new MessageEvent('message',{origin:'https://www.vidy.st',source:document.querySelector('iframe').contentWindow,data:{event:'pause',currentTime:245,duration:1000}}))`);
    await b.until('JSON.parse(localStorage.cinera_progress)["movie:10378:1:1"].seconds===245');
    check('Recovery uses latest progress without reloading the iframe',await b.evaluate('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="120"'));
    await b.evaluate('document.querySelector(".embed-recovery-actions button").click()');
    await b.until('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="245"');
    check('Reload retains playback position',true);
    check('Recovery fits the screen and has touch-sized controls',await b.evaluate(`(()=>{const panel=document.querySelector('.embed-recovery'),rect=panel.getBoundingClientRect();return rect.left>=0 && rect.right<=innerWidth+1 && [...panel.querySelectorAll('a,button')].every(el=>{const r=el.getBoundingClientRect();return r.height>=44 && r.left>=0 && r.right<=innerWidth+1;});})()`));
    await b.evaluate('document.querySelectorAll(".embed-recovery-actions button")[1].click()');
    await b.until('!!document.querySelector(".external-player-dialog")');
    check('Recovery asks before leaving Cinera',await b.evaluate('new URL(document.querySelector(".external-player-dialog a").href).searchParams.get("progress")==="245"'));
    await b.evaluate('document.querySelector(".external-player-dialog button").click()');
    check('Cancel keeps the player and watch page',await b.evaluate('!document.querySelector(".external-player-dialog") && !!document.querySelector("iframe")'));
    await b.evaluate('document.querySelectorAll(".embed-recovery-actions button")[1].click()');
    await b.until('!!document.querySelector(".external-player-dialog a")');
    await b.evaluate('document.querySelector(".external-player-dialog a").focus()');
    await b.screenshot(`embed-${profile.name}.png`);
    // Use a real user activation, as a TV remote or keyboard would.
    await b.send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await b.send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
    await b.until('location.hostname==="www.vidy.st"');
    check('Full-page recovery navigates the current tab with resume intact',await b.evaluate('window===window.top && location.pathname==="/movie/10378" && new URL(location.href).searchParams.get("progress")==="245"'));
    check('No JavaScript exceptions',b.errors.length===0);
  }finally{await b.close();}
}
