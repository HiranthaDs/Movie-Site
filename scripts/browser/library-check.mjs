import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {browser,sleep,artifact} from './browser.mjs';
import {seed} from '../../worker/seed.js';

const b=await browser(1440,1000);
const checks=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
const click=selector=>b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
const input=async(selector,value)=>{await b.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);await b.send('Input.insertText',{text:value});await sleep(100);};
const select=async(selector,value)=>{await b.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});element.value=${JSON.stringify(value)};element.dispatchEvent(new Event('change',{bubbles:true}));})()`);await sleep(100);};
const key=async(key,extra={})=>{await b.send('Input.dispatchKeyEvent',{type:'keyDown',key,...extra});await b.send('Input.dispatchKeyEvent',{type:'keyUp',key,...extra});await sleep(100);};
let second;
try{
  await b.go('/watchlist');
  const saved=[seed[0],seed[1],seed[12]];
  const history=[{...seed[12],season:2,episode:3,lastWatched:Date.now()}];
  const progress={'tv:1396:2:3':{seconds:600,duration:3000,updatedAt:Date.now()}};
  await b.evaluate(`localStorage.setItem('cinera_saved',${JSON.stringify(JSON.stringify(saved))});localStorage.setItem('cinera_history',${JSON.stringify(JSON.stringify(history))});localStorage.setItem('cinera_progress',${JSON.stringify(JSON.stringify(progress))});`);
  await b.go('/watchlist');await b.until('document.querySelectorAll(".library-card").length===3');
  await b.screenshot('ux-library-desktop.png');
  await input('.library-search input','Inter');
  check('Library search narrows saved titles',await b.evaluate('document.querySelectorAll(".library-card").length===1'));
  await click('[aria-label="Clear library search"]');
  await select('[aria-label="Filter library by type"]','tv');
  check('Library format filter',await b.evaluate('document.querySelectorAll(".library-card").length===1 && document.querySelector(".card-title").textContent==="Breaking Bad"'));
  await select('[aria-label="Filter library by type"]','all');
  await select('[aria-label="Sort library"]','title');
  check('Library title sorting',await b.evaluate('document.querySelector(".card-title").textContent==="Breaking Bad"'));
  await click('.card-save');
  check('Removing a saved title shows undo',await b.evaluate('document.querySelectorAll(".library-card").length===2 && !!document.querySelector(".toast-action")'));
  await click('.toast-action');
  check('Undo restores removed title',await b.evaluate('document.querySelectorAll(".library-card").length===3'));
  await b.go('/watchlist?tab=history');
  check('Exact episode resume and remaining time',await b.evaluate('document.querySelector(".library-resume").getAttribute("href")==="/watch/tv/1396?season=2&episode=3" && document.querySelector(".library-resume-meta").textContent.includes("40 min left")'));
  await click('.clear-history');await click('.confirm-remove');
  check('Clear history preserves playback progress',await b.evaluate('JSON.parse(localStorage.getItem("cinera_history")).length===0 && JSON.parse(localStorage.getItem("cinera_progress"))["tv:1396:2:3"].seconds===600'));
  await click('.toast-action');
  check('Clear history can be undone',await b.evaluate('document.querySelectorAll(".library-card").length===1'));
  second=await browser();await second.go('/watchlist');
  await second.evaluate('document.querySelector(".card-save").click()');
  await b.until('JSON.parse(localStorage.getItem("cinera_saved")).length===2');
  await click('.library-tabs .browse-tabs button:first-child');
  await b.until('document.querySelectorAll(".library-card").length===2');
  check('Watchlist changes sync across tabs',await b.evaluate('document.querySelectorAll(".library-card").length===2'));
  await second.close();second=null;

  const backup={app:'cinera',version:1,saved:[seed[2]],history:[],progress:{}};
  await writeFile(artifact('ux-backup.json'),JSON.stringify(backup));
  const root=await b.send('DOM.getDocument');
  const fileNode=await b.send('DOM.querySelector',{nodeId:root.root.nodeId,selector:'.library-backup input[type=file]'});
  await b.send('DOM.setFileInputFiles',{nodeId:fileNode.nodeId,files:[fileURLToPath(artifact('ux-backup.json'))]});
  await b.until('JSON.parse(localStorage.getItem("cinera_saved")).some(item=>item.title==="Inception")');
  check('Import backup merges without replacing existing titles',await b.evaluate('JSON.parse(localStorage.getItem("cinera_saved")).length===3'));
  await b.allowDownloads();
  await click('.library-backup-actions button:first-child');
  check('Export backup gives download feedback',await b.evaluate('document.querySelector(".toast-viewport").textContent.includes("ready to download")'));

  await b.go('/discover?type=tv&page=NaN');await b.until('!!document.querySelector(".catalog-grid .movie-card")');
  check('Invalid page normalized while preserving TV format',await b.evaluate('location.search==="?type=tv" && document.querySelector(".browse-tabs button.active").textContent.includes("TV")'));
  await click('.quick-genres button:nth-child(2)');await b.until('!!document.querySelector(".active-filter-list")');
  check('Quick genre retains format in shareable URL',await b.evaluate('new URLSearchParams(location.search).get("type")==="tv" && !!new URLSearchParams(location.search).get("genre")'));
  await click('.clear-active-filters');
  check('Reset filters preserves selected format',await b.evaluate('location.search==="?type=tv"'));

  await b.go('/movies');await b.until('document.querySelectorAll(".catalog-grid .movie-card").length>3');
  await b.evaluate('window.scrollTo({top:820,behavior:"instant"})');await sleep(150);
  const scroll=await b.evaluate('window.scrollY');await click('.catalog-grid .card-image-link');
  await b.until('!!document.querySelector(".detail-info h1")');
  await b.evaluate('history.back()');await b.until('!!document.querySelector(".catalog-grid .movie-card")');await sleep(600);
  check('Browser Back restores catalog scroll position',await b.evaluate(`Math.abs(scrollY-${scroll})<5`));
  await key('k',{modifiers:2});
  check('Ctrl K opens search and focuses input',await b.evaluate('!!document.querySelector(".search-drawer") && document.activeElement.getAttribute("role")==="combobox"'));
  await key('Escape');
  check('Escape returns focus to search trigger',await b.evaluate('!document.querySelector(".search-drawer") && document.activeElement.classList.contains("header-search-trigger")'));
  await b.evaluate('window.dispatchEvent(new Event("offline"))');
  check('Offline feedback links to personal library',await b.evaluate(`!!document.querySelector('.connection-notice a[href="/watchlist"]')`));
  await b.evaluate('window.dispatchEvent(new Event("online"))');
  check('Reconnection clears offline notice',await b.evaluate('!document.querySelector(".connection-notice")'));

  let failSearch=true,failSeasons=true;
  b.on('Fetch.requestPaused',async event=>{
    const url=new URL(event.request.url);
    if((url.pathname==='/api/search'&&url.searchParams.get('q')==='qa-retry')||url.pathname==='/api/season/1396/1'){
      const failed=url.pathname.includes('/season/')?failSeasons:failSearch;
      const data=failed?{error:'Temporary QA outage'}:url.pathname.includes('/season/')?{episodes:[]}:{results:[seed[0]],totalPages:1,page:1};
      await b.send('Fetch.fulfillRequest',{requestId:event.requestId,responseCode:failed?503:200,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')});
    }else await b.send('Fetch.continueRequest',{requestId:event.requestId});
  });
  await b.send('Fetch.enable',{patterns:[{urlPattern:'*/api/search*'},{urlPattern:'*/api/season/1396/1*'}]});
  await b.go('/search?q=qa-retry');await b.until('!!document.querySelector(".error-panel button")');
  failSearch=false;await click('.error-panel button');await b.until('!!document.querySelector(".catalog-grid .movie-card")');
  check('Search recovers through retry after server error',true);
  await b.go('/title/tv/1396');await b.until('!!document.querySelector(".episodes-section .error-panel button")');
  failSeasons=false;await click('.episodes-section .error-panel button');await b.until('!document.querySelector(".episodes-section .error-panel") && !document.querySelector(".episodes-section [aria-busy=true]")');await sleep(400);
  check('Episode failure supports retry and an explicit empty state',await b.evaluate('document.querySelector(".episodes-section").textContent.toLowerCase().includes("no episodes")'));
  await b.send('Fetch.disable');

  for(const width of [390,320]){
    await b.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    await b.go('/watchlist');await b.until('!!document.querySelector(".library-backup")');
    check(`Library fits ${width}px viewport`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await b.screenshot(`ux-library-${width}.png`);
    await b.go('/discover?type=tv');await b.until('!!document.querySelector(".quick-genres")');
    check(`Discovery fits ${width}px viewport`,await b.evaluate('document.documentElement.scrollWidth<=innerWidth'));
    await click('.filter-trigger');await sleep(250);
    check(`Filter dialog fits ${width}px viewport`,await b.evaluate('(()=>{const r=document.querySelector(".filter-sheet").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight+1;})()'));
  }
  check('No uncaught browser JavaScript exceptions',b.errors.length===0);
  console.log('COMPLETE',checks.length,'checks');
}finally{if(second)await second.close();await b.close();}
