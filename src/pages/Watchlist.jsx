import React,{useMemo,useRef,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {Heart,Clock3,Trash2,X,Search,Download,Upload,Play,ArrowUpRight,Check,LoaderCircle} from 'lucide-react';
import {Card,EmptyState} from '../components/UI';
import {useStore} from '../lib/store';
import {BACKUP_MAX_BYTES,filterLibrary,resumePath} from '../lib/library';
import {notify} from '../lib/notifications';
import '../library.css';

function readFile(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('This file could not be read. Please choose it again.'));
    reader.readAsText(file);
  });
}

export default function Watchlist(){
  const {saved,history,removeHistory,clearHistory,getProgress,clearProgress,exportLibrary,importLibrary}=useStore();
  const [params,setParams]=useSearchParams();
  const tab=params.get('tab')==='history'?'history':'saved';
  const [query,setQuery]=useState(''),[kind,setKind]=useState('all'),[sort,setSort]=useState('recent');
  const [confirmClear,setConfirmClear]=useState(false),[importing,setImporting]=useState(false);
  const fileInput=useRef(null);
  const items=tab==='saved'?saved:history;
  const results=useMemo(()=>filterLibrary(items,{query,kind,sort}),[items,query,kind,sort]);
  const changeTab=value=>{setConfirmClear(false);const next=new URLSearchParams(params);if(value==='history')next.set('tab','history');else next.delete('tab');setParams(next,{replace:true});};
  const resetFilters=()=>{setQuery('');setKind('all');setSort('recent');};
  const download=()=>{
    let url;
    try{
      const backup=exportLibrary();
      url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`cinera-library-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);link.click();link.remove();
      notify({message:'Your library backup is ready to download.'});
    }catch{notify({message:'The backup could not be downloaded. Please try again.',tone:'error'});}
    finally{if(url)setTimeout(()=>URL.revokeObjectURL(url),10000);}
  };
  const upload=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setImporting(true);
    try{
      if(file.size>BACKUP_MAX_BYTES)throw new Error('Choose a Cinera backup smaller than 2 MB.');
      const result=importLibrary(await readFile(file));
      notify({message:result.persisted?`Backup merged. Your library has ${result.saved} saved titles and ${result.history} recently watched titles.`:'Backup merged for this session. Browser storage is unavailable; keep your backup file.',tone:result.persisted?'success':'error'});
    }catch(error){notify({message:error.message||'The backup could not be imported.',tone:'error'});}
    finally{setImporting(false);}
  };
  return <div className="content-width catalog-page watchlist-page">
    <div className="catalog-heading library-heading"><div className="eyebrow">YOUR OWN PERSONAL COLLECTION</div><h1>My list<span>.</span></h1><p>Great stories, kept close. Save your next watch or pick up right where you left off.</p></div>
    <div className="library-overview" aria-label="Your library at a glance"><div><Heart size={20}/><strong>{saved.length}</strong><span>saved for later</span></div><div><Clock3 size={20}/><strong>{history.length}</strong><span>recently watched</span></div><Link to="/discover">Find your next story <ArrowUpRight size={17}/></Link></div>
    <div className="watchlist-toolbar library-tabs"><div className="browse-tabs" aria-label="Library collection"><button type="button" className={tab==='saved'?'active':''} aria-pressed={tab==='saved'} onClick={()=>changeTab('saved')}><Heart size={17}/> Watchlist <span className="tab-counter">{saved.length}</span></button><button type="button" className={tab==='history'?'active':''} aria-pressed={tab==='history'} onClick={()=>changeTab('history')}><Clock3 size={17}/> Continue watching <span className="tab-counter">{history.length}</span></button></div>{tab==='history'&&history.length>0&&<button type="button" className="clear-history" aria-expanded={confirmClear} onClick={()=>setConfirmClear(value=>!value)}><Trash2 size={15}/> Clear history</button>}</div>
    {confirmClear&&tab==='history'&&<div className="library-clear-confirm"><p>Clear your continue-watching list? Your saved titles and playback positions will stay.</p><div><button type="button" onClick={()=>setConfirmClear(false)}>Keep history</button><button type="button" className="confirm-remove" onClick={()=>{clearHistory();setConfirmClear(false);}}>Clear history</button></div></div>}
    {items.length>0&&<><div className="library-filters"><label className="library-search"><Search size={18}/><span className="sr-only">Search your {tab==='saved'?'watchlist':'history'}</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a title in your list…" autoComplete="off"/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear library search"><X size={16}/></button>}</label><label className="library-select"><span>Show</span><select value={kind} onChange={event=>setKind(event.target.value)} aria-label="Filter library by type"><option value="all">All titles</option><option value="movie">Movies</option><option value="tv">TV series</option></select></label><label className="library-select"><span>Sort</span><select value={sort} onChange={event=>setSort(event.target.value)} aria-label="Sort library"><option value="recent">Recently {tab==='saved'?'saved':'watched'}</option><option value="title">Title A–Z</option><option value="rating">Highest rated</option><option value="year">Newest release</option></select></label></div><div className="library-result-count" role="status" aria-live="polite"><span>{results.length} of {items.length} title{items.length===1?'':'s'}</span>{(query||kind!=='all')&&<button type="button" onClick={resetFilters}>Reset filters <X size={12}/></button>}</div></>}
    {results.length?<div className="catalog-grid library-grid">{results.map(item=>{
      const position=getProgress(item,item.season||1,item.episode||1);
      const complete=position?.duration>0&&position.seconds/position.duration>=0.98;
      const remaining=position?.duration>position?.seconds?Math.ceil((position.duration-position.seconds)/60):0;
      return <div className="managed-history-card library-card" key={`${item.kind}-${item.id}`}><Card item={item}/>{tab==='history'&&<><button type="button" className="remove-history" onClick={()=>removeHistory(item)} aria-label={`Remove ${item.title} from Continue Watching`} title="Remove from continue watching"><X size={15}/></button><div className="library-resume-meta">{item.kind==='tv'?`S${item.season||1} · E${item.episode||1}`:'Movie'}<span>{complete?<><Check size={12}/> Watched</>:remaining?`${remaining} min left`:position?.seconds>0?`${Math.floor(position.seconds/60)} min watched`:'Ready to watch'}</span></div><Link className="library-resume" to={resumePath(item)} onClick={()=>{if(complete)clearProgress(item,item.season||1,item.episode||1);}} aria-label={`${complete?'Watch again':position?.seconds>0?'Resume':'Watch'} ${item.title}${item.kind==='tv'?`, season ${item.season||1}, episode ${item.episode||1}`:''}`}><Play size={13} fill="currentColor"/>{complete?'Watch again':position?.seconds>0?'Resume':'Watch'}<ArrowUpRight size={14}/></Link></>}</div>;
    })}</div>:items.length?<div className="library-no-results"><Search size={30}/><h2>No titles match yet</h2><p>Try another name or show all titles in this collection.</p><button type="button" className="button button-outline" onClick={resetFilters}>Reset filters</button></div>:<EmptyState icon={tab==='saved'?<Heart size={34}/>:<Clock3 size={34}/>} title={tab==='saved'?'Your next favorites go here':'Your next story starts here'} description={tab==='saved'?'Tap + on any title to build your own movie-night shortlist.':'Start watching a title and come back here to pick up where you left off.'}/>}
    <aside className="library-backup" aria-label="Library backup"><div className="library-backup-icon"><Download size={23}/></div><div className="library-backup-copy"><h2>Take your collection with you.</h2><p>Your list and progress live in this browser. Export a backup to keep them, or import one on another device. Imports merge with your existing library.</p><small>Up to 100 saved titles and 48 recently watched titles.</small></div><div className="library-backup-actions"><button type="button" onClick={download}><Download size={15}/> Export backup</button><button type="button" onClick={()=>fileInput.current?.click()} disabled={importing}>{importing?<LoaderCircle size={15} className="search-spinner"/>:<Upload size={15}/>} {importing?'Importing…':'Import backup'}</button><input ref={fileInput} type="file" accept=".json,application/json" onChange={upload} className="sr-only" tabIndex={-1} aria-label="Choose a Cinera library backup"/></div></aside>
  </div>;
}
