'use client';
import { useEffect } from 'react';
import { getFcmToken, onForegroundMessage } from '../lib/firebaseClient';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rvswrzxdzfdtenxqtbci.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTg2ODQyMCwiZXhwIjoyMDYxNDQ0NDIwfQ.p4w76jidgv8b4I-xBhKyM8TLGXM9wnxrmtDLClbKWjQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export default function PushBootstrap() {
  // 1) Abonnement + enregistrement token
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) return; // ← garde iOS
      if (Notification.permission !== 'granted') return;
      if (!('serviceWorker' in navigator)) return;

      (async () => {
        try {
          const [{ data }, token] = await Promise.all([
            supabase.auth.getUser(),
            getFcmToken(),
          ]);
          if (!token) return;
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
    } catch {
      // no-op (ne jamais casser le rendu)
    }
  }, []);

  // 2) Réception foreground (affichage via SW quand c’est possible)
  useEffect(() => {
    let unsub: undefined | (() => void);
    let alive = true;
    try {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) return; // ← garde iOS
      if (!('serviceWorker' in navigator)) return;

      (async () => {
        unsub = await onForegroundMessage(async (p: any) => {
          if (!alive) return;
          try {
            const n = p?.notification || {};
            const d = p?.data || {};
            const title = n.title || d.title || 'PEPS';
            const body  = n.body  || d.body  || '';
            const icon  = d.icon || '/icon-512x512.png';
            const tag   = d.tag  || `peps-reminder-${Date.now()}`;
            const url   = d.url  || '/';

            const reg = await navigator.serviceWorker.ready;
            // showNotification peut être absent (iOS en foreground)
            if (typeof (reg as any).showNotification !== 'function') return;

            (reg as any).showNotification(title, {
              body, icon, tag, renotify: true, data: { url },
            } as any);
          } catch {
            // no-op
          }
        });
      })();
    } catch {
      // no-op
    }
    return () => { if (unsub) unsub(); alive = false; };
  }, []);

  return null;
}
