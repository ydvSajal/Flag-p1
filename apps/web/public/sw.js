// Live votes, assignments and creator data always come from the server.
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.mode !== 'navigate' || new URL(request.url).pathname.startsWith('/api/')) return;
  event.respondWith(fetch(request).catch(() => new Response(
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PickLab · Offline</title><style>body{background:#faf9f5;color:#222720;font:1.1rem/1.6 system-ui;max-width:32rem;margin:15vh auto;padding:1.5rem}h1{font:3rem Georgia}a{color:#354e3c}</style><main><b>PickLab</b><h1>You’re offline</h1><p>Reconnect to load your studio or continue voting.</p><a href="">Try again</a></main></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )));
});
