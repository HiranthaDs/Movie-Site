import assert from 'node:assert/strict';
import {browser} from './browser.mjs';
import {seed} from '../../worker/seed.js';

const b=await browser();
const title=seed.find(item=>item.id===10378);
let pendingTitle;
const fulfill=(requestId,data)=>b.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
const check=(name,value)=>{assert.ok(value,name);console.log('PASS',name);};
try{
  b.on('Fetch.requestPaused',async event=>{
    const url=new URL(event.request.url);
    if(url.hostname==='www.vidy.st')return b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from('<html><body>Player ready</body></html>').toString('base64')});
    if(url.pathname==='/api/home')return fulfill(event.requestId,{featured:[{id:title.id,kind:title.kind,title:title.title,overview:title.overview,poster:title.poster,backdrop:title.backdrop}],rows:[]});
    if(url.pathname==='/api/title/movie/10378'){pendingTitle=event.requestId;return;}
    if(url.pathname==='/api/sources/movie/10378')return fulfill(event.requestId,{sources:[{id:'preview-source',type:'iframe',label:'Test player',url:'https://www.vidy.st/movie/10378'}]});
    return b.send('Fetch.continueRequest',{requestId:event.requestId});
  });
  await b.send('Fetch.enable',{patterns:[{urlPattern:'*/api/*'},{urlPattern:'https://www.vidy.st/*'}]});
  await b.go('/');
  await b.until('!!document.querySelector(".hero-buttons a")');
  await b.evaluate('document.querySelector(".hero-buttons a").click()');
  await b.until('!!document.querySelector("iframe")');
  check('Player starts before the slow title request finishes',Boolean(pendingTitle));
  await b.evaluate('window.initialPlayerFrame=document.querySelector("iframe");true');
  await fulfill(pendingTitle,title);pendingTitle=null;
  await b.until('document.querySelector(".watch-header h1")?.textContent.includes("Big Buck Bunny")');
  check('Metadata arrival keeps the same playing frame',await b.evaluate('window.initialPlayerFrame===document.querySelector("iframe")'));
  check('No watch startup JavaScript exceptions',b.errors.length===0);
}finally{if(pendingTitle)await fulfill(pendingTitle,title).catch(()=>{});await b.close();}
