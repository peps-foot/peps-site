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

/** Enregistre explicitement le SW de messaging si aucun SW n'est encore prêt. */
async function ensureMessagingSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  // s'il y a déjà un SW contrôleur, on le réutilise
  if (navigator.serviceWorker.controller) {
    try {
      const reg = await navigator.serviceWorker.ready;
      return reg ?? null;
    } catch { /* fallthrough */ }
  }

  // sinon on enregistre le nôtre (scope racine requis pour les push)
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    // attendre l'activation
    await navigator.serviceWorker.ready;
    return reg;
  } catch (e) {
    console.warn('[PEPS][FCM] SW register failed:', e);
    return null;
  }
}

/** Retourne true si FCM Web est supporté par ce navigateur (iOS Safari renverra false). */
export async function isFcmSupported(): Promise<boolean> {
  try { return await isSupported(); } catch { return false; }
}

/** Demande la permission (à appeler suite à un CLIC) */
export async function askNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  try {
    // Chrome récent: Notification.requestPermission() retourne une Promise<string>
    const res = await Notification.requestPermission();
    return res;
  } catch {
    // vieux navigateurs
    return new Promise((resolve) => {
      Notification.requestPermission((r: NotificationPermission) => resolve(r));
    });
  }
}

/** Récupère (ou crée) le token FCM. Nécessite permission = 'granted'. */
export async function getFcmToken(): Promise<string | null> {
  if (!(await isFcmSupported())) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;

  const registration = await ensureMessagingSW();
  if (!registration) return null;

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    return token || null;
  } catch (e) {
    console.warn('[PEPS][FCM] getToken error:', e);
    return null;
  }
}

/** Écoute les messages en foreground (ne pas faire showNotification ici). */
export async function onForegroundMessage(cb: (p: any) => void) {
  if (!(await isFcmSupported())) return () => {};
  const messaging = getMessaging(app);
  const unsub = onMessage(messaging, (payload) => {
    console.log('[PEPS][FCM] onMessage payload:', payload);
    cb(payload); // à toi de montrer un toast/UI si utile
  });
  return unsub;
}

/** Helpers réseau */
async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Abonne le token côté backend (platform: 'web' | 'twa' | 'android' | 'ios') */
export async function subscribeToken(platform: 'web' | 'twa' | 'android' | 'ios', user_id?: string | null) {
  const token = await getFcmToken();
  if (!token) return { ok: false, reason: 'no_token' };
  const res = await postJSON('/api/push/subscribe', { token, platform, user_id: user_id || null });
  return res;
}

/** Désinscription côté backend */
export async function unsubscribeToken(token: string) {
  return postJSON('/api/push/unsubscribe', { token });
}
