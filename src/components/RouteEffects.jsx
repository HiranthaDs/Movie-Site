import {useEffect,useLayoutEffect,useRef} from 'react';
import {useLocation,useNavigationType} from 'react-router-dom';

const pageTitles={'/':'Find your next story','/movies':'Movies','/series':'TV series','/discover':'Discover','/search':'Search','/watchlist':'My list','/pair':'Pair a remote','/remote':'Phone remote'};

export default function RouteEffects(){
  const location=useLocation(),navigation=useNavigationType();
  const positions=useRef(new Map()),previous=useRef(null);
  useEffect(()=>{
    const old=window.history.scrollRestoration;
    window.history.scrollRestoration='manual';
    return()=>{window.history.scrollRestoration=old;};
  },[]);
  useLayoutEffect(()=>{
    const last=previous.current;
    previous.current=location;
    document.title=`${pageTitles[location.pathname]||(location.pathname.startsWith('/watch/')?'Watch':location.pathname.startsWith('/title/')?'Title details':'Page not found')} · Cinera`;
    // Selecting a playback server must never move the player out of view.
    const playerUpdate=last?.pathname===location.pathname&&location.pathname.startsWith('/watch/');
    const target=navigation==='POP'?positions.current.get(location.key):null;
    let restoring=Boolean(target&&!playerUpdate),frame=0,observer;
    const save=()=>{if(!restoring){positions.current.set(location.key,{x:window.scrollX,y:window.scrollY});if(positions.current.size>80)positions.current.delete(positions.current.keys().next().value);}};
    const restore=()=>{
      if(!restoring)return;
      window.scrollTo({left:target.x,top:target.y,behavior:'instant'});
      if(Math.abs(window.scrollY-target.y)<2){restoring=false;observer?.disconnect();}
    };
    if(restoring){
      // A lazy route may need a frame or a network response before it has its full height.
      observer=new MutationObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(restore);});
      observer.observe(document.getElementById('main-content'),{childList:true,subtree:true});
      frame=requestAnimationFrame(restore);
    }else if(!playerUpdate){window.scrollTo({top:0,left:0,behavior:'instant'});}
    const stopRestoring=()=>{restoring=false;observer?.disconnect();};
    const timeout=setTimeout(stopRestoring,8000);
    window.addEventListener('scroll',save,{passive:true});
    window.addEventListener('wheel',stopRestoring,{passive:true});
    window.addEventListener('touchstart',stopRestoring,{passive:true});
    return()=>{clearTimeout(timeout);cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('scroll',save);window.removeEventListener('wheel',stopRestoring);window.removeEventListener('touchstart',stopRestoring);};
  },[location.key,location.pathname,navigation]);
  return null;
}
