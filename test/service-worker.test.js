import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');
function worker({fetch,caches}){
  const listeners={};
  vm.runInNewContext(source,{fetch,caches,URL,Response,Promise,self:{location:{origin:'https://cinera.test'},addEventListener:(name,handler)=>{listeners[name]=handler;}}});
  return (path,options={})=>{
    let pending;
    listeners.fetch({request:{method:'GET',url:`https://cinera.test${path}`,...options},respondWith:value=>{pending=value;},waitUntil:value=>{options.background?.push(value);}});
    return pending;
  };
}

test('private pairing and expiring playback endpoints never touch offline caches',async()=>{
  let requests=0;
  const dispatch=worker({fetch:async(_request,options)=>{requests+=1;assert.equal(options.cache,'no-store');return new Response('fresh');},caches:{open:()=>{throw new Error('must not access cache');}}});
  for(const path of ['/api/remote/create','/api/remote','/api/sources/movie/1']){
    assert.equal(await (await dispatch(path)).text(),'fresh');
  }
  assert.equal(requests,3);
});

test('offline playback and pairing requests fail clearly rather than replay stale responses',async()=>{
  let cacheReads=0;
  const dispatch=worker({fetch:async()=>{throw new TypeError('offline');},caches:{open:async()=>{cacheReads+=1;return {match:async()=>new Response('stale secret')};}}});
  const result=await dispatch('/api/sources/movie/1');
  assert.equal(result.status,503);assert.equal(cacheReads,0);
});

test('successful catalog responses survive a full or unavailable cache',async()=>{
  for(const failure of ['open','put']){
    const dispatch=worker({fetch:async()=>new Response('{"results":[1]}'),caches:{open:async()=>{
      if(failure==='open')throw new Error('storage disabled');
      return {put:async()=>{throw new Error('quota exceeded');}};
    }}});
    const result=await dispatch('/api/home');
    assert.equal(result.status,200);assert.deepEqual(await result.json(),{results:[1]});
  }
});

test('offline catalog requests can still use previously cached metadata',async()=>{
  const dispatch=worker({fetch:async()=>{throw new TypeError('offline');},caches:{open:async()=>({match:async()=>new Response('{"results":[2]}')})}});
  assert.deepEqual(await (await dispatch('/api/home')).json(),{results:[2]});
});

test('scripts and styles still load when cache access or writes fail',async()=>{
  for(const failure of ['open','match','put']){
    const dispatch=worker({fetch:async()=>new Response('asset'),caches:{open:async()=>{
      if(failure==='open')throw new Error('storage disabled');
      return {match:async()=>{if(failure==='match')throw new Error('unreadable');},put:async()=>{if(failure==='put')throw new Error('full');}};
    }}});
    assert.equal(await (await dispatch('/assets/app.js',{destination:'script'})).text(),'asset');
  }
});

test('cached assets respond immediately while revalidation stays alive',async()=>{
  let finishNetwork,written=false;
  const background=[];
  const dispatch=worker({fetch:()=>new Promise(resolve=>{finishNetwork=resolve;}),caches:{open:async()=>({match:async()=>new Response('cached'),put:async(_request,response)=>{assert.equal(await response.text(),'updated');written=true;}})}});
  assert.equal(await (await dispatch('/assets/app.css',{destination:'style',background})).text(),'cached');
  assert.equal(background.length,1);
  assert.equal(written,false);
  finishNetwork(new Response('updated'));
  await Promise.all(background);
  assert.equal(written,true);
});

test('offline assets use the cache or return an explicit unavailable response',async()=>{
  for(const available of [true,false]){
    const dispatch=worker({fetch:async()=>{throw new Error('offline');},caches:{open:async()=>({match:async()=>available?new Response('cached'):null})}});
    const response=await dispatch('/assets/app.js',{destination:'script'});
    assert.equal(response.status,available?200:503);
  }
});

test('navigation caches a single shell without retaining private query strings',async()=>{
  const keys=[];
  const dispatch=worker({fetch:async()=>new Response('<html>shell</html>'),caches:{open:async()=>({put:async key=>keys.push(key)})}});
  for(const path of ['/remote?pair=private-token','/search?q=private-search','/watch/movie/1']){
    assert.equal((await dispatch(path,{mode:'navigate'})).status,200);
  }
  assert.deepEqual(keys,['/','/','/']);
});
