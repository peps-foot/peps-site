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
import {
  isIosInstalled,
  isWebPushSupported,
  subscribeIosToken,
} from '../lib/iosPush';

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

  // Détection précise de la plateforme
  const platform = useMemo<'web' | 'twa' | 'ios'>(() => {
    if (typeof document === 'undefined') return 'web';
    // PWA iOS installée sur l'écran d'accueil
    if (isIosInstalled()) return 'ios';
    // TWA Android (Play Store)
    if (document.referrer?.startsWith('android-app://')) return 'twa';
    return 'web';
  }, []);

  // Message d'info spécifique iOS non installé
  const isIosNotInstalled = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    return isIos && !isIosInstalled();
  }, []);

  // Charger l'utilisateur + ses prefs
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

      const wants =
        prefs.allow_admin_broadcast ||
        prefs.allow_grid_done ||
        prefs.allow_match_reminder_24h ||
        prefs.allow_match_reminder_1h;

      if (!wants) {
        setMsg('Enregistré ✅');
        setLoading(false);
        return;
      }

      // 2) Demander la permission si nécessaire
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const p = await askNotificationPermission();
        if (p !== 'granted') {
          setMsg('Échec ❌ (permission refusée : aucune notification ne sera reçue).');
          setLoading(false);
          return;
        }
      }

      // 3) Abonnement selon la plateforme
      if (platform === 'ios') {
        // ── iOS : Web Push natif (pas FCM) ──
        if (!isWebPushSupported()) {
          setMsg('Ton iPhone ne supporte pas encore les notifications (iOS 16.4+ requis).');
          setLoading(false);
          return;
        }
        const result = await subscribeIosToken(userId);
        if (result.ok) {
          setMsg('Enregistré ✅ (notifications activées sur iPhone)');
        } else {
          setMsg('Échec ❌ (impossible de créer la subscription iOS, réessaie).');
        }
      } else {
        // ── Android / desktop : FCM ──
        const supported = await isFcmSupported();
        if (!supported) {
          setMsg("Échec ❌ (notifications impossibles sur ce navigateur, essaie d'ouvrir www.peps-foot.com dans Chrome).");
          setLoading(false);
          return;
        }
        const token = await getFcmToken();
        if (token) {
          await subscribeToken(platform as 'web' | 'twa', userId);
          localStorage.setItem('peps_push_token', token);
          setMsg('Enregistré ✅');
        } else {
          setMsg("Échec ❌ (réessaie plus tard ou essaie dans Chrome).");
        }
      }
    } catch {
      setMsg('Échec ❌ (erreur : sauvegarde impossible).');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto rounded-xl border p-4 space-y-3">

      {/* Avertissement iOS non installé */}
      {isIosNotInstalled && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <strong>iPhone détecté !</strong> Pour recevoir des notifications, tu dois d&apos;abord{' '}
          <strong>ajouter PEPS à ton écran d&apos;accueil</strong> depuis Safari (bouton Partager →
          &quot;Sur l&apos;écran d&apos;accueil&quot;), puis relancer l&apos;app depuis l&apos;icône.
        </div>
      )}

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
