// src/lib/iosPush.ts
// Gestion des notifications Web Push natives pour iOS 16.4+
// (Safari ne supporte pas FCM, on utilise l'API Web Push standard du navigateur)

/**
 * Retourne true si on est sur un iPhone/iPad avec la PWA installée
 * et une version d'iOS suffisante (16.4+).
 */
export function isIosInstalled(): boolean {
  if (typeof navigator === 'undefined') return false;
  const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isIos) return false;
  // navigator.standalone = true uniquement quand la PWA est lancée depuis l'écran d'accueil
  return (navigator as any).standalone === true;
}

/**
 * Vérifie que le navigateur supporte bien Push + ServiceWorker (nécessaire iOS 16.4+).
 */
export function isWebPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Récupère ou crée la PushSubscription iOS via l'API standard du navigateur.
 * La clé VAPID publique est la même que celle utilisée pour FCM.
 * Retourne null si impossible (permission refusée, non supporté, etc.)
 */
export async function getIosPushSubscription(): Promise<PushSubscription | null> {
  if (!isIosInstalled()) return null;
  if (!isWebPushSupported()) return null;
  if (Notification.permission !== 'granted') return null;

  try {
    const reg = await navigator.serviceWorker.ready;
    // Essaie de récupérer une subscription existante
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      // Crée une nouvelle subscription avec notre clé VAPID
      const VAPID_PUBLIC_KEY = 'BIIjmxt6CvJjd8EiHDtyBWgIvoDKO7eUjNJ_7FuN7vonLqolOVeWeilCoE2jIpeyN6Y02PZJ87B5MPRuywucWZE';
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    return sub;
  } catch (e) {
    console.warn('[PEPS][iOS] getIosPushSubscription error:', e);
    return null;
  }
}

/**
 * Convertit une clé VAPID base64url en ArrayBuffer (requis par pushManager.subscribe).
 * On retourne un ArrayBuffer plutôt qu'un Uint8Array pour éviter les erreurs de typage
 * liées à ArrayBufferLike vs ArrayBuffer dans les versions récentes de TypeScript.
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return buffer;
}

/**
 * Enregistre la subscription iOS côté serveur (dans push_tokens avec platform='ios').
 * Le JSON de la subscription est stocké dans la colonne token.
 */
export async function subscribeIosToken(userId?: string | null): Promise<{ ok: boolean; reason?: string }> {
  const sub = await getIosPushSubscription();
  if (!sub) return { ok: false, reason: 'no_subscription' };

  // On sérialise la subscription complète en JSON — c'est ce qu'on stocke dans "token"
  const tokenJson = JSON.stringify(sub.toJSON());

  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: tokenJson, platform: 'ios', user_id: userId ?? null }),
    });
    const data = await res.json();
    return { ok: data.ok === true };
  } catch (e) {
    console.warn('[PEPS][iOS] subscribeIosToken error:', e);
    return { ok: false, reason: 'fetch_error' };
  }
}
