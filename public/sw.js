self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) {}
  const titulo = d.titulo || 'Gestão MC';
  event.waitUntil(self.registration.showNotification(titulo, {
    body: d.corpo || '',
    icon: d.icone || '/icon-192.png',
    badge: '/icon-192.png',
    image: d.imagem || undefined,
    tag: d.tag || 'gestao-mc',
    renotify: true,
    requireInteraction: false,
    data: { url: d.url || '/atendimento', e: d.e || null },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const alvo = (event.notification.data && event.notification.data.url) || '/atendimento';
  const entrega = event.notification.data && event.notification.data.e;
  event.waitUntil((async () => {
    if (entrega) {
      try {
        await fetch('https://ezdtulcrqzmgocamjwwl.supabase.co/functions/v1/app-push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ acao: 'clique', e: entrega }),
        });
      } catch (_) {}
    }
    const abertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abertas) {
      if (c.url.includes(location.origin)) { await c.focus(); return c.navigate(alvo); }
    }
    return self.clients.openWindow(alvo);
  })());
});
