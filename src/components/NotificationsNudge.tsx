// pop up pour demander à l'utilisateur d'aller valider les notifs
'use client';

import { useEffect, useState } from 'react';
import { isFcmSupported } from '../lib/firebaseClient';
import { useRouter } from 'next/navigation';

const PROMPT_KEY = 'peps_notif_prompt_last';
const DELAY_MS = 15 * 24 * 60 * 60 * 1000; // 15 jours

export default function NotificationsNudge() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;

      // 1) FCM supporté ? (Android / desktop oui, iOS ça renverra false)
      const supported = await isFcmSupported();
      if (!supported) { setChecking(false); return; }

      // 2) API Notifications dispo ?
      if (typeof Notification === 'undefined') { setChecking(false); return; }

      // 3) Si déjà "granted" ou "denied", on ne demande plus
      if (Notification.permission !== 'default') { setChecking(false); return; }

      // 4) Vérifier la date du dernier rappel
      const lastStr = localStorage.getItem(PROMPT_KEY);
      if (lastStr) {
        const last = Number(lastStr);
        if (!Number.isNaN(last)) {
          const now = Date.now();
          if (now - last < DELAY_MS) {
            setChecking(false);
            return; // trop tôt pour relancer
          }
        }
      }

      // ✅ On peut afficher le nudge
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="mx-4 max-w-sm rounded-2xl bg-white p-5 shadow-lg flex flex-col items-center">
        <button
        onClick={goToNotifications}
        className="mb-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
        >
        Je veux activer mes notifs Android
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
