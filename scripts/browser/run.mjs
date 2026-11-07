import {disposeBrowser} from './browser.mjs';

try{
  for(const suite of ['library','playback','direct','remote'])await import(`./${suite}-check.mjs`);
  console.log('Browser regression checks passed. Screenshots are in .audit/browser/.');
}finally{await disposeBrowser();}
