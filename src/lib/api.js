const responseCache=new Map();
const API_TIMEOUT=14000;

const ttlFor=url=>url.includes('/api/sources/')?15000:url.includes('/api/home')?120000:url.includes('/api/title/')?300000:90000;
const abortError=()=>{
  if(typeof DOMException==='function')return new DOMException('The request was aborted.','AbortError');
  const error=new Error('The request was aborted.');error.name='AbortError';return error;
};
const timeoutError=()=>{
  const error=new Error('The server took too long to respond. Please try again.');
  error.code='API_TIMEOUT';return error;
};
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const done=()=>{signal?.removeEventListener('abort',cancel);resolve();};
  const timer=setTimeout(done,ms);
  const cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(abortError());};
  signal?.addEventListener('abort',cancel,{once:true});
});

async function readResponse(response){
  let data;
  try{data=await response.json();}catch{
    // Keep HTTP status even when an upstream error page is HTML rather than JSON.
    const error=new Error(response.ok?'The server returned an unreadable response. Please try again.':`Could not load this content (HTTP ${response.status}).`);
    if(!response.ok)error.status=response.status;
    throw error;
  }
  if(!response.ok){
    const error=new Error(typeof data?.error==='string'?data.error:`Could not load this content (HTTP ${response.status}).`);
    error.status=response.status;throw error;
  }
  return data;
}

export async function api(url,signal,{fresh=false}={}){
  if(signal?.aborted)throw abortError();
  const cached=responseCache.get(url);
  if(!fresh&&cached&&cached.expires>Date.now())return cached.data;
  let lastError;
  for(let attempt=0;attempt<2;attempt+=1){
    if(signal?.aborted)throw abortError();
    const controller=new AbortController();
    let timedOut=false,rejectCancellation;
    const cancellation=new Promise((_,reject)=>{rejectCancellation=reject;});
    const abortFromCaller=()=>{rejectCancellation(abortError());controller.abort();};
    signal?.addEventListener('abort',abortFromCaller,{once:true});
    const timeout=setTimeout(()=>{timedOut=true;rejectCancellation(timeoutError());controller.abort();},API_TIMEOUT);
    try{
      // Race the entire response, including its body. Some legacy fetch adapters
      // do not reject when aborted, so AbortController alone cannot bound a request.
      const request=fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}}).then(readResponse);
      const data=await Promise.race([request,cancellation]);
      if(signal?.aborted)throw abortError();
      if(timedOut)throw timeoutError();
      responseCache.set(url,{data,expires:Date.now()+ttlFor(url)});
      if(responseCache.size>180)responseCache.delete(responseCache.keys().next().value);
      return data;
    }catch(error){
      if(signal?.aborted)throw abortError();
      lastError=timedOut?timeoutError():error;
      if(lastError instanceof TypeError){
        lastError=new Error('Could not reach Cinera. Check your connection and try again.');
      }
      const retryable=!lastError.status||lastError.status>=500;
      if(!retryable||attempt===1)throw lastError;
    }finally{
      clearTimeout(timeout);
      signal?.removeEventListener('abort',abortFromCaller);
    }
    // Clean up the previous attempt before waiting, and stop immediately when
    // a route change or new search cancels the caller's request during backoff.
    await pause(350,signal);
  }
  throw lastError||new Error('Request failed.');
}

export const clearApiCache=prefix=>{for(const key of responseCache.keys())if(!prefix||key.startsWith(prefix))responseCache.delete(key);};
export const img=(path,size='w500')=>path?`https://image.tmdb.org/t/p/${size}${path}`:null;
export const keyOf=item=>`${item.kind}:${item.id}`;
export const prettyRuntime=n=>n?`${Math.floor(n/60)}h ${n%60}m`:'—';
export const rating=n=>n?Number(n).toFixed(1):'NR';
export const truncated=(value,max=185)=>value?.length>max?`${value.slice(0,max).trim()}…`:value;
export const storageRead=(key,fallback)=>{try{const value=JSON.parse(localStorage.getItem(key));return value??fallback;}catch{return fallback;}};
