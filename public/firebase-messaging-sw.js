/* Compat = plus simple pour FCM SW */
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

// Reçoit les messages quand l'app est en arrière-plan
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const title = n.title || 'PEPS';
  const body = n.body || '';
  const icon = n.icon || '/icons/android-chrome-192x192.png';
  const url = (payload.data && payload.data.url) || '/';

  self.registration.showNotification(title, { body, icon, data: { url } });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(clients.openWindow(url));
});
