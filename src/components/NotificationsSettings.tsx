// src/components/NotificationsSettings.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import supabaseBrowser from '../lib/supabaseBrowser'; // import par défaut (sans accolades)
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
  allow_admin_broadcast: true,
  allow_grid_done: true,
  allow_match_reminder_24h: true,
  allow_match_reminder_1h: true,
};

export default function NotificationsSettings() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [perm, setPerm] = useState<NotificationPermission>('default');
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // On détecte la plate-forme pour l'enregistrement
  const platform = useMemo<'web' | 'twa' | 'android' | 'ios'>(() => {
    // (si tu as un flag "TWA" côté app, remplace par 'twa')
    return 'web';
  }, []);

  useEffect(() => {
    (async () => {
      setSupported(await isFcmSupported());
      setPerm(typeof Notification === 'undefined' ? 'denied' : Notification.permission);

      // get user
      const { data } = await supabaseBrowser.auth.getUser();
      setUserId(data.user?.id ?? null);

      // token local si déjà abonné
      const t = localStorage.getItem('peps_push_token');
      if (t) setToken(t);

      // prefs si user connu
      if (data.user?.id) {
        try {
          const r = await fetch(`/api/push/prefs?user_id=${data.user.id}`);
          const j = await r.json();
          if (j?.ok && j.prefs) setPrefs({
            allow_admin_broadcast: !!j.prefs.allow_admin_broadcast,
            allow_grid_done: !!j.prefs.allow_grid_done,
            allow_match_reminder_24h: !!j.prefs.allow_match_reminder_24h,
            allow_match_reminder_1h: !!j.prefs.allow_match_reminder_1h,
          });
        } catch {}
      }
    })();
  }, []);

  async function handleEnable() {
    setMsg(null); setLoading(true);
    try {
      const p = await askNotificationPermission();
      setPerm(p);
      if (p !== 'granted') {
        setMsg('Permission refusée.');
        return;
      }
      const res = await subscribeToken(platform, userId ?? undefined);
      if (res?.ok === false && res?.reason === 'no_token') {
        setMsg("Impossible d'obtenir un token (navigateur non supporté ?).");
        return;
      }
      const t = await getFcmToken();
      if (t) {
        setToken(t);
        localStorage.setItem('peps_push_token', t);
        setMsg('Notifications activées ✅');
      }
    } catch (e: any) {
      setMsg('Erreur pendant l’activation.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLinkToAccount() {
    if (!token) { setMsg('Aucun token local. Clique d’abord sur “Activer les notifications”.'); return; }
    setLoading(true); setMsg(null);
    try {
      const { data } = await supabaseBrowser.auth.getUser();
      const uid = data.user?.id ?? null;
      setUserId(uid);
      const r = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, platform, user_id: uid }),
      });
      if (!r.ok) throw new Error('subscribe failed');
      setMsg('Appareil relié à ton compte ✅');
    } catch {
      setMsg('Erreur : liaison impossible.');
    } finally { setLoading(false); }
  }

  async function handleSavePrefs() {
    if (!userId) { setMsg("Connecte-toi pour enregistrer tes préférences."); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/push/prefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: userId, prefs }),
      });
      if (!r.ok) throw new Error();
      setMsg('Préférences enregistrées ✅');
    } catch {
      setMsg('Erreur : sauvegarde impossible.');
    } finally { setLoading(false); }
  }

  async function handleUnsubscribe() {
    if (!token) { setMsg('Pas de token à désabonner.'); return; }
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!r.ok) throw new Error();
      localStorage.removeItem('peps_push_token');
      setToken(null);
      setMsg('Désabonné de cet appareil ✅');
    } catch {
      setMsg('Erreur : désabonnement impossible.');
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-xl mx-auto rounded-xl border p-4 space-y-4">
      <h2 className="text-lg font-semibold">Notifications</h2>

      <div className="text-sm">
        <div>Support navigateur FCM : <b>{supported === null ? '...' : supported ? 'oui' : 'non'}</b></div>
        <div>Permission : <b>{perm}</b></div>
        <div>Utilisateur : <b>{userId ?? 'anonyme'}</b></div>
        <div className="truncate">Token local : <b>{token ? token.slice(0, 12) + '…' : '(aucun)'}</b></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={handleEnable} disabled={loading} className="px-3 py-2 rounded-md bg-black text-white">
          Activer les notifications
        </button>
        <button onClick={handleLinkToAccount} disabled={loading} className="px-3 py-2 rounded-md border">
          Relier cet appareil à mon compte
        </button>
        <button onClick={handleUnsubscribe} disabled={loading} className="px-3 py-2 rounded-md border">
          Se désabonner sur cet appareil
        </button>
      </div>

      <div className="space-y-2">
        <div className="font-medium">Mes préférences</div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs.allow_admin_broadcast}
                 onChange={e => setPrefs(p => ({ ...p, allow_admin_broadcast: e.target.checked }))}/>
          Autoriser les messages admin ponctuels
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs.allow_grid_done}
                 onChange={e => setPrefs(p => ({ ...p, allow_grid_done: e.target.checked }))}/>
          Alerte “grille terminée”
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs.allow_match_reminder_24h}
                 onChange={e => setPrefs(p => ({ ...p, allow_match_reminder_24h: e.target.checked }))}/>
          Rappel J-1 (24h)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={prefs.allow_match_reminder_1h}
                 onChange={e => setPrefs(p => ({ ...p, allow_match_reminder_1h: e.target.checked }))}/>
          Rappel H-1 (1h)
        </label>

        <button onClick={handleSavePrefs} disabled={loading} className="px-3 py-2 rounded-md bg-blue-600 text-white">
          Enregistrer mes préférences
        </button>
      </div>

      {msg && <div className="text-sm">{msg}</div>}
    </div>
  );
}
