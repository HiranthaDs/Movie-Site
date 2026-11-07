import assert from 'node:assert/strict';
import {browser,sleep} from './browser.mjs';
import {seed} from '../../worker/seed.js';

const b=await browser();
let heldTitle,delayTitle=true;
const title={...seed.find(item=>item.id===1396),seasonList:[{season_number:1,name:'Season 1'}]};
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS',name);};
const fulfill=(id,data)=>b.send('Fetch.fulfillRequest',{requestId:id,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
const message=(event,time,frame=true)=>b.evaluate(`window.dispatchEvent(new MessageEvent('message',{origin:'https://www.vidy.st',source:${frame?'document.querySelector("iframe").contentWindow':'window'},data:{event:${JSON.stringify(event)},currentTime:${time},duration:1000}}))`);
try{
  await b.go('/watchlist');
  await b.evaluate(`localStorage.setItem('cinera_progress',JSON.stringify({'tv:1396:1:1':{seconds:120,duration:1000,updatedAt:1},'tv:1396:1:2':{seconds:360,duration:1000,updatedAt:1}}));localStorage.removeItem('cinera_source_preference');`);
  b.on('Fetch.requestPaused',async event=>{
    const url=new URL(event.request.url);
    if(url.hostname==='www.vidy.st')return b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from('<html><body>Test player</body></html>').toString('base64')});
    if(url.pathname==='/api/title/tv/1396'){
      if(delayTitle){heldTitle=event.requestId;return;}
      return fulfill(event.requestId,title);
    }
    if(url.pathname.startsWith('/api/sources/'))return fulfill(event.requestId,{sources:[1,2].map(n=>({id:`test-${n}`,type:'iframe',label:`Test player ${n}`,url:`https://www.vidy.st/tv/1396/1/${url.searchParams.get('episode')}?server=${n}`}))});
    if(url.pathname.startsWith('/api/season/'))return fulfill(event.requestId,{episodes:[1,2].map(n=>({id:n,episode_number:n,name:`Episode ${n}`}))});
    return b.send('Fetch.continueRequest',{requestId:event.requestId});
  });
  await b.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'https://www.vidy.st/*'}]});
  await b.go('/watch/tv/1396?season=1&episode=1',700);
  check('Player waits for title metadata and saved progress',await b.evaluate('!document.querySelector("iframe")'));
  delayTitle=false;await fulfill(heldTitle,title);heldTitle=null;
  await b.until('!!document.querySelector("iframe")');
  check('First player navigation includes the saved position',await b.evaluate('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="120"'));
  await message('play',120);await message('timeupdate',150);await sleep(80);await message('pause',151);await sleep(80);
  check('Pausing flushes progress inside the four-second throttle',await b.evaluate('JSON.parse(localStorage.cinera_progress)["tv:1396:1:1"].seconds===151'));
  check('Progress messages never reload the playing iframe',await b.evaluate('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="120"'));
  await message('pause',900,false);await sleep(80);
  check('Messages from outside the active iframe are ignored',await b.evaluate('JSON.parse(localStorage.cinera_progress)["tv:1396:1:1"].seconds===151'));
  await b.evaluate('document.querySelectorAll(".source-pill")[1].click()');
  await b.until('new URL(document.querySelector("iframe").src).searchParams.get("server")==="2"');
  check('Changing source resumes at the latest saved position',await b.evaluate('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="151"'));
  await b.evaluate('document.querySelectorAll(".mini-episode-grid button")[1].click()');
  await b.until('!!document.querySelector("iframe") && new URL(document.querySelector("iframe").src).pathname.endsWith("/2")');
  check('Changing episode restores that episode’s own position',await b.evaluate('new URL(document.querySelector("iframe").src).searchParams.get("progress")==="360"'));
  check('Changing episode leaves the previous episode intact',await b.evaluate('JSON.parse(localStorage.cinera_progress)["tv:1396:1:1"].seconds===151'));
  await b.evaluate('[...document.querySelectorAll(".watch-tools button")].find(x=>x.textContent.includes("Start over")).click()');
  await b.until('!new URL(document.querySelector("iframe").src).searchParams.has("progress")');
  check('Start over clears only the active episode',await b.evaluate('!JSON.parse(localStorage.cinera_progress)["tv:1396:1:2"] && JSON.parse(localStorage.cinera_progress)["tv:1396:1:1"].seconds===151'));
  check('No playback JavaScript exceptions',b.errors.length===0);
}finally{await b.close();}
