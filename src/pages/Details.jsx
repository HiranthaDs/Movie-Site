import React,{useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {Play,Plus,Check,ArrowLeft,ExternalLink,Clapperboard,Star} from 'lucide-react';
import {api,img,truncated} from '../lib/api';
import {useStore} from '../lib/store';
import {resumePath} from '../lib/library';
import {Card,Poster,MetaLine,ErrorPanel,Skeletons} from '../components/UI';
export default function Details(){
  const {kind,id}=useParams();
  const [data,setData]=useState(null),[error,setError]=useState('');
  const [season,setSeason]=useState(1),[seasonData,setSeasonData]=useState(null);
  const [titleAttempt,setTitleAttempt]=useState(0),[seasonAttempt,setSeasonAttempt]=useState(0),[seasonError,setSeasonError]=useState('');
  const {toggleSaved,isSaved,history,getProgress}=useStore();
  useEffect(()=>{
    const ctrl=new AbortController();setData(null);setError('');setSeason(1);setSeasonData(null);setSeasonError('');
    api(`/api/title/${kind}/${id}`,ctrl.signal,{fresh:titleAttempt>0}).then(next=>{
      if(ctrl.signal.aborted)return;
      if(!next||next.kind!==kind||Number(next.id)!==Number(id)||!next.title)throw new Error('This title could not be loaded. Please try again.');
      setData(next);
      setSeason(next.seasonList?.find(entry=>entry.season_number>0)?.season_number||1);
    }).catch(e=>{if(!ctrl.signal.aborted&&e.name!=='AbortError')setError(e.message);});
    return()=>ctrl.abort();
  },[kind,id,titleAttempt]);
  useEffect(()=>{
    if(kind!=='tv'||!data||Number(data.id)!==Number(id)||data.kind!==kind)return;
    const ctrl=new AbortController();setSeasonData(null);setSeasonError('');
    api(`/api/season/${id}/${season}`,ctrl.signal,{fresh:seasonAttempt>0}).then(next=>{
      if(!ctrl.signal.aborted)setSeasonData({...next,forSeason:season});
    }).catch(e=>{if(!ctrl.signal.aborted&&e.name!=='AbortError')setSeasonError(e.message);});
    return()=>ctrl.abort();
  },[kind,id,season,data,seasonAttempt]);
  useEffect(()=>{if(data&&data.kind===kind&&Number(data.id)===Number(id))document.title=`${data.title} | Cinera`;},[data,id,kind]);
  if(error)return <div className="content-width detail-error"><ErrorPanel message={error} onRetry={()=>setTitleAttempt(value=>value+1)}/></div>;
  if(!data)return <div className="content-width detail-loading"><div role="status" aria-busy="true"><span className="sr-only">Loading title details…</span><div className="detail-loading-layout" aria-hidden="true"><div className="skeleton skeleton-poster"><Clapperboard className="skeleton-poster-mark" size={32}/></div><div className="detail-loading-copy"><div className="skeleton hero-skeleton-eyebrow"/><div className="hero-skeleton-title"><span className="skeleton"/><span className="skeleton"/></div><div className="hero-skeleton-description"><span className="skeleton"/><span className="skeleton"/><span className="skeleton"/></div><div className="hero-buttons hero-skeleton-actions"><span className="skeleton"/><span className="skeleton"/></div></div></div></div><Skeletons count={6}/></div>;
  const saved=isSaved(data);
  const lastWatch=history.find(entry=>entry.kind===kind&&Number(entry.id)===Number(id));
  const resumeItem=lastWatch||data;
  const position=getProgress(resumeItem,resumeItem.season||1,resumeItem.episode||1);
  const canResume=position?.seconds>0&&(!position.duration||position.seconds<position.duration-10);
  const episodes=Array.isArray(seasonData?.episodes)?seasonData.episodes:[];
  const trailer=data.videos?.find(v=>v.type==='Trailer')||data.videos?.[0];
  const provider=data.providers&&typeof data.providers==='object'&&!Array.isArray(data.providers)?data.providers:null;
  return <>
    <div className="detail-hero">
      <div className="detail-backdrop" style={data.backdrop?{backgroundImage:`url('${img(data.backdrop,'original')}')`}:{}}/>
      <div className="content-width detail-hero-inner"><Link className="back-link" to="/"><ArrowLeft size={16}/> Back to home</Link>
        <div className="detail-title-row"><div className="detail-poster"><Poster item={data}/></div><div className="detail-info"><span className="detail-eyebrow">{data.kind==='movie'?'FEATURE FILM':'ORIGINAL SERIES'} <span className="badge-separator">/</span> {data.status||'Available in catalog'}</span><h1>{data.title}</h1>{data.tagline&&<p className="detail-tagline">{data.tagline}</p>}<MetaLine item={data} includeRuntime/>
        <p className="detail-overview">{data.overview}</p><div className="detail-actions"><Link to={canResume?resumePath(resumeItem):`/watch/${kind}/${id}`} className="button button-primary button-large"><Play size={18} fill="currentColor"/> {canResume?(kind==='tv'?`Resume S${resumeItem.season||1} · E${resumeItem.episode||1}`:'Resume watching'):'Watch options'}</Link><button className="button button-glass button-large" aria-pressed={saved} onClick={()=>toggleSaved(data)}>{saved?<Check size={18}/>:<Plus size={18}/>} {saved?'In My List':'Add to My List'}</button>{trailer&&<a className="button button-outline button-large" href={`https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`} target="_blank" rel="noreferrer"><Clapperboard size={18}/> Trailer</a>}</div></div></div>
      </div>
    </div>
    <div className="content-width detail-content"><div className="detail-primary">
      <div className="detail-description-block"><div className="section-title-wrap"><span className="section-title-marker"/><h2>Storyline</h2></div><p>{data.overview}</p></div>
      {kind==='tv'&&<section className="episodes-section"><div className="episode-heading"><div className="section-title-wrap"><span className="section-title-marker"/><h2>Episodes</h2></div><label>Season <select aria-label="Select season" value={season} onChange={e=>setSeason(Number(e.target.value))}>{(data.seasonList?.length?data.seasonList:[{season_number:1,name:'Season 1'}]).map(s=><option key={s.season_number} value={s.season_number}>{s.name}</option>)}</select></label></div>
        {seasonError?<ErrorPanel message={`Episodes could not load. ${seasonError}`} onRetry={()=>setSeasonAttempt(value=>value+1)}/>:!seasonData||seasonData.forSeason!==season?<div className="episodes-loading" role="status" aria-live="polite">Loading episodes…</div>:!episodes.length?<div className="episodes-loading" role="status">No episodes are listed for this season yet. Try another season.</div>:<div className="episode-list">{episodes.map(ep=><Link to={`/watch/tv/${id}?season=${season}&episode=${ep.episode_number}`} className="episode-row" key={ep.id}>
          <div className="episode-art">{ep.still_path?<img src={img(ep.still_path,'w300')} alt=""/>:<Clapperboard size={24}/>}<span className="episode-play"><Play size={16} fill="currentColor"/></span></div>
          <div className="episode-main"><div className="episode-name"><span>{String(ep.episode_number).padStart(2,'0')}</span><h3>{ep.name}</h3></div><p>{truncated(ep.overview||'Explore this episode.',145)}</p></div><span className="episode-runtime">{ep.runtime?`${ep.runtime}m`:''}</span></Link>)}</div>}
      </section>}
      {data.recommendations?.length>0&&<section className="detail-more"><div className="section-title-wrap"><span className="section-title-marker"/><h2>You might also like</h2></div><div className="detail-related-grid">{data.recommendations.slice(0,8).map(item=><Card key={`${item.kind}-${item.id}`} item={item}/>)}</div></section>}
    </div><aside className="detail-side"><div className="detail-side-card"><h3>About this title</h3><dl><div><dt>Type</dt><dd>{kind==='tv'?'TV Series':'Movie'}</dd></div><div><dt>Release year</dt><dd>{data.year||'TBA'}</dd></div><div><dt>Average rating</dt><dd><Star size={13} fill="currentColor"/> {data.rating?Number(data.rating).toFixed(1):'NR'} / 10</dd></div>{kind==='tv'&&<div><dt>Seasons</dt><dd>{data.seasonList?.length||data.seasons||'—'}</dd></div>}</dl></div>
      {data.credits?.cast?.length>0&&<div className="detail-side-card cast-card"><h3>Top cast</h3>{data.credits.cast.slice(0,7).map(c=><div key={c.id} className="cast-row"><div className="cast-avatar">{c.profile?<img src={img(c.profile,'w185')} alt=""/>:c.name[0]}</div><div><strong>{c.name}</strong><small>{c.character}</small></div></div>)}</div>}
      {provider?.link&&<div className="detail-side-card"><h3>Where to watch legally</h3><p className="provider-note">Streaming and rental offers are provided by TMDB for your region when available.</p><div className="provider-logos">{(provider.flatrate||[]).slice(0,6).map(p=><img key={p.provider_id} title={p.provider_name} src={img(p.logo_path,'w92')} alt={p.provider_name}/>)}</div><a href={provider.link} target="_blank" rel="noreferrer" className="provider-link">See watch options <ExternalLink size={14}/></a></div>}
    </aside></div>
  </>;
}
