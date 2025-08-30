// public/firebase-messaging-sw.js
/* eslint-disable no-undef */

// --- Firebase compat (comme chez toi)
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

// utilitaire pour rendre les URLs absolues
const toAbs = (u) => { try { return new URL(u, self.location.origin).href; } catch { return u; } };

// --- GARDE 1 : éviter d’attacher plusieurs fois le handler
if (!self.__PEPS_BG_BOUND__) {
  self.__PEPS_BG_BOUND__ = true;

  // Handler background
  messaging.onBackgroundMessage(async (payload) => {
    try {
      // log de diag
      console.log('[PEPS][SW] onBackgroundMessage', payload);

      // Si FCM a un bloc notification intégré, on ne re-notifie pas (évite doublon)
      if (payload && payload.notification) {
        console.log('[PEPS][SW] skip: payload.notification présent');
        return;
      }

      // --- GARDE 2 : si une fenêtre est visible, on laisse le foreground gérer
      // (évite que la page + le SW notifient en même temps)
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const hasVisibleClient = clientsList.some((c) => {
        // visibilityState peut ne pas exister partout → fallback true si inconnu
        return (c.visibilityState ? c.visibilityState === 'visible' : true) && !!c.url;
      });
      if (hasVisibleClient) {
        console.log('[PEPS][SW] skip: client visible → foreground notifiera');
        return;
      }

      // données
      const n = payload.notification || {};
      const d = payload.data || {};

      const title = n.title || d.title || 'PEPS';
      const body  = n.body  || d.body  || '';
      const icon  = toAbs(n.icon || d.icon || '/icon-512x512.png');
      const url   = d.url   || '/';
      const tag   = d.tag   || 'peps-broadcast'; // tag constant = remplace au lieu d’empiler

      await self.registration.showNotification(title, {
        body,
        icon,
        badge: toAbs('/icon-192x192.png'),
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

// clic sur la notif → ouvrir l’app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
