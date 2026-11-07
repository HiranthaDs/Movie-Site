// This file is copied directly to the build and is not transformed by Vite.
// Keep it compatible with the same older TV browsers as the legacy app bundle.
var VERSION='cinera-v6-reliable-library';
var SHELL_CACHE=VERSION+'-shell';
var DATA_CACHE=VERSION+'-data';
var APP_SHELL=[
  '/',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/fonts/anton.ttf',
  '/fonts/inter-regular.ttf',
  '/fonts/inter-semibold.ttf',
];

self.addEventListener('install',function(event){
  event.waitUntil(caches.open(SHELL_CACHE).then(function(cache){
    return cache.addAll(APP_SHELL);
  }).then(function(){
    return self.skipWaiting();
  }));
});

self.addEventListener('activate',function(event){
  event.waitUntil(Promise.all([
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(key){
        return key.startsWith('cinera-')&&!key.startsWith(VERSION);
      }).map(function(key){
        return caches.delete(key);
      }));
    }),
    self.clients.claim(),
  ]));
});

function trimCache(cacheName,maxEntries){
  return caches.open(cacheName).then(function(cache){
    return cache.keys().then(function(keys){
      return Promise.all(keys.slice(0,Math.max(0,keys.length-maxEntries)).map(function(key){
        return cache.delete(key);
      }));
    });
  });
}

function offlineResponse(){
  return new Response(JSON.stringify({error:'You are offline and this content is not cached yet.'}),{
    status:503,
    headers:{'Content-Type':'application/json; charset=utf-8'},
  });
}

function cachedFallback(cache,request,fallback){
  return cache.match(request).then(function(cached){
    if(cached)return cached;
    if(!fallback)return offlineResponse();
    return caches.match(fallback).then(function(shell){
      return shell||offlineResponse();
    });
  });
}

function networkFirst(request,cacheName,fallback){
  // Every navigation serves the same SPA shell. Keep one copy instead of
  // retaining search terms, pairing tokens, and a separate entry per title.
  var cacheKey=request.mode==='navigate'?'/':request;
  return fetch(request).then(function(response){
    if(!response.ok)return response;
    return caches.open(cacheName).then(function(cache){
      return cache.put(cacheKey,response.clone()).then(function(){
        if(cacheName===DATA_CACHE)return trimCache(cacheName,60);
      });
    }).catch(function(){
      // A full or unavailable cache must never discard a working response.
    }).then(function(){
      return response;
    });
  },function(){
    return caches.open(cacheName).then(function(cache){
      return cachedFallback(cache,request,fallback);
    }).catch(function(){
      return offlineResponse();
    });
  });
}

function staleWhileRevalidate(request,event){
  var storage=caches.open(SHELL_CACHE).catch(function(){return null;});
  var cached=storage.then(function(cache){
    return cache?cache.match(request).catch(function(){return null;}):null;
  });
  // Start the network independently of storage, and keep background writes alive
  // after a cached response has already been delivered to the page.
  var network=fetch(request).then(function(response){
    return storage.then(function(cache){
      if(!cache||!response.ok)return response;
      return cache.put(request,response.clone()).catch(function(){}).then(function(){return response;});
    });
  }).catch(function(){return cached.then(function(response){return response||offlineResponse();});});
  event.waitUntil(network.then(function(){}));
  return cached.then(function(response){return response||network;});
}

self.addEventListener('fetch',function(event){
  var request=event.request;
  if(request.method!=='GET')return;
  var url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Pairing responses are private and source URLs can expire. Neither belongs
  // in the offline catalog cache, even when the network is unavailable.
  if(/^\/api\/(remote|sources)(\/|$)/.test(url.pathname)){
    event.respondWith(fetch(request,{cache:'no-store'}).catch(function(){
      return offlineResponse();
    }));
    return;
  }
  if(url.pathname.startsWith('/api/')){
    event.respondWith(networkFirst(request,DATA_CACHE));
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith(networkFirst(request,SHELL_CACHE,'/'));
    return;
  }
  if(['script','style','font','image','manifest'].indexOf(request.destination)!==-1)event.respondWith(staleWhileRevalidate(request,event));
});

self.addEventListener('message',function(event){
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
