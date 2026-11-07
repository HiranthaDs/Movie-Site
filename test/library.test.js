import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTitle,normalizeLibrary,normalizeProgress,mergeLibrary,createLibraryBackup,parseLibraryBackup,resumePath,filterLibrary,LIBRARY_LIMITS} from '../src/lib/library.js';

const movie={id:10,kind:'movie',title:'A Film',year:'2025',rating:8};
const series={id:20,kind:'tv',title:'A Series',season:3,episode:7,lastWatched:100};
const position={seconds:45,duration:100,updatedAt:100};

test('corrupted local library values recover without rendering invalid cards',()=>{
  assert.deepEqual(normalizeLibrary({saved:{title:'bad'},history:'broken',progress:[]}),{saved:[],history:[],progress:{}});
  const library=normalizeLibrary({saved:[null,movie,{...movie,id:'10'},{id:true,kind:'movie',title:'invalid'},{...series,kind:'person'},series]});
  assert.deepEqual(library.saved.map(item=>item.id),[10,20]);
  assert.equal(normalizeTitle({id:'../../path',kind:'movie',title:'unsafe'}),null);
});

test('backups export catalog fields only and reject incompatible or invalid input',()=>{
  const backup=createLibraryBackup({saved:[{...movie,url:'https://secret.example',token:'private',poster:'/poster.jpg'}],history:[series],progress:{'tv:20:3:7':position}});
  assert.equal(backup.saved[0].token,undefined);
  assert.equal(backup.saved[0].url,undefined);
  assert.equal(backup.saved[0].poster,'/poster.jpg');
  assert.deepEqual(parseLibraryBackup(JSON.stringify(backup)).history,[series]);
  assert.throws(()=>parseLibraryBackup('{'),/valid JSON/);
  assert.throws(()=>parseLibraryBackup(JSON.stringify({...backup,version:99})),/supported/);
  assert.throws(()=>parseLibraryBackup(JSON.stringify({...backup,saved:[{...movie,id:-2}]})),/invalid/);
  assert.throws(()=>parseLibraryBackup(JSON.stringify({...backup,progress:{'__proto__':position,'tv:20:3:7':{...position,seconds:-1}}})),/invalid/);
});

test('importing a backup merges collections and keeps the newer episode position',()=>{
  const current={saved:[movie],history:[{...series,lastWatched:200}],progress:{'tv:20:3:7':{...position,updatedAt:200}}};
  const incoming={saved:[movie,series],history:[series],progress:{'tv:20:3:7':{...position,seconds:12,updatedAt:50},'movie:10:1:1':position}};
  const merged=mergeLibrary(current,incoming);
  assert.deepEqual(merged.saved.map(item=>item.id),[10,20]);
  assert.equal(merged.history.length,1);
  assert.equal(merged.history[0].lastWatched,200);
  assert.equal(merged.progress['tv:20:3:7'].seconds,45);
  assert.equal(merged.progress['movie:10:1:1'].seconds,45);
  assert.equal(mergeLibrary(merged,{progress:{'tv:20:3:7':{...position,seconds:70,updatedAt:300}}}).progress['tv:20:3:7'].seconds,70);
});

test('progress normalization bounds history and rejects malformed values',()=>{
  const raw={'movie:10:1:1':{...position,seconds:150},'tv:20:0:1':position,'bad':position,'tv:20:1:1':{...position,seconds:Infinity}};
  assert.deepEqual(normalizeProgress(raw),{'movie:10:1:1':{...position,seconds:100}});
  const many=Array.from({length:LIBRARY_LIMITS.saved+5},(_,index)=>({...movie,id:index+1}));
  assert.equal(normalizeLibrary({saved:many}).saved.length,LIBRARY_LIMITS.saved);
});

test('resume links retain the exact series episode and use safe defaults',()=>{
  assert.equal(resumePath(series),'/watch/tv/20?season=3&episode=7');
  assert.equal(resumePath({...series,season:-1,episode:'x'}),'/watch/tv/20?season=1&episode=1');
  assert.equal(resumePath(movie),'/watch/movie/10');
});

test('library searches combine type and title filters without mutating saved order',()=>{
  const items=[movie,{...series,rating:9,year:'2020'}];
  assert.deepEqual(filterLibrary(items,{query:' SERIES ',kind:'tv'}).map(item=>item.id),[20]);
  assert.deepEqual(filterLibrary(items,{sort:'rating'}).map(item=>item.id),[20,10]);
  assert.deepEqual(items.map(item=>item.id),[10,20]);
  assert.equal(filterLibrary(items,{query:'missing'}).length,0);
});
