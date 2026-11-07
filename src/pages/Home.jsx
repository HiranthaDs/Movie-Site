import React,{useEffect,useState,useCallback,useMemo} from 'react';
import {Link} from 'react-router-dom';
import {Play,Pause,Info,ChevronLeft,ChevronRight,Flame,MonitorPlay,ShieldAlert,ArrowRight,Asterisk,Star,Smile,Orbit,Heart,HeartHandshake} from 'lucide-react';
import {api,img,truncated} from '../lib/api';
import {useStore} from '../lib/store';
import {Section,Skeletons,HeroSkeleton,ErrorPanel} from '../components/UI';
import SurpriseButton from '../components/SurpriseButton';

function Hero({featured}){
  const slides=useMemo(()=>featured.slice(0,6),[featured]);
  const [selected,setSelected]=useState(0);
  const [hovered,setHovered]=useState(false),[focusWithin,setFocusWithin]=useState(false),[paused,setPaused]=useState(false);
  const [visible,setVisible]=useState(()=>!document.hidden);
  useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>setSelected(0),[slides]);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReducedMotion(media.matches);
    if(media.addEventListener)media.addEventListener('change',update);
    else media.addListener?.(update);
    return()=>{
      if(media.removeEventListener)media.removeEventListener('change',update);
      else media.removeListener?.(update);
    };
  },[]);
  useEffect(()=>{const next=slides[(selected+1)%slides.length];if(!next)return;const image=new Image();image.src=img(next.backdrop||next.poster,'w1280');},[slides,selected]);
  useEffect(()=>{if(slides.length<=1||hovered||focusWithin||paused||reducedMotion||!visible)return;const timer=setInterval(()=>setSelected(value=>(value+1)%slides.length),8500);return()=>clearInterval(timer);},[slides,hovered,focusWithin,paused,reducedMotion,visible]);
  const movie=slides[selected];if(!movie)return null;
  return <section className="hero" aria-label="Featured titles" onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} onFocus={()=>setFocusWithin(true)} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setFocusWithin(false);}}>
    <div className="hero-inner content-width">
      <div className="hero-movie-content" aria-live={hovered||focusWithin?'polite':'off'}>
        <div className="hero-storyline"><span>STORIES FOR NIGHTS THAT</span><em>FEEL BIG.</em><Asterisk/></div>
        <div className="hero-selected-label"><span className="live-dot"/> FEATURED STORY <i/> {String(selected+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</div>
        <h1 key={movie.id}>{movie.title}</h1>
        <div className="hero-movie-meta"><span>{movie.year||'TBA'}</span><span>{movie.kind==='tv'?'TV series':'Movie'}</span><span><Star size={13} fill="currentColor"/> {movie.rating?Number(movie.rating).toFixed(1):'NR'}</span></div>
        <p className="hero-movie-overview">{truncated(movie.overview,215)}</p>
        <div className="hero-buttons"><Link data-tv-autofocus to={`/watch/${movie.kind}/${movie.id}`} className="button button-primary button-large"><Play size={17} fill="currentColor"/> Watch options</Link><Link to={`/title/${movie.kind}/${movie.id}`} className="button button-glass button-large"><Info size={18}/> Details</Link></div>
      </div>
      <div className="hero-card-stack" style={{backgroundImage:movie.backdrop||movie.poster?`url('${img(movie.backdrop||movie.poster,'w1280')}')`:undefined}}>
        <div className="hero-card-number">{String(selected+1).padStart(2,'0')}</div>
        <div className="hero-indicators">{slides.map((entry,index)=><button key={entry.id} className={selected===index?'selected':''} onClick={()=>setSelected(index)} aria-label={`Show ${entry.title}`} aria-pressed={selected===index}/>)}</div>
        {slides.length>1&&<div className="hero-arrows">{!reducedMotion&&<button onClick={()=>setPaused(value=>!value)} aria-label={paused?'Resume featured slideshow':'Pause featured slideshow'}>{paused?<Play size={16}/>:<Pause size={16}/>}</button>}<button onClick={()=>setSelected(value=>(value-1+slides.length)%slides.length)} aria-label="Previous featured title"><ChevronLeft size={21}/></button><button onClick={()=>setSelected(value=>(value+1)%slides.length)} aria-label="Next featured title"><ChevronRight size={21}/></button></div>}
      </div>
    </div>
  </section>;
}

export default function Home(){
  const [data,setData]=useState(null),[error,setError]=useState('');
  const [attempt,setAttempt]=useState(0);
  const {history,saved}=useStore();
  const load=useCallback(()=>setAttempt(value=>value+1),[]);
  useEffect(()=>{const controller=new AbortController();setError('');api('/api/home',controller.signal,{fresh:attempt>0}).then(setData).catch(errorValue=>{if(errorValue.name!=='AbortError')setError(errorValue.message);});return()=>controller.abort();},[attempt]);
  return <>
    {data?.featured?.length?<Hero featured={data.featured}/>:!data&&!error?<HeroSkeleton/>:null}
    {error&&!data&&<div className="content-width home-hero-error"><ErrorPanel message={error} onRetry={load}/></div>}
    <div className="content-width home-main">
      {data?.demo&&<div className="demo-banner"><ShieldAlert size={18}/><p><strong>A taste of Cinera.</strong> You’re exploring a sample collection of movies and series.</p></div>}
      {data?.warning&&<div className="inline-warning">{data.warning}</div>}
      {error&&data&&<ErrorPanel message={error} onRetry={load}/>}
      <section className="discovery-launchpad" aria-labelledby="mood-heading"><div className="launchpad-intro"><span className="eyebrow">LESS SCROLLING. MORE STORIES.</span><h2 id="mood-heading">What’s the mood?</h2><p>One small choice. A whole new world.</p></div><div className="mood-links">{[{label:'Feel good',sub:'A little lighter',genre:35,Icon:Smile},{label:'On the edge',sub:'Keep me guessing',genre:53,Icon:Flame},{label:'Another world',sub:'Escape the everyday',genre:878,Icon:Orbit},{label:'Together time',sub:'Something for everyone',genre:10751,Icon:HeartHandshake}].map(({label,sub,genre,Icon})=><Link key={genre} to={`/discover?genre=${genre}`}><Icon size={23}/><span><strong>{label}</strong><small>{sub}</small></span><ArrowRight size={17}/></Link>)}</div></section>
      {history.length>0&&<Section title="Continue watching" sub="Your place is saved. Jump straight back in." items={history.slice(0,15)} resume to="/watchlist?tab=history"/>}
      {saved.length>0&&<Section title="Saved for a good night" sub="Handpicked by you, ready when you are" items={saved.slice(0,12)} to="/watchlist" icon={<Heart className="section-heading-icon" size={23}/>}/>}
      {data&&<>
        <div className="top-caption"><Flame size={15} fill="currentColor"/> YOUR NEXT OBSESSION STARTS HERE <span/></div>
        {(data.rows||[]).map((row,index)=><Section key={row.id} title={row.label} sub={index===0?'The titles everybody is talking about':index===1?'Stories worth staying up for':undefined} items={row.items} kind={row.kind} to={row.kind==='tv'?'/series':'/movies'} icon={index===0?<Flame className="section-heading-icon" size={23}/>:index===1?<MonitorPlay className="section-heading-icon" size={23}/>:null}/>) }
      </>}
      {!data&&!error&&<div className="home-loading-list section-shell"><div className="section-heading"><div><div className="section-title-wrap"><Flame className="section-heading-icon" size={23}/><h2>Trending movies</h2></div><p>The titles everybody is talking about</p></div></div><Skeletons count={6} layout="row"/></div>}
      <div className="discover-callout"><div><span className="eyebrow">DON'T KNOW WHAT TO WATCH?</span><h2>There’s a story for every mood.</h2><p>Explore genres, discover hidden gems, and save your next favorites in one place.</p><div className="callout-actions"><Link to="/discover" className="button button-primary">Explore the catalog <ArrowRight size={17}/></Link><SurpriseButton/></div></div><div className="callout-orbits"><span/><span/><span><Play size={48} fill="currentColor"/></span></div></div>
    </div>
  </>;
}
