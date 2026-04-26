// public/firebase-messaging-sw.js
/* eslint-disable no-undef */

// Firebase compat (pour Android / desktop via FCM)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA761QGox6NvVzh3PFVjYRK94GWYubznYs',
  authDomain: 'peps-foot.firebaseapp.com',
  projectId: 'peps-foot',
  messagingSenderId: '272445879894',
  appId: '1:272445879894:web:afcd10e91154f27d112df7'
});

const messaging = firebase.messaging();

// URLs absolues
const toAbs = (u) => { try { return new URL(u, self.location.origin).href; } catch { return u; } };

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 1 : FCM (Android / desktop)
// Inchangé — on ne touche à rien
// ─────────────────────────────────────────────────────────────────────────────
if (!self.__PEPS_BG_BOUND__) {
  self.__PEPS_BG_BOUND__ = true;

  messaging.onBackgroundMessage(async (payload) => {
    try {
      console.log('[PEPS][SW] onBackgroundMessage', payload);

      // Si FCM a un bloc notification intégré, on ne re-notifie pas (évite doublon)
      if (payload && payload.notification) {
        console.log('[PEPS][SW] skip: payload.notification présent');
        return;
      }

      // Si une fenêtre est visible, on laisse le foreground gérer
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasVisibleClient = clientsList.some((c) =>
        (c.visibilityState ? c.visibilityState === 'visible' : true) && !!c.url
      );
      if (hasVisibleClient) {
        console.log('[PEPS][SW] skip: client visible → foreground notifiera');
        return;
      }

      const n = payload.notification || {};
      const d = payload.data || {};

      const title = n.title || d.title || 'PEPS';
      const body  = n.body  || d.body  || '';
      const icon  = toAbs(n.icon || d.icon || '/images/notifications/peps-notif-icon-192.png');
      const badge = toAbs('/images/notifications/peps-badge-72.png');
      const url   = d.url ? toAbs(d.url) : self.location.origin + '/';
      const tag   = d.tag || 'peps-broadcast';

      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data: { url },
        tag,
        renotify: true,
        requireInteraction: true
      });
      console.log('[PEPS][SW] showNotification OK');
    } catch (e) {
      console.error('[PEPS][SW] onBackgroundMessage ERROR:', e);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 2 : Web Push natif (iOS Safari 16.4+)
// Les notifications iOS arrivent via l'événement 'push' standard du navigateur,
// pas via FCM. On les intercepte ici.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  // Si FCM a déjà géré ce message (Android/desktop), il aura défini
  // self.__PEPS_FCM_HANDLED__ juste avant — on évite le doublon.
  // Sur iOS, FCM n'existe pas donc ce flag ne sera jamais posé.
  if (self.__PEPS_FCM_HANDLED__) {
    self.__PEPS_FCM_HANDLED__ = false;
    return;
  }

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      data = { title: 'PEPS', body: text };
    } catch {
      data = {};
    }
  }

  const title = data.title || 'PEPS';
  const body  = data.body  || '';
  const icon  = toAbs(data.icon || '/images/notifications/peps-notif-icon-192.png');
  const badge = toAbs('/images/notifications/peps-badge-72.png');
  const url   = data.url ? toAbs(data.url) : self.location.origin + '/';
  const tag   = data.tag || 'peps-broadcast';

  console.log('[PEPS][SW] push natif reçu (iOS)', { title, body });

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      tag,
      renotify: true,
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 3 : Clic sur la notification (commun iOS + Android)
// Inchangé
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.location.origin + '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url && url && client.url.startsWith(new URL(url).origin)) {
        try { await client.focus(); } catch {}
        return;
      }
    }
    try { await self.clients.openWindow(url); } catch {}
  })());
});