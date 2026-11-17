import {useCallback,useEffect,useState} from 'react';

let deferredPrompt=null;
let installed=false;
let initialized=false;
const listeners=new Set();
const updateListeners=new Set();
let waitingUpdate=null;

const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const isiOS=()=>/iphone|ipad|ipod/i.test(window.navigator.userAgent);
const snapshot=()=>({canInstall:Boolean(deferredPrompt),installed:installed||standalone(),isiOS:isiOS()});
const notify=()=>listeners.forEach(listener=>listener(snapshot()));

export function initializePwa(){
  if(initialized||typeof window==='undefined')return;
  initialized=true;
  installed=standalone();
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    deferredPrompt=event;
    notify();
  });
  window.addEventListener('appinstalled',()=>{
    deferredPrompt=null;
    installed=true;
    notify();
  });
  const displayMode=window.matchMedia?.('(display-mode: standalone)');
  displayMode?.addEventListener?.('change',()=>{installed=standalone();notify();});
}

export function registerServiceWorker(){
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(registration=>{
      const ready=worker=>{
        const candidate=registration.waiting||worker;
        if(!candidate||!navigator.serviceWorker.controller)return;
        waitingUpdate=candidate;
        updateListeners.forEach(listener=>listener(true));
      };
      ready();
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed')ready(worker);});
      });
      const check=()=>{if(!document.hidden)registration.update().catch(()=>{});};
      document.addEventListener('visibilitychange',check);
      window.addEventListener('online',check);
      window.setInterval(check,60*60*1000);
      check();
    }).catch(error=>{
      console.warn('[pwa] Service worker registration failed:',error.message);
    });
  },{once:true});
}

export function useAppUpdate(){
  const [available,setAvailable]=useState(Boolean(waitingUpdate));
  useEffect(()=>{
    updateListeners.add(setAvailable);
    return()=>updateListeners.delete(setAvailable);
  },[]);
  const apply=useCallback(()=>{
    if(!waitingUpdate)return;
    navigator.serviceWorker.addEventListener('controllerchange',()=>window.location.reload(),{once:true});
    waitingUpdate.postMessage({type:'SKIP_WAITING'});
  },[]);
  return {available,apply};
}

export function usePwaInstall(){
  const [state,setState]=useState(()=>snapshot());
  useEffect(()=>{
    const listener=next=>setState(next);
    listeners.add(listener);
    setState(snapshot());
    return()=>listeners.delete(listener);
  },[]);
  const install=useCallback(async()=>{
    if(!deferredPrompt)return {outcome:'unavailable'};
    const prompt=deferredPrompt;
    deferredPrompt=null;
    notify();
    const result=await prompt.prompt();
    const choice=result?.outcome?result:await prompt.userChoice;
    if(choice?.outcome==='accepted')installed=true;
    notify();
    return choice||{outcome:'dismissed'};
  },[]);
  return {...state,install};
}
