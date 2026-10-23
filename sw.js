const VERSAO = 'time-control-v3';
const ARQUIVOS = ['./', 'index.html', 'logo.png', 'icon-192.png', 'icon-512.png', 'manifest.json'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (nomes) {
      return Promise.all(nomes.filter(function (n) { return n !== VERSAO && n !== 'time-control-estado'; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // páginas: tenta a rede primeiro (pega versão nova) e usa o guardado se estiver sem internet
    e.respondWith(
      fetch(req).then(function (r) {
        var copia = r.clone();
        caches.open(VERSAO).then(function (c) { c.put('./', copia); });
        return r;
      }).catch(function () { return caches.match('./'); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        var copia = r.clone();
        caches.open(VERSAO).then(function (c) { c.put(req, copia); });
        return r;
      });
    })
  );
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) { if ('focus' in lista[i]) return lista[i].focus(); }
      return self.clients.openWindow('./');
    })
  );
});

function hoje() {
  var n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
}
function verificarLembrete() {
  return caches.open('time-control-estado').then(function (c) {
    return c.match('estado-lembrete').then(function (r) { return r ? r.json() : null; }).then(function (s) {
      if (!s || !s.ativo || !s.ultimo || s.avisado === hoje()) return;
      var p = s.ultimo.split('-'), n = new Date();
      var dias = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(+p[0], +p[1] - 1, +p[2])) / 86400000);
      if (dias < 7) return;
      return self.registration.showNotification('Time Control', {
        body: 'Faz ' + dias + ' dias desde o seu último registro. Hora de registrar a média da semana.',
        icon: 'icon-192.png', badge: 'icon-192.png', tag: 'time-control-lembrete'
      }).then(function () {
        s.avisado = hoje();
        return c.put('estado-lembrete', new Response(JSON.stringify(s), { headers: { 'Content-Type': 'application/json' } }));
      });
    });
  });
}
self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'time-control-lembrete') e.waitUntil(verificarLembrete());
});
