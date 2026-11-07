import test from 'node:test';
import assert from 'node:assert/strict';
import {api,clearApiCache} from '../src/lib/api.js';

const flush=async()=>{for(let index=0;index<12;index+=1)await Promise.resolve();};
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
const setup=t=>{clearApiCache();t.after(()=>clearApiCache());};

test('cached data still respects an already aborted caller',async t=>{
  setup(t);
  const fetch=t.mock.method(globalThis,'fetch',async()=>response({results:['cached']}));
  await api('/api/search?q=cached');
  const controller=new AbortController();controller.abort();
  await assert.rejects(api('/api/search?q=cached',controller.signal),{name:'AbortError'});
  assert.equal(fetch.mock.callCount(),1);
});

test('a client error with a non-JSON body is not retried',async t=>{
  setup(t);
  const fetch=t.mock.method(globalThis,'fetch',async()=>({ok:false,status:404,json:async()=>{throw new SyntaxError('HTML');}}));
  await assert.rejects(api('/api/title/movie/missing'),error=>error.status===404&&error.message.includes('404'));
  assert.equal(fetch.mock.callCount(),1);
});

test('a transient server failure retries once and caches a successful result',async t=>{
  setup(t);t.mock.timers.enable({apis:['setTimeout']});
  let calls=0;
  t.mock.method(globalThis,'fetch',async()=>++calls===1?response({error:'Temporarily unavailable'},503):response({results:['recovered']}));
  const pending=api('/api/home');
  await flush();t.mock.timers.tick(350);await flush();
  assert.deepEqual(await pending,{results:['recovered']});
  assert.deepEqual(await api('/api/home'),{results:['recovered']});
  assert.equal(calls,2);
});

test('abort during retry backoff stops immediately without another request',async t=>{
  setup(t);t.mock.timers.enable({apis:['setTimeout']});
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('Failed to fetch');});
  const controller=new AbortController();
  const pending=api('/api/home',controller.signal);
  const rejected=assert.rejects(pending,{name:'AbortError'});
  await flush();controller.abort();await rejected;
  t.mock.timers.tick(20000);await flush();
  assert.equal(fetch.mock.callCount(),1);
});

test('a caller can abort a fetch adapter that ignores its signal without caching its late result',async t=>{
  setup(t);
  let resolveOld,calls=0;
  t.mock.method(globalThis,'fetch',()=>++calls===1?new Promise(resolve=>{resolveOld=resolve;}):Promise.resolve(response({value:'new'})));
  const controller=new AbortController();
  const pending=api('/api/home',controller.signal);
  const rejected=assert.rejects(pending,{name:'AbortError'});
  controller.abort();await rejected;
  resolveOld(response({value:'stale'}));await flush();
  assert.deepEqual(await api('/api/home'),{value:'new'});
  assert.equal(calls,2);
});

test('the response body is bounded by the timeout even when it ignores abort',async t=>{
  setup(t);t.mock.timers.enable({apis:['setTimeout']});
  const fetch=t.mock.method(globalThis,'fetch',async()=>({ok:true,status:200,json:()=>new Promise(()=>{})}));
  const pending=api('/api/home');
  const rejected=assert.rejects(pending,error=>error.code==='API_TIMEOUT'&&error.message.includes('too long'));
  await flush();t.mock.timers.tick(14000);await flush();
  t.mock.timers.tick(350);await flush();
  t.mock.timers.tick(14000);await flush();await rejected;
  assert.equal(fetch.mock.callCount(),2);
});

test('network failures expose a useful connection message after one retry',async t=>{
  setup(t);t.mock.timers.enable({apis:['setTimeout']});
  const fetch=t.mock.method(globalThis,'fetch',async()=>{throw new TypeError('fetch failed');});
  const pending=api('/api/home');
  const rejected=assert.rejects(pending,/Check your connection/);
  await flush();t.mock.timers.tick(350);await flush();await rejected;
  assert.equal(fetch.mock.callCount(),2);
});

test('a fresh request bypasses a cached response and prefix invalidation is scoped',async t=>{
  setup(t);
  let value=0;
  t.mock.method(globalThis,'fetch',async()=>response({value:++value}));
  assert.deepEqual(await api('/api/home'),{value:1});
  assert.deepEqual(await api('/api/title/movie/1'),{value:2});
  assert.deepEqual(await api('/api/home',undefined,{fresh:true}),{value:3});
  clearApiCache('/api/title/');
  assert.deepEqual(await api('/api/home'),{value:3});
  assert.deepEqual(await api('/api/title/movie/1'),{value:4});
});
