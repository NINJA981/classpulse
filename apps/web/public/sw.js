/*
 * ClassPulse service worker — kept deliberately small:
 *  - page navigations: network first; when the network fails, the /offline page;
 *  - static assets (/_next/static, /icons, fonts): cache first (they are content-hashed or versioned);
 *  - /api/* and /socket.io/* are never cached or intercepted (live data and sessions).
 */
const VERSION = 'v1';
const STATIC_CACHE = `cp-static-${VERSION}`;
const PAGE_CACHE = `cp-pages-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) =>
  url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || /\.(?:woff2?|png|svg|ico)$/.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(PAGE_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok && res.type === 'basic') cache.put(request, res.clone());
        return res;
      }),
    );
  }
});

/*
 * Web Push: "your background job is done" (see packages/shared/src/notifications.ts, PushPayload).
 * Icons are same-origin; links are same-origin paths only (exactly one leading '/').
 */
const ICON = '/icons/icon-192.png';

/** A same-origin path, or null. Rejects '//host', schemes, backslashes and control characters. */
function safePath(link) {
  if (typeof link !== 'string' || link.length > 2048) return null;
  if (!link.startsWith('/') || link.startsWith('//')) return null;
  for (let i = 0; i < link.length; i += 1) {
    const c = link.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return null; // control characters, backslash
  }
  const url = new URL(link, self.location.origin);
  return url.origin === self.location.origin ? url.pathname + url.search + url.hash : null;
}

self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  const title = data && typeof data.title === 'string' && data.title ? data.title : 'ClassPulse';
  const options = {
    body: data && typeof data.body === 'string' ? data.body : undefined,
    icon: ICON,
    badge: ICON,
    tag: data && typeof data.id === 'string' ? data.id : undefined,
    data: { link: safePath(data && data.link) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(safePath(event.notification.data && event.notification.data.link) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const same = windows.filter((w) => new URL(w.url).origin === self.location.origin);
      const client = same.find((w) => w.focused) || same[0];
      if (client) {
        await client.focus().catch(() => undefined);
        if (client.url === target) return;
        // navigate() only works for windows this worker controls; otherwise open a new one.
        const moved = 'navigate' in client ? await client.navigate(target).then(() => true, () => false) : false;
        if (moved) return;
      }
      await self.clients.openWindow(target);
    }),
  );
});
