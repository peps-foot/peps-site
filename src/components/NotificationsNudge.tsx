// pop up pour demander à l'utilisateur d'aller valider les notifs
'use client';

import { useEffect, useState } from 'react';
import { isFcmSupported } from '../lib/firebaseClient';
import { useRouter } from 'next/navigation';

const PROMPT_KEY = 'peps_notif_prompt_last';
const DELAY_MS = 15 * 24 * 60 * 60 * 1000; // 15 jours

/** Détecte si on est sur un appareil Apple (iPhone, iPad) */
function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** iOS 16.4+ supporte les Web Push si la PWA est installée sur l'écran d'accueil */
function isIosPushCapable(): boolean {
  if (!isIosDevice()) return false;
  // On est dans une PWA installée si window.navigator.standalone === true
  return (navigator as any).standalone === true;
}

/** Vérifie si les notifs Web Push natives sont dispo (iOS 16.4+ installé OU Android/desktop) */
async function isPushAvailable(): Promise<{ available: boolean; platform: 'ios' | 'android' | 'other' | 'none' }> {
  const ios = isIosDevice();

  if (ios) {
    // Sur iOS, FCM ne marche pas — on utilise l'API Web Push native
    // Elle n'est dispo que si la PWA est installée (standalone) ET iOS >= 16.4
    const standalone = isIosPushCapable();
    if (!standalone) return { available: false, platform: 'none' }; // pas installée → on ne peut rien faire
    if (typeof Notification === 'undefined') return { available: false, platform: 'none' };
    return { available: true, platform: 'ios' };
  }

  // Android / desktop : on utilise FCM
  const fcmOk = await isFcmSupported();
  if (!fcmOk) return { available: false, platform: 'none' };
  if (typeof Notification === 'undefined') return { available: false, platform: 'none' };
  return { available: true, platform: 'android' };
}

export default function NotificationsNudge() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other' | 'none'>('none');
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;

      const { available, platform: plat } = await isPushAvailable();
      if (!available) { setChecking(false); return; }

      // Si déjà "granted" ou "denied", on ne demande plus
      if (Notification.permission !== 'default') { setChecking(false); return; }

      // Vérifier la date du dernier rappel
      const lastStr = localStorage.getItem(PROMPT_KEY);
      if (lastStr) {
        const last = Number(lastStr);
        if (!Number.isNaN(last) && Date.now() - last < DELAY_MS) {
          setChecking(false);
          return;
        }
      }

      setPlatform(plat);
      setOpen(true);
      setChecking(false);
    })();
  }, []);

  const closeAndRemember = () => {
    localStorage.setItem(PROMPT_KEY, String(Date.now()));
    setOpen(false);
  };

  const goToNotifications = () => {
    localStorage.setItem(PROMPT_KEY, String(Date.now()));
    setOpen(false);
    router.push('/notifications');
  };

  if (checking || !open) return null;

  const label = platform === 'ios'
    ? 'Activer mes notifications (iPhone)'
    : 'Activer mes notifications';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="relative mx-4 max-w-sm rounded-2xl bg-white p-5 shadow-lg flex flex-col items-center">
        <button
          onClick={closeAndRemember}
          className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          aria-label="Fermer la fenêtre"
        >
          ✕
        </button>
        <button
          onClick={goToNotifications}
          className="mb-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {label}
        </button>

        <img
          src="/images/popup_notifs.png"
          alt="Explication des notifications PEPS"
          className="max-w-full h-auto"
        />
      </div>
    </div>
  );
}
