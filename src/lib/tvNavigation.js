import {exitFullscreen,fullscreenElement} from './mediaCompat.js';

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const TV_USER_AGENT=/Android TV|GoogleTV|SMART[- ]?TV|SmartTV|HbbTV|NetCast|Web0S|webOS|Tizen|BRAVIA|SHIELD|AFT[A-Z0-9]+|CrKey|Roku|MIBOX|MiTV|Mi TV|TV Box|TV Stick/i;
const REMOTE_KEYS={
  4:'BrowserBack',13:'Enter',19:'ArrowUp',20:'ArrowDown',21:'ArrowLeft',22:'ArrowRight',23:'Enter',
  37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',415:'MediaPlay',461:'BrowserBack',10009:'BrowserBack',
};
const REMOTE_KEY_NAMES={
  Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown',
  Select:'Enter',Accept:'Enter',OK:'Enter',
  Back:'BrowserBack',Return:'BrowserBack',GoBack:'BrowserBack',XF86Back:'BrowserBack',
};
let initialized=false;

export const normalizeRemoteKey=event=>{
  const key=event?.key;
  if(key&&key!=='Unidentified'){
    return REMOTE_KEY_NAMES[key]||key;
  }
  return REMOTE_KEYS[event?.keyCode||event?.which]||'';
};

const androidLeanbackFallback=({userAgent='',width=0,height=0,touchPoints=0})=>/Android/i.test(userAgent)&&touchPoints===0&&width>=800&&width>height*1.35;

export const detectTvIdentity=({userAgent='',width=0,height=0,touchPoints=0,tvQuery=false}={})=>tvQuery||TV_USER_AGENT.test(userAgent)||androidLeanbackFallback({userAgent,width,height,touchPoints});

export const detectTvDevice=({userAgent='',width=0,height=0,coarse=false,touchPoints=0,tvQuery=false}={})=>{
  if(detectTvIdentity({userAgent,width,height,touchPoints,tvQuery}))return true;
  return coarse&&width>=800&&width>height*1.35;
};

const visible=element=>{
  const rect=element.getBoundingClientRect();
  const style=getComputedStyle(element);
  return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&Number(style.opacity)!==0&&!element.closest('[aria-hidden="true"],[inert]');
};

const onScreen=element=>{
  const rect=element.getBoundingClientRect();
  return rect.bottom>0&&rect.right>0&&rect.top<window.innerHeight&&rect.left<window.innerWidth;
};

const focusAndReveal=(element,smooth=false)=>{
  if(!element)return;
  try{element.focus({preventScroll:true});}catch{element.focus();}
  try{element.scrollIntoView({block:'nearest',inline:'nearest',behavior:smooth?'smooth':'auto'});}catch{element.scrollIntoView(false);}
};

const navigationRoot=()=>document.querySelector('[role="dialog"][aria-modal="true"]')||document.querySelector('.menu-panel.is-open')||document;
const focusCandidates=root=>[...root.querySelectorAll(FOCUSABLE)].filter(element=>visible(element)&&!element.matches('.skip-link'));

const handleRemoteBack=()=>{
  if(fullscreenElement(document)){
    exitFullscreen(document).catch(()=>{});
    return true;
  }
  const dialog=document.querySelector('[role="dialog"][aria-modal="true"]');
  const close=dialog?.querySelector('[aria-label^="Close"],.search-cancel,.filter-close,.shortcut-close,.external-player-cancel');
  if(close){close.click();return true;}
  const expanded=document.querySelector('[aria-expanded="true"][aria-controls]');
  if(expanded){expanded.click();return true;}
  if(window.location.pathname!=='/'&&window.history.length>1){window.history.back();return true;}
  return false;
};

export function initializeTvNavigation(){
  if(initialized||typeof window==='undefined')return;
  initialized=true;
  const applyTvClass=()=>{
    const tvQuery=new URLSearchParams(window.location.search).get('tv')==='1';
    const coarse=window.matchMedia?.('(hover: none) and (pointer: coarse)').matches||false;
    const device={userAgent:navigator.userAgent,width:window.innerWidth,height:window.innerHeight,coarse,touchPoints:navigator.maxTouchPoints||0,tvQuery};
    const tvIdentity=detectTvIdentity(device);
    const isTv=detectTvDevice(device);
    document.documentElement.classList.toggle('tv-ui',isTv);
    document.documentElement.classList.toggle('tv-device',tvIdentity);
  };
  applyTvClass();
  window.addEventListener('resize',applyTvClass,{passive:true});
  window.addEventListener('pointerdown',()=>document.documentElement.classList.remove('remote-input'),{passive:true});
  window.addEventListener('keydown',event=>{
    const key=normalizeRemoteKey(event);
    document.documentElement.classList.add('remote-input');
    if(key==='BrowserBack'){
      if(handleRemoteBack())event.preventDefault();
      return;
    }
    if(key==='Enter'&&(!event.key||event.key==='Unidentified')&&document.activeElement?.matches?.('button,a[href]')){
      event.preventDefault();
      document.activeElement.click();
      return;
    }
    if(key==='Enter'&&(!document.activeElement||document.activeElement===document.body)){
      const root=navigationRoot();
      const candidates=focusCandidates(root);
      const first=root.querySelector('[data-tv-autofocus]')||candidates.find(onScreen)||candidates[0];
      if(first){event.preventDefault();focusAndReveal(first);}
      return;
    }
    if(event.defaultPrevented||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key))return;
    const active=document.activeElement;
    if(active?.matches('input,select,textarea,[contenteditable="true"]')||active?.closest('[data-native-arrows="true"]'))return;
    const root=navigationRoot();
    const candidates=focusCandidates(root);
    if(!candidates.length)return;
    if(!active||!candidates.includes(active)){
      event.preventDefault();
      const first=root.querySelector('[data-tv-autofocus]')||candidates.find(onScreen)||candidates[0];
      focusAndReveal(first);
      return;
    }
    const origin=active.getBoundingClientRect();
    const ox=origin.left+origin.width/2,oy=origin.top+origin.height/2;
    const vertical=key==='ArrowUp'||key==='ArrowDown';
    const positive=key==='ArrowRight'||key==='ArrowDown';
    let best=null,bestScore=Infinity;
    for(const candidate of candidates){
      if(candidate===active)continue;
      const rect=candidate.getBoundingClientRect();
      const dx=rect.left+rect.width/2-ox,dy=rect.top+rect.height/2-oy;
      const primary=(vertical?dy:dx)*(positive?1:-1);
      if(primary<=4)continue;
      const secondary=Math.abs(vertical?dx:dy);
      const score=primary+secondary*2+(secondary>primary*2?1000:0);
      if(score<bestScore){best=candidate;bestScore=score;}
    }
    if(!best)return;
    event.preventDefault();
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    focusAndReveal(best,!reduced);
  });
}
