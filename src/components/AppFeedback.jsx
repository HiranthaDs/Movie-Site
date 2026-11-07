import React,{useEffect,useState,useSyncExternalStore} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {CheckCircle2,Info,WifiOff,X} from 'lucide-react';
import {dismissNotification,getNotifications,notify,subscribeNotifications} from '../lib/notifications';

function Toast({item}){
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  useEffect(()=>{
    if(hovered||focused)return;
    const timer=setTimeout(()=>dismissNotification(item.id),item.onAction?10000:6000);
    return()=>clearTimeout(timer);
  },[item.id,item.onAction,hovered,focused]);
  const act=()=>{
    dismissNotification(item.id);
    try{item.onAction?.();}catch{notify({message:'That action could not be completed. Please try again.',tone:'error'});}
  };
  return <div className={`app-toast toast-${item.tone}`} onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}}>
    {item.tone==='success'?<CheckCircle2 size={20}/>:<Info size={20}/>}
    <span>{item.message}</span>
    {item.onAction&&<button className="toast-action" onClick={act}>{item.actionLabel||'Undo'}</button>}
    <button className="toast-dismiss" onClick={()=>dismissNotification(item.id)} aria-label="Dismiss notification"><X size={17}/></button>
  </div>;
}

export function ToastViewport(){
  const items=useSyncExternalStore(subscribeNotifications,getNotifications,getNotifications);
  return createPortal(<div className="toast-viewport" role="region" aria-label="Notifications" aria-live="polite" aria-relevant="additions text">{items.map(item=><Toast key={item.id} item={item}/>)}</div>,document.body);
}

export function ConnectionNotice(){
  const [online,setOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{
    const offline=()=>setOnline(false);
    const reconnect=()=>{setOnline(true);notify({message:'You’re back online.',tone:'success'});};
    window.addEventListener('offline',offline);window.addEventListener('online',reconnect);
    return()=>{window.removeEventListener('offline',offline);window.removeEventListener('online',reconnect);};
  },[]);
  if(online)return null;
  return <div className="connection-notice" role="status"><WifiOff size={17}/><span>You’re offline. Your saved list is still here; streaming needs a connection.</span><Link to="/watchlist">My list</Link></div>;
}
