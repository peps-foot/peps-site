// src/components/NotificationsSettings.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import supabaseBrowser from '../lib/supabaseBrowser';
import {
  askNotificationPermission,
  getFcmToken,
  isFcmSupported,
  subscribeToken,
} from '../lib/firebaseClient';

type Prefs = {
  allow_admin_broadcast: boolean;
  allow_grid_done: boolean;
  allow_match_reminder_24h: boolean;
  allow_match_reminder_1h: boolean;
};

const DEFAULTS: Prefs = {
  allow_admin_broadcast: false,
  allow_grid_done: false,
  allow_match_reminder_24h: false,
  allow_match_reminder_1h: false,
};

export default function NotificationsSettings() {
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Détection "TWA" (Trusted Web Activity) vs web
  const platform = useMemo<'web' | 'twa'>(() => {
    // Heuristique TWA fiable : referrer android-app://
    if (typeof document !== 'undefined' && document.referrer?.startsWith('android-app://')) {
      return 'twa';
    }
    return 'web';
  }, []);

  // Charger l’utilisateur + ses prefs
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabaseBrowser.auth.getUser();
      if (!alive) return;
      const uid = data.user?.id ?? null;
      setUserId(uid);

      if (uid) {
        try {
          const r = await fetch(`/api/push/prefs?user_id=${uid}`);
          const j = await r.json();
          if (j?.ok && j.prefs) {
            setPrefs({
              allow_admin_broadcast: j.prefs.allow_admin_broadcast ?? false,
              allow_grid_done: j.prefs.allow_grid_done ?? false,
              allow_match_reminder_24h: j.prefs.allow_match_reminder_24h ?? false,
              allow_match_reminder_1h: j.prefs.allow_match_reminder_1h ?? false,
            });
          }
        } catch {
          // no-op
        }
      }
    })();
    return () => { alive = false; };
  }, []);

const handleSave = async () => {
  if (!userId) {
    setMsg('Connecte-toi pour enregistrer tes préférences.');
    return;
  }
  setLoading(true);
  setMsg(null);

  try {
    // 1) Enregistrer les préférences côté BDD
    const res = await fetch('/api/push/prefs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ user_id: userId, prefs }),
    });
    const js = await res.json();
    if (!js?.ok) throw new Error('save prefs failed');

    // 2) Si le joueur veut des notifs, on prépare le canal (permission + token + subscribe)
    const wants =
      prefs.allow_admin_broadcast ||
      prefs.allow_grid_done ||
      prefs.allow_match_reminder_24h ||
      prefs.allow_match_reminder_1h;

    if (wants) {
      const supported = await isFcmSupported();
      const isIos =
        typeof navigator !== 'undefined' &&
        /iPhone|iPad|iPod/i.test(navigator.userAgent || '');

      if (!supported) {
        // Cas : iOS
        if (isIos) {
          setMsg("Échec ❌ (notifications impossibles sur iPhone pour l'instant).");
        } else {
          // Cas : navigateur non compatible
          setMsg(
            "Échec ❌ (notifications impossibles sur ce navigateur, essayez d'ouvrir www.peps-foot.com dans un autre navigateur)."
          );
        }
        setLoading(false);
        return;
      }

      // Permission si nécessaire
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const p = await askNotificationPermission();
        if (p !== 'granted') {
          setMsg("Échec ❌ (permission refusée : aucune notification ne sera reçue).");
          setLoading(false);
          return;
        }
      }

      // Token + enregistrement côté serveur
      const token = await getFcmToken();
      if (token) {
        await subscribeToken(platform, userId);
        localStorage.setItem('peps_push_token', token);
        setMsg('Enregistré ✅');
      } else {
        // Tout semble ok mais pas de token => on propose d’essayer un autre navigateur
        setMsg(
          "Échec ❌ (notifications impossibles sur cet appareil/navigateur, essayez d'ouvrir www.peps-foot.com dans un autre navigateur)."
        );
      }
    } else {
      // L'utilisateur ne veut pas de notifications, on enregistre juste les préférences
      setMsg('Enregistré ✅');
    }
  } catch {
    setMsg("Échec ❌ (erreur : sauvegarde impossible).");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="max-w-xl mx-auto rounded-xl border p-4 space-y-3">
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.allow_admin_broadcast}
            onChange={(e) => setPrefs(p => ({ ...p, allow_admin_broadcast: e.target.checked }))}
          />
          Messages ponctuels
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.allow_grid_done}
            onChange={(e) => setPrefs(p => ({ ...p, allow_grid_done: e.target.checked }))}
          />
          Grille terminée
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.allow_match_reminder_24h}
            onChange={(e) => setPrefs(p => ({ ...p, allow_match_reminder_24h: e.target.checked }))}
          />
          Rappel J-1 (24h)
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs.allow_match_reminder_1h}
            onChange={(e) => setPrefs(p => ({ ...p, allow_match_reminder_1h: e.target.checked }))}
          />
          Rappel H-1 (1h)
        </label>
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60 mx-auto block"
      >
        {loading ? 'Enregistrement…' : 'Enregistrer mes préférences'}
      </button>

      {msg && <div className="text-sm text-gray-800">{msg}</div>}
    </div>
  );
}
