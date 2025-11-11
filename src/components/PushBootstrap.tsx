// src/components/PushBootstrap.tsx
'use client';

import { useEffect } from 'react';
import { getFcmToken, onForegroundMessage } from '../lib/firebaseClient';
import supabaseBrowser from '../lib/supabaseBrowser'; // ← ton singleton anon côté front

export default function PushBootstrap() {
  // 1) Abonnement auto si la permission est déjà "granted"
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    let alive = true;

    (async () => {
      try {
        const [{ data }, token] = await Promise.all([
          supabaseBrowser.auth.getUser(),   // ← SAFE (anon)
          getFcmToken(),                    // ← enregistre/assure le SW si besoin
        ]);

        if (!alive || !token) return;

        const prev = localStorage.getItem('peps_push_token');
        if (prev === token) {
          // déjà connu : on peut quand même poster pour rafraîchir last_seen_at côté BDD
        }

        const user_id = data.user?.id || null;

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, platform: 'web', user_id }),
        });

        localStorage.setItem('peps_push_token', token);
      } catch {
        // no-op
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 2) Réception foreground (page visible)
  useEffect(() => {
    let unsub: undefined | (() => void);
    let alive = true;
    const seenIds = new Set<string>();

    (async () => {
      unsub = await onForegroundMessage((p: any) => {
        if (!alive) return;

        const mid = p?.messageId || p?.data?.messageId;
        if (mid && seenIds.has(mid)) return;
        if (mid) seenIds.add(mid);

        const n = p?.notification || {};
        const d = p?.data || {};
        const title = n.title || d.title || 'PEPS';
        const body  = n.body  || d.body  || '';
        const icon  = d.icon  || '/icon-512x512.png';
        const tag   = d.tag   || `peps-foreground-${Date.now()}`;

        // On n'affiche en foreground que si autorisé
        if (Notification.permission === 'granted') {
          navigator.serviceWorker.ready.then((reg) => {
            // iOS Safari n'a pas showNotification sur reg
            if (typeof (reg as any).showNotification !== 'function') return;
            try {
              (reg as any).showNotification(title, {
                body,
                icon,
                tag,
                renotify: true,
                requireInteraction: true, // pour que la notif reste à l'écran
              });
            } catch {
              // no-op
            }
          });
        }
      });
    })();

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, []);

  return null;
}
