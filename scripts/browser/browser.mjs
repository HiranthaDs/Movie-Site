import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const endpoint=process.env.CINERA_CDP_URL||'http://localhost:9226';
const base=process.env.CINERA_TEST_URL||'http://localhost:5173';
export const artifact=name=>new URL(`../../.audit/browser/${name}`,import.meta.url);
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let connection,context;

async function connect(url){
  const ws=new WebSocket(url);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.close();reject(new Error('Browser connection timed out.'));},10000);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Could not connect to the browser.'));},{once:true});
  });
  let id=0;
  const pending=new Map(),events=new Map();
  const on=(name,handler)=>events.set(name,[...(events.get(name)||[]),handler]);
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.id){
      const request=pending.get(data.id);if(!request)return;
      pending.delete(data.id);clearTimeout(request.timer);
      data.error?request.reject(new Error(data.error.message)):request.resolve(data.result);
    }else for(const handler of events.get(data.method)||[])Promise.resolve().then(()=>handler(data.params)).catch(error=>{
      for(const report of events.get('client.error')||[])report(error);
    });
  });
  ws.addEventListener('close',()=>{
    for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Browser connection closed.'));}
    pending.clear();
  });
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const requestId=++id;
    const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error(`Browser command timed out: ${method}`));},20000);
    pending.set(requestId,{resolve,reject,timer});
    ws.send(JSON.stringify({id:requestId,method,params}));
  });
  return {send,on,close:()=>ws.close()};
}

export async function browser(width=1440,height=1000){
  if(!connection){
    const version=await (await fetch(`${endpoint}/json/version`)).json();
    connection=await connect(version.webSocketDebuggerUrl);
    // Every test page shares an isolated context, enabling cross-tab tests
    // without reading or changing the developer's ordinary browser storage.
    ({browserContextId:context}=await connection.send('Target.createBrowserContext'));
    await mkdir(artifact(''),{recursive:true});
  }
  const {targetId}=await connection.send('Target.createTarget',{url:'about:blank',browserContextId:context});
  const socketUrl=new URL(`/devtools/page/${targetId}`,endpoint);socketUrl.protocol=socketUrl.protocol==='https:'?'wss:':'ws:';
  const page=await connect(socketUrl.href),errors=[];
  const {send,on}=page;
  on('client.error',error=>errors.push(error.message));
  on('Runtime.exceptionThrown',event=>errors.push(event.exceptionDetails.exception?.description||event.exceptionDetails.text));
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const until=async(expression,timeout=15000)=>{
    const start=Date.now();
    while(Date.now()-start<timeout){if(await evaluate(expression))return;await sleep(100);}
    throw new Error(`Timed out: ${expression}`);
  };
  const go=async(path,wait=1400)=>{await send('Page.navigate',{url:new URL(path,base).href});await sleep(wait);};
  const screenshot=async name=>{
    const result=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    await writeFile(artifact(name),Buffer.from(result.data,'base64'));
  };
  const allowDownloads=()=>connection.send('Browser.setDownloadBehavior',{behavior:'allow',browserContextId:context,downloadPath:fileURLToPath(artifact(''))});
  return {send,on,evaluate,until,go,screenshot,errors,allowDownloads,close:async()=>{page.close();await connection.send('Target.closeTarget',{targetId});}};
}

export async function disposeBrowser(){
  if(!connection)return;
  try{if(context)await connection.send('Target.disposeBrowserContext',{browserContextId:context});}
  finally{connection.close();connection=null;context=null;}
}
