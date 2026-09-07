import {
  getFcmToken,
  isFcmSupported,
  subscribeToken,
} from './firebaseClient';

import {
  isIosInstalled,
  getIosPushSubscription,
  subscribeIosToken,
} from './iosPush';

export type PushPlatform = 'ios' | 'twa' | 'web';

function detectPlatform(): PushPlatform {
  if (typeof window === 'undefined') {
    return 'web';
  }

  if (isIosInstalled()) {
    return 'ios';
  }

  if (
    typeof document !== 'undefined' &&
    document.referrer?.startsWith('android-app://')
  ) {
    return 'twa';
  }

  return 'web';
}

/**
 * Enregistre le token / abonnement du périphérique actuel.
 *
 * Cette fonction ne demande JAMAIS l'autorisation de notification.
 * Elle fonctionne uniquement si l'autorisation est déjà accordée.
 */
export async function ensurePushToken(userId: string): Promise<boolean> {
  try {
    if (!userId) return false;

    const platform = detectPlatform();

    // ─────────────────────────────
    // iOS PWA
    // ─────────────────────────────
    if (platform === 'ios') {
      if (typeof Notification === 'undefined') {
        return false;
      }

      if (Notification.permission !== 'granted') {
        return false;
      }

      const subscription = await getIosPushSubscription();

      if (!subscription) {
        return false;
      }

      await subscribeIosToken(userId);

      return true;
    }

    // ─────────────────────────────
    // Android / Web / TWA
    // ─────────────────────────────
    if (typeof Notification === 'undefined') {
      return false;
    }

    if (Notification.permission !== 'granted') {
      return false;
    }

    if (!(await isFcmSupported())) {
      return false;
    }

    const token = await getFcmToken();

    if (!token) {
      return false;
    }

    await subscribeToken(platform, userId);

    return true;

  } catch (error) {
    console.error('[PEPS][Push] Impossible d’enregistrer le token :', error);
    return false;
  }
}

/**
 * Demande l'autorisation native du navigateur.
 *
 * Cette fonction est appelée uniquement après une action volontaire
 * de l'utilisateur (clic sur "Oui").
 */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') {
    return 'default';
  }

  if (!('Notification' in window)) {
    return 'default';
  }

  return await Notification.requestPermission();
}