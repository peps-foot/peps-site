'use client';

import { useEffect, useState } from 'react';
import supabase from '../lib/supabaseBrowser';
import {
  ensurePushToken,
  requestPushPermission,
} from '../lib/pushClient';

const PROMPT_KEY = 'peps_notif_prompt_last';
const RETRY_DELAY_MS = 10 * 24 * 60 * 60 * 1000;
const HOME_DELAY_MS = 5 * 1000;

export default function NotificationsNudge() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const checkNotifications = async () => {
      try {
        // On vérifie uniquement après être arrivé sur l'accueil
        await new Promise((resolve) => setTimeout(resolve, HOME_DELAY_MS));

        if (cancelled) return;

        const {
          data: { user },
        } = await supabase.auth.getUser();

        // Pas connecté → aucune popup
        if (!user) return;

        // --------------------------------------------------
        // 1. Si les notifications sont déjà autorisées,
        //    on essaie silencieusement d'enregistrer le token.
        // --------------------------------------------------
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          await ensurePushToken(user.id);
          return;
        }

        // --------------------------------------------------
        // 2. Si le navigateur a déjà refusé les notifications,
        //    on ne peut pas afficher à nouveau la demande native.
        // --------------------------------------------------
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'denied'
        ) {
          return;
        }

        // --------------------------------------------------
        // 3. L'utilisateur n'a pas encore choisi.
        //    Vérifier notre délai de rappel de 10 jours.
        // --------------------------------------------------
        const lastPrompt = localStorage.getItem(PROMPT_KEY);

        if (lastPrompt) {
          const elapsed = Date.now() - Number(lastPrompt);

          if (elapsed < RETRY_DELAY_MS) {
            return;
          }
        }

        if (!cancelled) {
          setOpen(true);
        }

      } catch (error) {
        console.error(
          '[PEPS][Push] Erreur vérification notifications :',
          error
        );
      }
    };

    checkNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAccept() {
    if (loading) return;

    setLoading(true);

    try {
      const permission = await requestPushPermission();

      if (permission === 'granted') {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await ensurePushToken(user.id);
        }
      }

      localStorage.setItem(PROMPT_KEY, String(Date.now()));
      setOpen(false);

    } catch (error) {
      console.error(
        '[PEPS][Push] Erreur activation notifications :',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  function handleDecline() {
    localStorage.setItem(PROMPT_KEY, String(Date.now()));
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">

        <h2 className="text-center text-xl font-bold text-gray-900">
          🔔 Active les notifications PEPS
        </h2>

        <p className="mt-3 text-center text-sm leading-6 text-gray-600">
          Reçois directement tes rappels pour ne pas rater tes
          pronostics et suivre tes compétitions.
        </p>

        <button
          type="button"
          onClick={handleAccept}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {loading ? 'Activation...' : 'Activer les notifications'}
        </button>

        <button
          type="button"
          onClick={handleDecline}
          disabled={loading}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Pas maintenant
        </button>

      </div>
    </div>
  );
}