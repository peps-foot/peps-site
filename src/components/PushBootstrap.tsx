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

  // 2) Réception foreground
  // On n'affiche PAS de notification ici : si l'app est ouverte, l'utilisateur
  // voit déjà l'interface. Le SW (onBackgroundMessage) gère l'affichage quand
  // l'app est en arrière-plan. Afficher ici créerait un doublon.
  useEffect(() => {
    let unsub: undefined | (() => void);
    let alive = true;
    try {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) return;
      if (!('serviceWorker' in navigator)) return;

      (async () => {
        unsub = await onForegroundMessage((p: any) => {
          if (!alive) return;
          // Log uniquement pour debug — pas d'affichage de notif en foreground
          console.log('[PEPS][FCM] message reçu en foreground (pas affiché):', p?.data?.title);
        });
      })();
    } catch {
      // no-op
    }
    return () => { if (unsub) unsub(); alive = false; };
  }, []);

  return null;
}
