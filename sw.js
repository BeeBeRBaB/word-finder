// TS's DOM and WebWorker libs both declare `self` and the DOM one wins, so this cast
// is the only way to type `skipWaiting()` while src/ still needs the DOM lib.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Bump when a change couples markup, styles and modules. Code is stale-while-revalidate
// and each entry refreshes independently, so a torn pair can ship; install's atomic
// addAll into a fresh cache is the only thing that swaps them as one set.
const CACHE='wordfinder-v10';
// Unversioned on purpose: versioning it would make the activate sweep throw away every
// downloaded category on every deploy.
const SUBJECT_CACHE='wordfinder-subjects';
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/catalog.js','./src/subjects.js','./src/storage.js','./src/appearance.js','./src/picker.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

/** A lazily-imported word pool. Matched by directory so the catalog can grow without
 * sw.js growing with it. @param {URL} u @returns {boolean} */
const isSubject=u=>u.pathname.includes('/src/subjects/');

// Code is stale-while-revalidate; icons and fonts are cache-first. Serving code
// cache-first pinned visitors to the last build until CACHE was bumped by hand.
/** @param {URL} u @returns {boolean} */
const isCode=u=>/\.(html|css|js|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');

// Pages sends max-age=600, so a plain fetch can re-store a stale build from the HTTP
// cache. Re-issued from the URL (new Request throws on navigations); cross-origin is
// left alone or it loses no-cors mode.
/** @param {Request} req @returns {Promise<Response>} */
function revalidate(req){
  if(new URL(req.url).origin===sw.location.origin)return fetch(req.url,{cache:'no-cache'});
  return fetch(req);
}

// {cache:'reload'} per asset, not a bare addAll: the same max-age=600 trap, which turns
// fatal the first time a deploy deletes a file a stale main.js still imports.
sw.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>sw.skipWaiting()))});
sw.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k!==SUBJECT_CACHE).map(k=>caches.delete(k)))).then(()=>sw.clients.claim()))});

sw.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  // Word pools: cache-first, own cache. They never change in place, so revalidating
  // would spend a request to learn nothing.
  if(url.origin===sw.location.origin&&isSubject(url)){
    // Path only. subjects.js retries as `?retry=N`, and keying on the full URL made
    // every retry an entry nothing could hit again.
    const key=url.origin+url.pathname;
    e.respondWith(caches.open(SUBJECT_CACHE).then(async cache=>{
      const hit=await cache.match(key);
      if(hit)return hit;
      const res=await fetch(e.request);
      if(res&&res.ok)cache.put(key,res.clone());
      return res;
    }));
    return;
  }
  const req=e.request;
  e.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(req,{ignoreSearch:true});
    // Icons and fonts only change when renamed, so never revalidate them.
    if(cached&&!isCode(new URL(req.url)))return cached;
    const fresh=revalidate(req).then(res=>{
      // Never cache a deploy-time 404/500. Opaque (cross-origin font) responses report
      // status 0 but are cacheable.
      if(res&&(res.ok||res.type==='opaque'))cache.put(req,res.clone());
      return res;
    });
    if(cached){e.waitUntil(fresh.catch(()=>{}));return cached}
    // Only reachable if cache storage was cleared under us. The cast is for tsc; per
    // spec, resolving undefined already network-errors the request.
    return /** @type {Promise<Response>} */ (fresh.catch(()=>req.mode==='navigate'?cache.match('./index.html'):Response.error()));
  }));
});
