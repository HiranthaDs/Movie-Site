import assert from 'node:assert/strict';
import {browser,sleep} from './browser.mjs';
import {seed} from '../../worker/seed.js';

const b=await browser();
const check=(name,condition)=>{assert.ok(condition,name);console.log('PASS',name);};
try{
  // Exercise player lifecycle events deterministically, without depending on a
  // CDN, autoplay permission, video codec, or the timing of a real media stream.
  await b.send('Page.addScriptToEvaluateOnNewDocument',{source:`
    const proto=HTMLMediaElement.prototype;
    Object.defineProperties(proto,{
      src:{get(){return this._src||'';},set(value){this._src=value;},configurable:true},
      currentTime:{get(){return this._time||0;},set(value){this._time=value;},configurable:true},
      duration:{get(){return 1200;},configurable:true},
      paused:{get(){return this._paused!==false;},configurable:true},
      readyState:{get(){return 4;},configurable:true}
    });
    proto.load=function(){this._time=0;if(this.isConnected)queueMicrotask(()=>{this.dispatchEvent(new Event('loadedmetadata'));this.dispatchEvent(new Event('canplay'));});};
    proto.play=function(){this._paused=false;this.dispatchEvent(new Event('playing'));return Promise.resolve();};
    proto.pause=function(){this._paused=true;this.dispatchEvent(new Event('pause'));};
  `});
  await b.go('/watchlist');
  await b.evaluate(`localStorage.setItem('cinera_progress',JSON.stringify({'movie:10378:1:1':{seconds:120,duration:1200,updatedAt:1}}));localStorage.setItem('cinera_data_saver','false');`);
  b.on('Fetch.requestPaused',async event=>{
    const url=new URL(event.request.url);
    const data=url.pathname.startsWith('/api/sources/')?{sources:[{id:'test-video',type:'video',label:'Test video',url:'https://example.com/sample.mp4'}]}:{...seed.find(item=>item.id===10378)};
    await b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
  });
  await b.send('Fetch.enable',{patterns:[{urlPattern:'*/api/title/movie/10378'},{urlPattern:'*/api/sources/movie/10378*'}]});
  await b.go('/watch/movie/10378');
  await b.until('document.querySelector("video")?.currentTime===120');
  check('Direct video resumes from stored progress',true);
  await b.evaluate(`(()=>{const video=document.querySelector('video');video.currentTime=121;video.dispatchEvent(new Event('timeupdate'));video.currentTime=123;video.pause();})()`);
  await b.until('JSON.parse(localStorage.cinera_progress)["movie:10378:1:1"].seconds===123');
  check('Direct pause persists the exact position',true);
  await b.evaluate('[...document.querySelectorAll(".watch-tools button")].find(x=>x.textContent.includes("Data Saver")).click()');
  await sleep(150);
  check('Changing Data Saver retains the current playback position',await b.evaluate('document.querySelector("video").currentTime===123'));
  await b.evaluate(`document.querySelector('video').currentTime=127;window.dispatchEvent(new Event('pagehide'));`);
  check('Leaving the page flushes the latest direct position',await b.evaluate('JSON.parse(localStorage.cinera_progress)["movie:10378:1:1"].seconds===127'));
  await b.evaluate('[...document.querySelectorAll(".watch-tools button")].find(x=>x.textContent.includes("Start over")).click()');
  await b.until('document.querySelector("video").currentTime===0');
  check('Direct start over clears the previous resume position',await b.evaluate('!JSON.parse(localStorage.cinera_progress)["movie:10378:1:1"]'));
  check('No direct player JavaScript exceptions',b.errors.length===0);
}finally{await b.close();}
