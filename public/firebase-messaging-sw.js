// public/firebase-messaging-sw.js
// v5 — Fix double notif iOS + multi-token Android
/* eslint-disable no-undef */

// ─────────────────────────────────────────────────────────────────────────────
// Détection iOS AVANT l'import Firebase.
// On ne peut pas se fier à "typeof firebase === 'undefined'" car importScripts
// réussit silencieusement sur iOS Safari — firebase est défini dans les deux cas.
// On utilise l'user-agent du SW, qui contient "iPhone" ou "iPad" sur iOS.
// ─────────────────────────────────────────────────────────────────────────────
const isIosSW = /iphone|ipad|ipod/i.test(self.navigator?.userAgent || '');

// Firebase compat (pour Android / desktop via FCM)
// Sur iOS, ces imports réussissent mais FCM n'est pas fonctionnel —
// on n'appelle pas onBackgroundMessage sur iOS pour éviter les doublons.
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyA761QGox6NvVzh3PFVjYRK94GWYubznYs',
  authDomain: 'peps-foot.firebaseapp.com',
  projectId: 'peps-foot',
  messagingSenderId: '272445879894',
  appId: '1:272445879894:web:afcd10e91154f27d112df7'
});

// URLs absolues
const toAbs = (u) => { try { return new URL(u, self.location.origin).href; } catch { return u; } };

// ─────────────────────────────────────────────────────────────────────────────
// PARTIE 1 : FCM (Android / desktop UNIQUEMENT)
// On ne bind PAS onBackgroundMessage sur iOS pour éviter les doublons :
// iOS reçoit ses notifs via le listener "push" natif (Partie 2).
// ─────────────────────────────────────────────────────────────────────────────
if (!isIosSW && !self.__PEPS_BG_BOUND__) {
  self.__PEPS_BG_BOUND__ = true;

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(async (payload) => {
    try {
      console.log('[PEPS][SW] onBackgroundMessage', payload);

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
// Le payload envoyé par le serveur NE CONTIENT PAS de bloc "notification"
// (uniquement "data") pour éviter qu'Apple affiche la notif nativement EN PLUS
// de celle affichée ici par showNotification → c'est ça qui causait le doublon.
// ─────────────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  // Sur Android/desktop, FCM gère via onBackgroundMessage → on ne fait rien ici
  if (!isIosSW) return;

  let parsed = {};
  try {
    parsed = event.data ? event.data.json() : {};
  } catch {
    try {
      const text = event.data ? event.data.text() : '';
      parsed = { data: { title: 'PEPS', body: text } };
    } catch {
      parsed = {};
    }
  }

  // Le serveur envoie uniquement { data: { title, body, icon, url, tag } }
  // (pas de bloc "notification" pour éviter le doublon natif Apple)
  const d = parsed.data || parsed;

  const title = d.title || 'PEPS';
  const body  = d.body  || '';
  const icon  = toAbs(d.icon || '/images/notifications/peps-notif-icon-192.png');
  const badge = toAbs('/images/notifications/peps-badge-72.png');
  const url   = d.url ? toAbs(d.url) : self.location.origin + '/';
  const tag   = d.tag || 'peps-broadcast';

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