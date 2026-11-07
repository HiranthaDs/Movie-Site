import test from 'node:test';
import assert from 'node:assert/strict';
import {browseState,browseParams,catalogPage,searchState,searchParams} from '../src/lib/discoveryState.js';

test('catalog pages reject malformed values and enforce API limits',()=>{
  for(const value of [null,'','NaN','Infinity','-1','0','2.5','3oops','1e2','9007199254740993'])assert.equal(catalogPage(value),1);
  assert.equal(catalogPage('3'),3);
  assert.equal(catalogPage('700'),500);
});

test('discovery TV selection survives filter apply, reset, and URL round trips',()=>{
  const original=browseState(new URLSearchParams('type=tv&genre=18&page=3&sort=primary_release_date.desc'));
  assert.equal(original.kind,'tv');
  assert.equal(original.sort,'first_air_date.desc');
  const filtered=browseState(browseParams({...original,rating:'8',page:1}));
  assert.equal(filtered.kind,'tv');assert.equal(filtered.genre,'18');assert.equal(filtered.rating,'8');assert.equal(filtered.page,1);
  const reset=browseState(browseParams({kind:filtered.kind}));
  assert.equal(reset.kind,'tv');assert.equal(reset.genre,'');assert.equal(reset.sort,'popularity.desc');
  assert.deepEqual(browseState(browseParams(original)),original);
});

test('fixed catalog routes override query type and invalid filters are normalized',()=>{
  const state=browseState(new URLSearchParams('type=tv&year=2024&period=classic&genre=../18&rating=9&sort=oops&page=no'),'movie');
  assert.deepEqual(state,{kind:'movie',year:'2024',period:'',genre:'',rating:'',sort:'popularity.desc',page:1});
  assert.equal(browseParams(state,'movie').get('type'),null);
  assert.equal(browseState(new URLSearchParams('type=invalid&year=1800&period=bad')).kind,'movie');
});

test('search links preserve format and sort while sanitizing invalid query state',()=>{
  const state=searchState(new URLSearchParams('q=%20Dune%20&type=tv&sort=rating&page=2'));
  assert.deepEqual(searchState(searchParams(state)),state);
  assert.equal(state.q,'Dune');
  const changed=searchState(searchParams({...state,page:3}));
  assert.equal(changed.type,'tv');assert.equal(changed.sort,'rating');assert.equal(changed.page,3);
  const invalid=searchState(new URLSearchParams(`q=${'a'.repeat(130)}&type=person&sort=broken&page=-2`));
  assert.equal(invalid.q.length,120);assert.equal(invalid.type,'all');assert.equal(invalid.sort,'relevance');assert.equal(invalid.page,1);
});
