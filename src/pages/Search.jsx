import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {ChevronLeft,ChevronRight,Film,SlidersHorizontal,Tv,Search as SearchIcon} from 'lucide-react';
import {api} from '../lib/api';
import {searchState,searchParams,catalogPage} from '../lib/discoveryState';
import {Card,Skeletons,ErrorPanel} from '../components/UI';
import SmartSearch from '../components/SmartSearch';
import '../discovery.css';

export default function Search(){
  const [params,setParams]=useSearchParams();
  const paramsRef=useRef(params);paramsRef.current=params;
  const state=searchState(params);
  const {q,page,type,sort}=state;
  const [data,setData]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
  const canonical=searchParams(state).toString();
  useEffect(()=>{if(params.toString()!==canonical)setParams(canonical,{replace:true});},[canonical,params,setParams]);
  useEffect(()=>{
    const controller=new AbortController();let current=true;setData(null);setError('');
    if(q)api(`/api/search?q=${encodeURIComponent(q)}&page=${page}`,controller.signal,{fresh:attempt>0}).then(result=>{
      if(!current)return;
      const lastPage=catalogPage(result.totalPages);
      if(page>lastPage){setParams(searchParams({...searchState(paramsRef.current),page:lastPage}),{replace:true});return;}
      setData(result);
    }).catch(reason=>{if(current&&reason.name!=='AbortError')setError(reason.message);});
    return()=>{current=false;controller.abort();};
  },[q,page,attempt]);
  const results=useMemo(()=>{
    const filtered=(data?.results||[]).filter(item=>type==='all'||item.kind===type);
    if(sort==='rating')return [...filtered].sort((a,b)=>(b.rating||0)-(a.rating||0));
    if(sort==='newest')return [...filtered].sort((a,b)=>(b.year||0)-(a.year||0));
    return filtered;
  },[data,type,sort]);
  const update=changes=>setParams(searchParams({...state,...changes}));
  return <div className="content-width catalog-page search-page">
    <div className="catalog-heading"><div className="eyebrow">FIND YOUR NEXT FAVORITE</div><h1>Search the universe<span>.</span></h1><p>A title you remember. A story you have yet to discover.</p></div>
    <SmartSearch initialValue={q} variant="page" autoFocus={!q}/>
    {q&&<><div className="search-refiners"><div className="search-type-tabs" role="group" aria-label="Filter this page by format"><button className={type==='all'?'active':''} aria-pressed={type==='all'} onClick={()=>update({type:'all'})}><SlidersHorizontal size={15}/> All</button><button className={type==='movie'?'active':''} aria-pressed={type==='movie'} onClick={()=>update({type:'movie'})}><Film size={15}/> Movies</button><button className={type==='tv'?'active':''} aria-pressed={type==='tv'} onClick={()=>update({type:'tv'})}><Tv size={15}/> TV series</button></div><label>Sort this page <select value={sort} onChange={event=>update({sort:event.target.value})}><option value="relevance">Best match</option><option value="rating">Highest rated</option><option value="newest">Newest first</option></select></label></div><p className="search-filter-note">Format and sort apply to the current page of search results.</p></>}
    {!q?<div className="search-empty-intro"><span>START ANYWHERE</span><h2>A title. A memory.<br/>A new obsession.</h2><p>Search above, or open the suggestions to revisit recent searches and popular picks.</p></div>:<><div className="result-heading"><h2>Results for <span className="search-term">“{q}”</span></h2><span aria-live="polite">{error?'Search unavailable':!data?'Finding titles…':`${results.length} matching title${results.length===1?'':'s'} on this page`}</span></div>
    {error?<ErrorPanel message={error} onRetry={()=>setAttempt(value=>value+1)}/>:!data?<Skeletons count={12}/>:!results.length?<div className="empty-state"><SearchIcon size={34}/><h3>{type!=='all'&&data.results?.length?'No titles in this format':'No matching titles'}</h3><p>{type!=='all'&&data.results?.length?'This page has results in another format. Show all titles or try the next page.':'Check the spelling or try a shorter title.'}</p>{type!=='all'?<button className="button button-primary" onClick={()=>update({type:'all'})}>Show all formats</button>:<button className="button button-primary" onClick={()=>document.querySelector('.smart-search-page input')?.focus()}>Edit search</button>}</div>:<div className="catalog-grid">{results.map(item=><Card key={`${item.kind}-${item.id}`} item={item}/>)}</div>}
    {data?.totalPages>1&&<nav className="pagination" aria-label="Search result pages"><button disabled={page<=1} onClick={()=>update({page:page-1})}><ChevronLeft size={17}/> Previous</button><span>Page {page} of {catalogPage(data.totalPages)}</span><button disabled={page>=catalogPage(data.totalPages)} onClick={()=>update({page:page+1})}>Next <ChevronRight size={17}/></button></nav>}
    </>}
  </div>;
}
