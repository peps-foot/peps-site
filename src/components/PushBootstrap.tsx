'use client';

import { useEffect } from 'react';
import { onForegroundMessage } from '../lib/firebaseClient';

export default function PushBootstrap() {

  // Réception des notifications lorsque PEPS est déjà ouvert
  useEffect(() => {
    let unsub: undefined | (() => void);
    let alive = true;

    try {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) return;
      if (!('serviceWorker' in navigator)) return;

      (async () => {
        unsub = await onForegroundMessage(async (p: any) => {
          if (!alive) return;

          try {
            const n = p?.notification || {};
            const d = p?.data || {};

            const title = n.title || d.title || 'PEPS';
            const body = n.body || d.body || '';
            const icon = d.icon || '/icon-512x512.png';
            const tag = d.tag || `peps-reminder-${Date.now()}`;
            const url = d.url || '/';

            const reg = await navigator.serviceWorker.ready;

            if (typeof (reg as any).showNotification !== 'function') {
              return;
            }

            (reg as any).showNotification(title, {
              body,
              icon,
              tag,
              renotify: true,
              data: { url },
            } as any);

          } catch {
            // Ne jamais bloquer PEPS à cause des notifications
          }
        });
      })();

    } catch {
      // Ne jamais bloquer le rendu de PEPS
    }

    return () => {
      if (unsub) unsub();
      alive = false;
    };

  }, []);

  return null;
}