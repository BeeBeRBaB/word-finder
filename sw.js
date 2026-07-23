// `self` in a service worker is a ServiceWorkerGlobalScope, but tsconfig's `lib`
// must also include `DOM` for the rest of the project (src/ touches `window`,
// `HTMLElement`, ...), and TypeScript's DOM and WebWorker libs both declare a
// global `self` with incompatible types — the DOM one wins. There is no JSDoc-only
// way to make `self.skipWaiting()` etc. type-check without this one cast; routing
// through `unknown` (never `any`) is the standard, narrowly-scoped idiom for it.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const CACHE='wordfinder-v6';
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/themes.js','./src/storage.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

// Code changes on every deploy; icons and fonts only change when they are renamed.
// Serving code cache-first pinned every visitor to the last cached build until CACHE
// was bumped by hand — a rule you have to remember forever, with no error when you
// forget. So code is now stale-while-revalidate: the cached copy still answers
// instantly, and the network copy quietly replaces it for the next load. The version
// string stays useful for forcing a hard reset, but is no longer load-bearing.
/** @param {URL} u @returns {boolean} */
const isCode=u=>/\.(html|css|js|webmanifest)$/.test(u.pathname)||u.pathname.endsWith('/');

// Pages serves code with `max-age=600`, so a plain fetch() can be answered by the
// browser's own HTTP cache and re-store the same stale build for ten more minutes.
// `no-cache` forces an origin revalidation; unchanged files come back 304, near-free.
// Re-issue from the URL rather than `new Request(req,{...})`, which throws outright
// on a navigation request — and leave cross-origin requests (fonts) alone, since
// re-issuing those would drop their no-cors mode and fail.
/** @param {Request} req @returns {Promise<Response>} */
function revalidate(req){
  if(new URL(req.url).origin===sw.location.origin)return fetch(req.url,{cache:'no-cache'});
  return fetch(req);
}

sw.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>sw.skipWaiting()))});
sw.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>sw.clients.claim()))});

sw.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const req=e.request;
  e.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(req,{ignoreSearch:true});
    // Icons and fonts stay strictly cache-first — never spend a request
    // revalidating something that only changes when it gets renamed.
    if(cached&&!isCode(new URL(req.url)))return cached;
    const fresh=revalidate(req).then(res=>{
      // Never let a deploy-time 404 or a 500 poison the cache: a background
      // revalidation that stored one would serve it on every later load.
      // Opaque responses (cross-origin fonts) report status 0 but are still cacheable.
      if(res&&(res.ok||res.type==='opaque'))cache.put(req,res.clone());
      return res;
    });
    if(cached){e.waitUntil(fresh.catch(()=>{}));return cached}
    // Cache-miss fallback: `./index.html` is precached in ASSETS at install, so this
    // branch only ever misses if cache storage was cleared out from under us — and
    // per the Fetch spec, respondWith() resolving to `undefined` already network-
    // errors the request, the same outcome as the explicit Response.error() branch.
    // The assertion below encodes that invariant for the type checker; it changes
    // nothing at runtime.
    return /** @type {Promise<Response>} */ (fresh.catch(()=>req.mode==='navigate'?cache.match('./index.html'):Response.error()));
  }));
});
