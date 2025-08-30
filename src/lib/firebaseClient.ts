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

const VAPID_PUBLIC_KEY = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';

export const getFcmToken = async () => {
  if (!(await isSupported())) return null;
  const messaging = getMessaging(app);
  // 👉 on réutilise le SW déjà actif (service-worker.js)
  const registration = await navigator.serviceWorker.ready;
  return getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: registration });
};

export const onForegroundMessage = async (cb: (p: any) => void) => {
  let ok = false;
  try {
    ok = await isSupported();
  } catch (e) {
    console.log('[PEPS][FCM] isSupported() threw:', e);
  }
  console.log('[PEPS][FCM] isSupported =', ok);
  if (!ok) return () => {};

  const messaging = getMessaging(app);
  console.log('[PEPS][FCM] onMessage listener ATTACHED');
  const unsub = onMessage(messaging, (payload) => {
    console.log('[PEPS][FCM] onMessage PAYLOAD =', payload);
    cb(payload);
  });
  return unsub;
};
