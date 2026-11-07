import React,{useState,useEffect,useCallback,useMemo,useRef} from 'react';
import {useSearchParams} from 'react-router-dom';
import {SlidersHorizontal,ChevronLeft,ChevronRight,ChevronDown,Film,Tv,X,Sparkles} from 'lucide-react';
import {api} from '../lib/api';
import {browseState,browseParams,catalogPage} from '../lib/discoveryState';
import {Card,Skeletons,ErrorPanel} from '../components/UI';
import AdvancedFilters from '../components/AdvancedFilters';
import '../discovery.css';

const periodLabels={'2020s':'2020s','2010s':'2010s','2000s':'2000s','1990s':'1990s',classic:'Before 1990'};

export default function Browse({fixedKind}) {
  const [params,setParams]=useSearchParams();
  const state=browseState(params,fixedKind);
  const {kind,genre,year,period,rating,page,sort}=state;
  const [genres,setGenres]=useState([]);
  const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const filterTrigger=useRef(null);
  const canonical=browseParams(state,fixedKind).toString();
  useEffect(()=>{if(params.toString()!==canonical)setParams(canonical,{replace:true});},[canonical,params,setParams]);
  useEffect(()=>{
    const controller=new AbortController();let current=true;setGenres([]);
    api(`/api/genres/${kind}`,controller.signal).then(result=>{if(current)setGenres(result.genres||[]);}).catch(()=>{});
    return()=>{current=false;controller.abort();};
  },[kind,attempt]);
  useEffect(()=>{
    const controller=new AbortController();let current=true;
    setData(null);setError('');
    const query=new URLSearchParams({page:String(page),sort});
    for(const [key,value] of Object.entries({genre,year,period,rating}))if(value)query.set(key,value);
    api(`/api/browse/${kind}?${query}`,controller.signal,{fresh:attempt>0}).then(result=>{
      if(!current)return;
      const lastPage=catalogPage(result.totalPages);
      if(page>lastPage){setParams(browseParams({...state,page:lastPage},fixedKind),{replace:true});return;}
      setData(result);
    }).catch(reason=>{if(current&&reason.name!=='AbortError')setError(reason.message);});
    return()=>{current=false;controller.abort();};
  },[kind,page,genre,year,period,rating,sort,attempt]);
  const update=changes=>setParams(browseParams({...state,...changes},fixedKind));
  const changeType=next=>setParams(browseParams({kind:next},fixedKind));
  const closeFilters=useCallback(()=>setFiltersOpen(false),[]);
  const filterValues=useMemo(()=>({genre,year,period,rating,sort}),[genre,year,period,rating,sort]);
  const applyFilters=next=>{update({...next,page:1});setFiltersOpen(false);};
  const resetFilters=()=>{setParams(browseParams({kind},fixedKind));setFiltersOpen(false);};
  const removeFilter=key=>update(key==='release'?{year:'',period:'',page:1}:{[key]:'',page:1});
  const activeFilters=useMemo(()=>{
    const items=[];
    const genreName=genres.find(entry=>String(entry.id)===genre)?.name;
    if(genre)items.push({key:'genre',label:genreName||'Selected genre'});
    if(year||period)items.push({key:'release',label:year||periodLabels[period]});
    if(rating)items.push({key:'rating',label:`Rated ${rating}.0+`});
    if(sort!=='popularity.desc')items.push({key:'sort',label:sort==='vote_average.desc'?'Top rated':'Newest first'});
    return items;
  },[genre,year,period,rating,sort,genres]);
  const quickGenres=genres.filter(entry=>[kind==='tv'?10759:28,35,18,kind==='tv'?10765:878,9648,16].includes(entry.id));
  return <div className="content-width catalog-page">
    <div className="catalog-heading"><div className="eyebrow">THE ENTIRE UNIVERSE OF STORIES</div><h1>{fixedKind==='movie'?'Explore movies':fixedKind==='tv'?'TV series':'Discover something great'}<span>.</span></h1><p>Find your next favorite. Sort, filter and explore stories worth watching.</p></div>
    {!fixedKind&&<div className="browse-tabs" aria-label="Title format"><button className={kind==='movie'?'active':''} aria-pressed={kind==='movie'} onClick={()=>changeType('movie')}><Film size={17}/> Movies</button><button className={kind==='tv'?'active':''} aria-pressed={kind==='tv'} onClick={()=>changeType('tv')}><Tv size={17}/> TV Series</button></div>}
    {quickGenres.length>0&&<div className="quick-genres" role="group" aria-label="Quick genre filters"><span><Sparkles size={15}/> Set the mood</span><div><button type="button" className={!genre?'selected':''} aria-pressed={!genre} onClick={()=>update({genre:'',page:1})}>All genres</button>{quickGenres.map(entry=><button type="button" key={entry.id} className={genre===String(entry.id)?'selected':''} aria-pressed={genre===String(entry.id)} onClick={()=>update({genre:genre===String(entry.id)?'':String(entry.id),page:1})}>{entry.name}</button>)}</div></div>}
    <div className={`advanced-filter-bar ${activeFilters.length?'has-active-filters':''}`}><button ref={filterTrigger} type="button" className="filter-trigger" aria-expanded={filtersOpen} aria-controls="advanced-filter-sheet" onClick={()=>setFiltersOpen(true)}><span className="filter-trigger-icon"><SlidersHorizontal/></span><span><small>REFINE RESULTS</small><strong>{activeFilters.length?`${activeFilters.length} filter${activeFilters.length===1?'':'s'} active`:'Genre, release, rating and sort'}</strong></span>{activeFilters.length>0&&<b>{activeFilters.length}</b>}<ChevronDown className="filter-trigger-chevron"/></button>{activeFilters.length>0&&<div className="active-filter-list" aria-label="Active filters">{activeFilters.map(filter=><span key={filter.key}>{filter.label}<button type="button" onClick={()=>removeFilter(filter.key)} aria-label={`Remove ${filter.label} filter`}><X/></button></span>)}<button type="button" className="clear-active-filters" onClick={resetFilters}>Clear all</button></div>}</div>
    <AdvancedFilters open={filtersOpen} onClose={closeFilters} genres={genres} kind={kind} values={filterValues} onApply={applyFilters} onReset={resetFilters} triggerRef={filterTrigger}/>
    <div className="result-heading"><h2>{kind==='tv'?'TV shows':'Movies'} <span aria-live="polite">{data?.results?.length?`· ${data.results.length} titles on page ${page}`:''}</span></h2>{data?.demo&&<span className="demo-pill">Sample catalog</span>}</div>
    {error&&<ErrorPanel message={error} onRetry={()=>setAttempt(value=>value+1)}/>}
    {!data&&!error&&<Skeletons count={18}/>}
    {data&&(!data.results?.length?<div className="empty-state"><SlidersHorizontal size={34}/><h3>No titles match this view</h3><p>Try another genre or clear your filters to see more stories.</p><button className="button button-primary" onClick={resetFilters}>Reset filters</button></div>:<div className="catalog-grid">{data.results.map(item=><Card item={item} key={`${item.kind}-${item.id}`}/>)}</div>)}
    {data?.totalPages>1&&<nav className="pagination" aria-label="Catalog pages"><button disabled={page<=1} onClick={()=>update({page:page-1})}><ChevronLeft size={17}/> Previous</button><span>Page <b>{page}</b> of {catalogPage(data.totalPages)}</span><button disabled={page>=catalogPage(data.totalPages)} onClick={()=>update({page:page+1})}>Next <ChevronRight size={17}/></button></nav>}
  </div>;
}
