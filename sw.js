// TS's DOM and WebWorker libs both declare `self` and the DOM one wins, so this cast
// is the only way to type `skipWaiting()` while src/ still needs the DOM lib.
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// Bump when a change couples markup, styles and modules. Code is stale-while-revalidate
// and each entry refreshes independently, so a torn pair can ship; install's atomic
// addAll into a fresh cache is the only thing that swaps them as one set.
const CACHE='wordfinder-v19';
// Unversioned on purpose: versioning it would make the activate sweep throw away every
// downloaded category on every deploy.
const SUBJECT_CACHE='wordfinder-subjects';
const ASSETS=['./','./index.html','./styles.css','./src/main.js','./src/rng.js','./src/puzzle.js','./src/layout.js','./src/view.js','./src/effects.js','./src/catalog.js','./src/subjects.js','./src/storage.js','./src/progress.js','./src/appearance.js','./src/picker.js','./src/art.js','./src/settings.js','./src/subpage.js','./src/pane.js','./src/importer.js','./src/bgpicker.js','./src/lookpicker.js','./src/backgrounds.js','./src/scoring.js','./src/levels.js','./src/cloud.js','./src/scorecard.js','./src/levelplay.js','./src/account.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];

/** A lazily-imported word pool. Matched by directory so the catalog can grow without
 * sw.js growing with it. @param {URL} u @returns {boolean} */
const isSubject=u=>u.pathname.includes('/src/subjects/');

/** @param {URL} u @returns {boolean} */
const isFont=u=>u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com';

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

/** An older build's cache, which activate deletes. Only this app's: an origin like
 * user.github.io is shared by every Pages site the account hosts.
 * @param {string} k @returns {boolean} */
const isStale=k=>k.startsWith('wordfinder-')&&k!==CACHE&&k!==SUBJECT_CACHE;

// A bump starts an empty cache, and activate's sweep deletes the old one with everything pages
// loaded on demand: a background and what it imports, and the fonts. The first launch after an
// update, if offline, then came back without them. So the new cache takes them over at install,
// while the old one still serves: each fetched again (code for this build, along with any module
// it now imports that the old build did not; a font so a bad copy is not kept past a bump). Fonts
// go by this build's stylesheet: it comes along, with the files of it the old cache held, and
// fonts an older stylesheet named stay behind. Only where the old cache held fonts: a first
// install, or a device Google Fonts never answers, asks it nothing. One that fails is left for
// the next online visit.
/** @returns {Promise<void>} */
async function carryOver(){
  const cache=await caches.open(CACHE);
  // The precache alone, not whatever the cache holds: an install cut short leaves files it
  // carried there, and their imports still need following.
  const have=new Set(ASSETS.map(u=>new URL(u,sw.location.href).href));
  // A request that never settles would hold the update back for good.
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),20000);
  /** Never rejects: one that fails must not end the carry while others are still on the way.
   * @param {string} url same-origin by path, or a font's whole URL @returns {Promise<unknown>} */
  const take=async url=>{
    if(have.has(url))return;
    have.add(url);
    try{
      // By URL, so in cors mode, never the stored request's: cache.keys() hands every request back
      // as no-cors, and an opaque copy of a font file is one the page's cors request cannot use.
      const res=await fetch(url,{cache:'no-cache',signal:ctl.signal});
      if(!res.ok)return;
      await cache.put(url,res.clone());
      // Static relative imports only: a dynamic one loads what the page picks next, online.
      if(url.endsWith('.js'))await Promise.all([...(await res.text()).matchAll(/(?:from|import)\s*['"](\.\.?\/[^'"]+)['"]/g)].map(m=>take(new URL(m[1],url).href)));
    }catch{}
  };
  try{
    const old=(await Promise.all((await caches.keys()).filter(isStale).map(async k=>(await caches.open(k)).keys())))
      .flat().map(({url})=>new URL(url));
    const isFontFile=(/** @type {URL} */ u)=>u.hostname==='fonts.gstatic.com';
    // This build's stylesheets' text, waited on by font files alone: a sheet that stalls must not
    // hold the code back until the budget runs out and nothing more can be fetched.
    const css=old.some(isFontFile)&&(async()=>{
      const page=await (await cache.match(new URL('./index.html',sw.location.href).href))?.text()??'';
      const sheets=[...page.matchAll(/href="(https:\/\/fonts\.googleapis\.com\/css[^"]+)"/g)].map(m=>m[1].replaceAll('&amp;','&'));
      await Promise.all(sheets.map(take));
      return (await Promise.all(sheets.map(async u=>(await cache.match(u))?.text()))).join('');
    })();
    await Promise.allSettled(old.map(async u=>{
      if(u.origin===sw.location.origin)return isSubject(u)?null:take(u.origin+u.pathname);
      if(css&&isFontFile(u)&&(await css).includes(u.href))return take(u.href);
    }));
  }finally{clearTimeout(timer)}
}

// {cache:'reload'} per asset, not a bare addAll: the same max-age=600 trap, which turns
// fatal the first time a deploy deletes a file a stale main.js still imports.
sw.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>carryOver().catch(()=>{})).then(()=>sw.skipWaiting()))});
sw.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(isStale).map(k=>caches.delete(k)))).then(()=>sw.clients.claim()))});

sw.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  // Fonts are the only cross-origin files worth caching. Firestore documents have no
  // extension, so cache-first would serve every account a device's first copy forever.
  if(url.origin!==sw.location.origin&&!isFont(url))return;
  const req=e.request;
  // Same-origin entries are keyed by path. Matching with ignoreSearch but storing under the
  // full URL let the first ?subject= visit pin an index.html that no later refresh updated,
  // and made each of subjects.js's `?retry=N` loads an entry nothing could hit again.
  const key=url.origin===sw.location.origin?url.origin+url.pathname:req;
  // Word pools are code too (a subject is added by editing one), refreshed the same way, but
  // kept in their own cache so a deploy does not throw them away.
  const name=url.origin===sw.location.origin&&isSubject(url)?SUBJECT_CACHE:CACHE;
  e.respondWith(caches.open(name).then(async cache=>{
    const cached=await cache.match(key);
    // Icons and fonts only change when renamed, so never revalidate them.
    if(cached&&!isCode(url))return cached;
    const fresh=revalidate(req).then(res=>{
      // Never cache a deploy-time 404/500. Opaque (cross-origin font) responses report
      // status 0 but are cacheable.
      if(res&&(res.ok||res.type==='opaque'))cache.put(key,res.clone());
      return res;
    });
    if(cached){e.waitUntil(fresh.catch(()=>{}));return cached}
    // Only reachable if cache storage was cleared under us. The cast is for tsc; per
    // spec, resolving undefined already network-errors the request.
    return /** @type {Promise<Response>} */ (fresh.catch(()=>req.mode==='navigate'?cache.match('./index.html'):Response.error()));
  }));
});
