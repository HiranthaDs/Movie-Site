import React,{useEffect,useState,useCallback,useRef,useMemo} from 'react';
import {Link,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,MonitorPlay,AlertTriangle,Check,Play,ChevronRight,RefreshCcw,Maximize2,Minimize2,Wifi,WifiOff,ShieldCheck,ExternalLink,Clapperboard} from 'lucide-react';
import {api,img} from '../lib/api';
import {nextAvailableSourceIndex} from '../lib/playback';
import {useStore} from '../lib/store';
import VideoFrame from '../components/VideoFrame';
import PlaybackLoading from '../components/PlaybackLoading';
import {ErrorPanel,Rating} from '../components/UI';
import WatchTools from '../components/WatchTools';

const readPreference=()=>{try{return localStorage.getItem('cinera_source_preference')||'';}catch{return '';}};
const readFlag=(key,fallback=true)=>{try{const value=localStorage.getItem(key);return value===null?fallback:value==='true';}catch{return fallback;}};
const episodeNumber=value=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):1;

export default function Watch(){
  const {kind,id}=useParams();
  const [params]=useSearchParams();
  // A new title or episode owns its requests, callbacks, and playback state.
  // This prevents the previous episode from reporting progress into the next one.
  return <WatchSession key={`${kind}:${id}:${episodeNumber(params.get('season'))}:${episodeNumber(params.get('episode'))}`}/>;
}

function WatchSession(){
  const {kind,id}=useParams();
  const [params,setParams]=useSearchParams();
  const season=episodeNumber(params.get('season')),episode=episodeNumber(params.get('episode'));
  const [item,setItem]=useState(null),[sources,setSources]=useState([]),[sourceIndex,setSourceIndex]=useState(0),[episodes,setEpisodes]=useState([]),[error,setError]=useState('');
  const [sourceLoading,setSourceLoading]=useState(true),[sourceError,setSourceError]=useState('');
  const [titleAttempt,setTitleAttempt]=useState(0),[episodeAttempt,setEpisodeAttempt]=useState(0),[episodeError,setEpisodeError]=useState(''),[episodesLoading,setEpisodesLoading]=useState(false);
  const [playerState,setPlayerState]=useState('loading'),[cinemaMode,setCinemaMode]=useState(false),[online,setOnline]=useState(()=>navigator.onLine);
  const [sourceAttempt,setSourceAttempt]=useState(0),[playerKey,setPlayerKey]=useState(0);
  const [failedSources,setFailedSources]=useState(()=>new Set()),[autoSwitch,setAutoSwitch]=useState(true),[failoverNote,setFailoverNote]=useState('');
  const [dataSaver,setDataSaver]=useState(()=>readFlag('cinera_data_saver',false)),[autoNext,setAutoNext]=useState(()=>readFlag('cinera_auto_next',true));
  const {markWatched,saveProgress,getProgress,clearProgress}=useStore();
  const lastSaved=useRef(0);
  const source=sources[sourceIndex]||null;
  // Capture progress only when mounting a player, so progress reports cannot
  // change an iframe URL and reload an actively playing stream.
  const resume=useMemo(()=>item?getProgress(item,season,episode)?.seconds||0:0,[item,season,episode,source?.id,playerKey,getProgress]);
  const confirmedTv=typeof document!=='undefined'&&document.documentElement.classList.contains('tv-device');

  useEffect(()=>{const ctrl=new AbortController();setItem(null);setError('');api(`/api/title/${kind}/${id}`,ctrl.signal,{fresh:titleAttempt>0}).then(setItem).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>ctrl.abort();},[kind,id,titleAttempt]);
  useEffect(()=>{if(item)document.title=`Watch ${item.title} · Cinera`;},[item,params]);
  useEffect(()=>{
    const ctrl=new AbortController();
    setSources([]);setSourceIndex(0);setSourceLoading(true);setSourceError('');setPlayerState('loading');setFailedSources(new Set());setFailoverNote('');
    api(`/api/sources/${kind}/${id}?season=${season}&episode=${episode}`,ctrl.signal,{fresh:sourceAttempt>0}).then(data=>{
      if(ctrl.signal.aborted)return;
      const next=data.sources||[];
      const preferred=params.get('server')||readPreference();
      const preferredIndex=Math.max(0,next.findIndex(source=>source.id===preferred));
      setSources(next);setSourceIndex(preferredIndex);setPlayerKey(value=>value+1);setSourceLoading(false);
    }).catch(e=>{if(!ctrl.signal.aborted&&e.name!=='AbortError'){setSourceError(e.message||'Could not load playback sources.');setSourceLoading(false);setPlayerState('error');}});
    return()=>ctrl.abort();
  },[kind,id,season,episode,sourceAttempt]);
  useEffect(()=>{if(kind!=='tv')return;const ctrl=new AbortController();setEpisodes([]);setEpisodeError('');setEpisodesLoading(true);api(`/api/season/${id}/${season}`,ctrl.signal,{fresh:episodeAttempt>0}).then(data=>{setEpisodes(data.episodes||[]);setEpisodesLoading(false);}).catch(error=>{if(error.name!=='AbortError'){setEpisodeError(error.message);setEpisodesLoading(false);}});return()=>ctrl.abort();},[kind,id,season,episodeAttempt]);
  useEffect(()=>{
    const update=()=>setOnline(navigator.onLine);
    window.addEventListener('online',update);window.addEventListener('offline',update);
    return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};
  },[]);
  useEffect(()=>{
    if(playerState==='playing'&&item)markWatched(item,season,episode);
  },[playerState,item?.id,item?.kind,season,episode]);
  useEffect(()=>{
    const selected=sources[sourceIndex];if(!selected)return;
    try{localStorage.setItem('cinera_source_preference',selected.id);}catch{}
  },[sources,sourceIndex]);
  useEffect(()=>{
    if(playerState!=='error'||!source)return;
    setFailedSources(current=>{const next=new Set(current);next.add(source.id);return next;});
  },[playerState,source?.id]);
  useEffect(()=>{
    if(playerState!=='error'||!autoSwitch||sources.length<2)return;
    const nextIndex=nextAvailableSourceIndex(sources,sourceIndex,failedSources);
    if(nextIndex<0){setFailoverNote('Every available source needs attention. Retry one or rescan the list.');return;}
    const nextSource=sources[nextIndex];
    setFailoverNote(`${source?.label||'This source'} did not respond. Switching to ${nextSource.label}…`);
    const timer=setTimeout(()=>{
      setSourceIndex(nextIndex);setPlayerKey(value=>value+1);setPlayerState('loading');setFailoverNote('');
      setParams(current=>{const updated=new URLSearchParams(current);updated.set('server',nextSource.id);return updated;},{replace:true});
    },1800);
    return()=>clearTimeout(timer);
  },[playerState,autoSwitch,sourceIndex,sources,failedSources,source?.label,setParams]);
  useEffect(()=>{try{localStorage.setItem('cinera_data_saver',String(dataSaver));}catch{}},[dataSaver]);
  useEffect(()=>{try{localStorage.setItem('cinera_auto_next',String(autoNext));}catch{}},[autoNext]);

  const reportProgress=useCallback((seconds,duration,flush=false)=>{
    if(!item||!Number.isFinite(seconds)||seconds<0)return;
    const now=Date.now();if(!flush&&now-lastSaved.current<4000&&seconds!==duration)return;
    lastSaved.current=now;saveProgress(item,seconds,duration,season,episode);
  },[item,season,episode,saveProgress]);
  const provider=item?.providers&&typeof item.providers==='object'&&!Array.isArray(item.providers)?item.providers:null;
  const trailer=item?.videos?.find(video=>video.type==='Trailer')||item?.videos?.[0];
  const selectSource=index=>{
    const selected=sources[index];if(!selected)return;
    setFailedSources(current=>{const next=new Set(current);next.delete(selected.id);return next;});
    setFailoverNote('');setSourceIndex(index);setPlayerKey(value=>value+1);setPlayerState('loading');
    setParams(current=>{const updated=new URLSearchParams(current);updated.set('server',selected.id);return updated;},{replace:true});
  };
  const rescanSources=()=>{setFailedSources(new Set());setFailoverNote('');setSourceAttempt(value=>value+1);};
  const handlePlayerState=useCallback((nextState)=>{
    setPlayerState(nextState);
    if(['connected','ready','playing'].includes(nextState)&&source){
      setFailedSources(current=>{if(!current.has(source.id))return current;const next=new Set(current);next.delete(source.id);return next;});
      setFailoverNote('');
    }
  },[source?.id]);
  const updateEpisode=(nextSeason,nextEp)=>{setParams(current=>{const updated=new URLSearchParams(current);updated.set('season',String(nextSeason));updated.set('episode',String(nextEp));return updated;});};
  const idx=episodes.findIndex(ep=>ep.episode_number===episode);
  const next=idx>=0?episodes[idx+1]:undefined;
  useEffect(()=>{
    if(playerState!=='ended'||!autoNext||kind!=='tv'||!next)return;
    const timer=setTimeout(()=>updateEpisode(season,next.episode_number),2500);
    return()=>clearTimeout(timer);
  },[playerState,autoNext,kind,season,next?.episode_number]);
  useEffect(()=>{
    if(!item)return;
    window.dispatchEvent(new CustomEvent('cinera:remote-state',{detail:{title:item.title,subtitle:kind==='tv'?`Season ${season} · Episode ${episode}`:`${item.year||''} · Movie`,playerState}}));
  },[item?.id,item?.title,item?.year,kind,season,episode,playerState]);
  const restart=()=>{if(item)clearProgress(item,season,episode);setPlayerKey(value=>value+1);};
  useEffect(()=>{
    const command=event=>{if(event.detail?.action==='restart')restart();};
    window.addEventListener('cinera:remote-command',command);return()=>window.removeEventListener('cinera:remote-command',command);
  },[item?.id,season,episode]);
  const stateLabel=sourceLoading?'FINDING SOURCE':!source?'NO DIRECT SOURCE':{loading:'CONNECTING',starting:'STARTING',blocked:'READY TO WATCH',buffering:'BUFFERING',connected:'PLAYER OPEN',ready:'READY',playing:'PLAYING',paused:'PAUSED',ended:'COMPLETE',error:'SOURCE ERROR',idle:'WAITING'}[playerState]||'READY';
  if(error)return <div className="content-width watch-page"><ErrorPanel message={error} onRetry={()=>setTitleAttempt(value=>value+1)}/></div>;
  if(!item)return <div className="content-width watch-page"><PlaybackLoading discovery title="Preparing your title…" detail="Loading title details and your saved playback position."/></div>;

  return <div className={`watch-page ${cinemaMode?'cinema-mode':''}`}><div className="content-width watch-stage">
    <div className="watch-breadcrumb"><Link to={item?`/title/${kind}/${id}`:'/'}><ArrowLeft size={18}/> Back to details</Link><span>{item?.title||'Loading title…'}</span></div>
    <div className="watch-header"><div><span className="eyebrow"><span className="live-dot"/> NOW PLAYING / {stateLabel}</span><h1>{item?.title||'Loading…'}</h1>{kind==='tv'&&<p>Season {season} · Episode {episode}{episodes[idx]?.name?` — ${episodes[idx].name}`:''}</p>}</div>{item&&<div className="watch-header-meta"><Rating value={item.rating}/><span>{item.year||'—'}</span><span>{kind==='movie'?'MOVIE':'TV SERIES'}</span></div>}</div>
    <div className="watch-utility"><span className={online?'is-online':'is-offline'}>{online?<Wifi size={14}/>:<WifiOff size={14}/>} {online?'Connection online':'You are offline'}</span><span><ShieldCheck size={14}/> {sourceLoading?'Checking players':source?.external?source.label:'Secure in-app player'}</span><button onClick={()=>setCinemaMode(value=>!value)}>{cinemaMode?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {cinemaMode?'Exit cinema mode':'Cinema mode'}</button></div>
    <div className="theater-shell"><div className="video-container">{sourceLoading?<PlaybackLoading discovery phase={0} title="Finding an available playback source…" detail="Checking direct streams and the configured fallback players for this title."/>:sourceError?<div className="video-unavailable" role="alert"><AlertTriangle size={34}/><h2>Sources did not load</h2><p>{sourceError}</p><button className="button button-primary" onClick={rescanSources}><RefreshCcw size={16}/> Try again</button></div>:source?<VideoFrame key={`${source.id}-${playerKey}`} source={source} resume={resume} onProgress={reportProgress} poster={item?.backdrop?img(item.backdrop,'w1280'):undefined} onStateChange={handlePlayerState} dataSaver={dataSaver}/>:<div className="video-unavailable safe-source-empty"><ShieldCheck size={38}/><span className="player-state-label">NO SOURCE</span><h2>No playback source is available</h2><p>Enable a configured fallback or add a licensed MP4/HLS source for in-app playback.</p><div className="safe-source-actions">{provider?.link&&<a className="button button-primary" href={provider.link} target="_blank" rel="noreferrer">Legal watch options <ExternalLink size={15}/></a>}{trailer&&<a className="button button-glass" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer"><Clapperboard size={15}/> Watch trailer</a>}{!provider?.link&&!trailer&&<Link className="button button-glass" to={`/title/${kind}/${id}`}>Back to title details</Link>}</div></div>}</div></div>
    {sources.length>1&&<div className="player-controls server-control-panel"><div className="player-source-intro"><MonitorPlay size={19}/><div><strong>Playback servers</strong><span>{sources.length} sources ready · switch at any time</span></div><div className="player-source-actions"><button className={`server-auto ${autoSwitch?'is-active':''}`} aria-pressed={autoSwitch} onClick={()=>{setAutoSwitch(value=>!value);setFailoverNote('');}} title="Automatically try the next server after an error"><Check size={14}/> Auto {autoSwitch?'on':'off'}</button><button className="server-refresh" onClick={rescanSources} title="Rescan sources"><RefreshCcw size={15}/> Rescan</button></div></div><div className="source-pills">{sources.map((entry,index)=>{const failed=failedSources.has(entry.id),active=sourceIndex===index;return <button className={`source-pill ${active?'active':''} ${failed?'has-failed':''}`} aria-pressed={active} aria-label={`${entry.label}. ${failed?'Unavailable':active?stateLabel:'Ready'}`} key={entry.id} onClick={()=>selectSource(index)}><span className="server-number">{String(index+1).padStart(2,'0')}</span><span><strong>{entry.label}</strong><small>{entry.external?(confirmedTv?'TV player':'Embedded player'):entry.type==='hls'?'Adaptive HLS':'Direct video'} · {entry.quality||'Auto'}</small><em>{failed?'Needs retry':active?stateLabel:'Ready'}</em></span>{active?<Check size={16}/>:<Play size={14}/>}</button>; })}</div>{failoverNote&&<p className="server-status-note" role="status" aria-live="polite">{failoverNote}</p>}</div>}
    <WatchTools item={item} sourceType={source?.type} dataSaver={dataSaver} onDataSaver={setDataSaver} autoNext={autoNext} onAutoNext={setAutoNext} canAutoNext={kind==='tv'} onRestart={restart}/>
    <div className="watch-bottom-layout"><div>
      {kind==='tv'&&item&&<section className="watch-episodes"><div className="episode-heading"><div className="section-title-wrap"><span className="section-title-marker"/><h2>Episode guide</h2></div><select value={season} aria-label="Season" onChange={event=>updateEpisode(Number(event.target.value),1)}>{(item.seasonList?.length?item.seasonList:[{season_number:1,name:'Season 1'}]).map(entry=><option key={entry.season_number} value={entry.season_number}>{entry.name}</option>)}</select></div>{episodesLoading&&<p className="episodes-loading" role="status">Loading episodes…</p>}{episodeError&&<ErrorPanel message={episodeError} onRetry={()=>setEpisodeAttempt(value=>value+1)}/>}{!episodesLoading&&!episodeError&&!episodes.length&&<p className="episodes-loading">No episodes are listed for this season yet.</p>}<div className="mini-episode-grid">{episodes.map(entry=><button className={episode===entry.episode_number?'active':''} onClick={()=>updateEpisode(season,entry.episode_number)} key={entry.id}><small>EPISODE {String(entry.episode_number).padStart(2,'0')}</small><strong>{entry.name}</strong>{episode===entry.episode_number&&<span>Now playing</span>}</button>)}</div>{next&&<button className="next-episode" onClick={()=>updateEpisode(season,next.episode_number)}>Next episode: {next.name} <ChevronRight size={17}/></button>}</section>}
      {item&&<section className="watch-about"><div className="section-title-wrap"><span className="section-title-marker"/><h2>About this title</h2></div><p>{item.overview}</p></section>}
    </div>{item&&<aside className="watch-sidebar"><div className="watch-upnext"><span className="eyebrow">{source?'READY TO WATCH':'WATCH OPTIONS'}</span><div className="upnext-title"><div className="upnext-art">{item.poster&&<img src={img(item.poster,'w185')} alt=""/>}</div><div><h3>{item.title}</h3><p>{item.year} · {kind==='tv'?'TV Series':'Movie'}</p><Rating value={item.rating}/></div></div><p>{source?.type==='iframe'?(confirmedTv?`${source.label} opens as a full-page TV player for better device compatibility.`:`${source.label} plays inside Cinera. Its embedded controls manage the stream and any advertising shown in the player.`):source?'Progress is stored locally while the direct player is active.':'No playback source is currently available.'}</p><Link to={`/title/${kind}/${id}`}>View title details <ChevronRight size={16}/></Link></div></aside>}</div>
  </div></div>;
}
