const periods=['2020s','2010s','2000s','1990s','classic'];
const browseSorts=['popularity.desc','vote_average.desc','primary_release_date.desc','first_air_date.desc'];

export function catalogPage(value){
  if(!/^\d+$/.test(String(value??'')))return 1;
  const page=Number(value);
  return Number.isSafeInteger(page)&&page>0?Math.min(page,500):1;
}

export function browseState(params,fixedKind){
  const kind=fixedKind==='tv'||(!fixedKind&&params.get('type')==='tv')?'tv':'movie';
  let sort=browseSorts.includes(params.get('sort'))?params.get('sort'):'popularity.desc';
  if(sort==='primary_release_date.desc'&&kind==='tv')sort='first_air_date.desc';
  if(sort==='first_air_date.desc'&&kind==='movie')sort='primary_release_date.desc';
  const year=/^(19|20)\d{2}$/.test(params.get('year')||'')?params.get('year'):'';
  return {
    kind,sort,page:catalogPage(params.get('page')),
    genre:/^\d{1,6}$/.test(params.get('genre')||'')?params.get('genre'):'',
    year,period:!year&&periods.includes(params.get('period'))?params.get('period'):'',
    rating:/^[678]$/.test(params.get('rating')||'')?params.get('rating'):'',
  };
}

export function browseParams(state,fixedKind){
  const params=new URLSearchParams();
  if(!fixedKind&&state.kind==='tv')params.set('type','tv');
  for(const key of ['genre','year','period','rating'])if(state[key])params.set(key,String(state[key]));
  if(state.sort&&state.sort!=='popularity.desc')params.set('sort',state.sort);
  if(catalogPage(state.page)>1)params.set('page',String(catalogPage(state.page)));
  return params;
}

export function searchState(params){
  return {
    q:(params.get('q')||'').trim().slice(0,120),page:catalogPage(params.get('page')),
    type:['movie','tv'].includes(params.get('type'))?params.get('type'):'all',
    sort:['rating','newest'].includes(params.get('sort'))?params.get('sort'):'relevance',
  };
}

export function searchParams(state){
  const params=new URLSearchParams();
  if(state.q)params.set('q',state.q);
  if(state.type&&state.type!=='all')params.set('type',state.type);
  if(state.sort&&state.sort!=='relevance')params.set('sort',state.sort);
  if(catalogPage(state.page)>1)params.set('page',String(catalogPage(state.page)));
  return params;
}
