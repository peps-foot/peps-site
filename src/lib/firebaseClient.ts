// lib/firebaseClient.ts
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, isSupported, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyA761QGox6NvVzh3PFVjYRK94GWYubznYs',          
  authDomain: 'peps-foot.firebaseapp.com',
  projectId: 'peps-foot',
  messagingSenderId: '272445879894',
  appId: '1:272445879894:web:afcd10e91154f27d112df7'          
};

// évite la double init en HMR
export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const getFcmToken = async () => {
  if (!(await isSupported())) return null;
  const messaging = getMessaging(app);

  // enregistre/obtient le SW dédié à FCM
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  // VAPID publique (la tienne, tu peux la laisser en dur)
  const vapidKey = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';

  return getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
};

export const onForegroundMessage = async (cb: (p: any) => void) => {
  if (!(await isSupported())) return;
  const messaging = getMessaging(app);
  onMessage(messaging, cb);
};
