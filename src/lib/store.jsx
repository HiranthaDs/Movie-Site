import React,{createContext,useContext,useCallback,useEffect,useRef,useState} from 'react';
import {keyOf,storageRead} from './api';
import {LIBRARY_LIMITS,normalizeTitle,normalizeLibrary,normalizeProgress,mergeLibrary,createLibraryBackup,parseLibraryBackup} from './library';
import {notify} from './notifications';

const Context=createContext(null);
const readLibrary=()=>normalizeLibrary({saved:storageRead('cinera_saved',[]),history:storageRead('cinera_history',[]),progress:storageRead('cinera_progress',{})});

export function StoreProvider({children}) {
  const [library,setLibrary]=useState(readLibrary);
  const current=useRef(library),storageWarning=useRef(false);
  // Stable callbacks keep player subscriptions intact during progress updates.
  const commit=useCallback((update,fields)=>{
    const next=update(current.current);current.current=next;setLibrary(next);
    let persisted=true;
    for(const field of fields){
      try{localStorage.setItem(`cinera_${field}`,JSON.stringify(next[field]));}
      catch{persisted=false;}
    }
    if(!persisted&&!storageWarning.current){
      storageWarning.current=true;
      notify({message:'Browser storage is unavailable. Changes will last for this session; export a backup to keep them.',tone:'error'});
    }
    return persisted;
  },[]);

  useEffect(()=>{
    const sync=event=>{
      if(event.key!==null&&!['cinera_saved','cinera_history','cinera_progress'].includes(event.key))return;
      try{if(event.storageArea&&event.storageArea!==localStorage)return;}catch{return;}
      const incoming=readLibrary();
      const field=event.key?.replace('cinera_','');
      const next=field?{...current.current,[field]:incoming[field]}:incoming;
      current.current=next;setLibrary(next);
    };
    window.addEventListener('storage',sync);
    return()=>window.removeEventListener('storage',sync);
  },[]);

  const toggleSaved=useCallback(raw=>{
    const item=normalizeTitle(raw);if(!item)return;
    const prior=current.current.saved.find(entry=>keyOf(entry)===keyOf(item));
    const index=current.current.saved.findIndex(entry=>keyOf(entry)===keyOf(item));
    if(!prior&&current.current.saved.length>=LIBRARY_LIMITS.saved){
      notify({message:'Your watchlist has 100 titles. Remove a title before adding another.',tone:'error'});return;
    }
    commit(prev=>({...prev,saved:prior?prev.saved.filter(entry=>keyOf(entry)!==keyOf(item)):[{...item,savedAt:Date.now()},...prev.saved]}),['saved']);
    notify({message:prior?`${item.title} removed from your list.`:`${item.title} added to your list.`,actionLabel:'Undo',onAction:()=>{
      commit(prev=>{
        const saved=prev.saved.filter(entry=>keyOf(entry)!==keyOf(item));
        if(prior)saved.splice(Math.min(index,saved.length),0,prior);
        return {...prev,saved:saved.slice(0,LIBRARY_LIMITS.saved)};
      },['saved']);
    }});
  },[commit]);

  const markWatched=useCallback((raw,season=1,episode=1)=>{
    const item=normalizeTitle({...raw,season,episode,lastWatched:Date.now()});if(!item)return;
    commit(prev=>({...prev,history:[item,...prev.history.filter(entry=>keyOf(entry)!==keyOf(item))].slice(0,LIBRARY_LIMITS.history)}),['history']);
  },[commit]);
  const saveProgress=useCallback((item,seconds,duration,season=1,episode=1)=>{
    if(!normalizeTitle(item)||!Number.isFinite(seconds)||seconds<0)return;
    const key=`${keyOf(item)}:${season}:${episode}`;
    commit(prev=>({...prev,progress:normalizeProgress({...prev.progress,[key]:{seconds,duration:Number.isFinite(Number(duration))?Math.max(0,Number(duration)):0,updatedAt:Date.now()}})}),['progress']);
  },[commit]);
  const getProgress=useCallback((item,season=1,episode=1)=>current.current.progress[`${keyOf(item)}:${season}:${episode}`]||null,[]);
  const clearProgress=useCallback((item,season=1,episode=1)=>commit(prev=>{
    const progress={...prev.progress};delete progress[`${keyOf(item)}:${season}:${episode}`];return {...prev,progress};
  },['progress']),[commit]);
  const restoreHistory=useCallback(items=>commit(prev=>mergeLibrary(prev,{history:items}),['history']),[commit]);
  const removeHistory=useCallback(item=>{
    const prior=current.current.history.find(entry=>keyOf(entry)===keyOf(item));if(!prior)return;
    commit(prev=>({...prev,history:prev.history.filter(entry=>keyOf(entry)!==keyOf(item))}),['history']);
    notify({message:`${item.title} removed from continue watching.`,actionLabel:'Undo',onAction:()=>restoreHistory([prior])});
  },[commit,restoreHistory]);
  const clearHistory=useCallback(()=>{
    const prior=current.current.history;if(!prior.length)return;
    commit(prev=>({...prev,history:[]}),['history']);
    notify({message:'Continue watching cleared. Your playback positions are kept.',actionLabel:'Undo',onAction:()=>restoreHistory(prior)});
  },[commit,restoreHistory]);
  const isSaved=useCallback(item=>library.saved.some(entry=>keyOf(entry)===keyOf(item)),[library.saved]);
  const exportLibrary=useCallback(()=>createLibraryBackup(current.current),[]);
  const importLibrary=useCallback(text=>{
    const incoming=parseLibraryBackup(text);
    const persisted=commit(prev=>mergeLibrary(prev,incoming),['saved','history','progress']);
    return {saved:current.current.saved.length,history:current.current.history.length,persisted};
  },[commit]);

  return <Context.Provider value={{...library,isSaved,toggleSaved,markWatched,saveProgress,getProgress,clearProgress,removeHistory,clearHistory,restoreHistory,exportLibrary,importLibrary}}>{children}</Context.Provider>;
}
export const useStore=()=>useContext(Context);
