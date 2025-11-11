// src/components/AdminPushPanel.tsx
'use client';

import { useEffect, useState } from 'react';
import { getFcmToken, onForegroundMessage } from '../lib/firebaseClient';

export default function AdminPushPanel() {
  const [title, setTitle] = useState('Info PEPS');
  const [body, setBody] = useState('Message aux joueurs');
  const [url, setUrl] = useState('https://www.peps-foot.com/');
  const [platform, setPlatform] = useState<'all' | 'web' | 'twa' | 'ios' | 'android'>('all');
  const [log, setLog] = useState('');

  const appendLog = (line: string) =>
    setLog((prev) => (prev ? prev + '\n' + line : line));

  // 1) Enregistrer mon propre token (au clic)
  const subscribe = async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        appendLog('Notifications non supportées sur cet appareil.');
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { appendLog('Permission refusée.'); return; }

      const token = await getFcmToken();
      if (!token) { appendLog('Impossible de récupérer un token FCM.'); return; }

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, platform: 'web' }),
      });
      appendLog('subscribe → ' + (await res.text()));
    } catch (e: any) {
      appendLog('subscribe error: ' + (e?.message || String(e)));
    }
  };


  // 2) Broadcast immédiat
  const send = async () => {
    const res = await fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, body, url, platform }),
    });
    const txt = await res.text();
    setLog(txt);
  };

  // 3) Broadcast dans 5s
  const sendDelayed = async () => {
    setLog('Envoi dans 5s…');
    setTimeout(async () => {
      const res = await fetch('/api/push/broadcast', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, body, url, platform }),
      });
      const txt = await res.text();
      setLog(txt);
    }, 5000);
  };

  // 4) Debug foreground (affiche une notif si l’onglet est visible)
    useEffect(() => {
      let unsub: (() => void) | undefined;
      try {
        if (typeof window === 'undefined') return;
        if (!('Notification' in window)) return; // 🧱 Garde iOS
        if (!('serviceWorker' in navigator)) return;

        (async () => {
          unsub = await onForegroundMessage(async (p) => {
            try {
              const d = (p && p.data) || {};
              const reg = await navigator.serviceWorker.ready;
              const toAbs = (u: string) => {
                try { return new URL(u, location.origin).href; } catch { return u; }
              };

              const title = d.title || 'PEPS';
              const body  = d.body  || '';
              const icon  = toAbs(d.icon || '/icon-512x512.png');
              const url   = d.url   || '/';
              const tag   = (d.tag ? String(d.tag) : 'peps-broadcast') + '-' + Date.now();

              // 🧱 iOS: showNotification souvent absent en foreground
              if (typeof (reg as any).showNotification !== 'function') {
                appendLog?.('[FG] showNotification non disponible (iOS ?).');
                return;
              }

              (reg as any).showNotification(title, {
                body,
                icon,
                badge: toAbs('/icon-192x192.png'),
                data: { url },
                tag,
                requireInteraction: true, // 👁️ reste visible jusqu’à clic
              });
            } catch (e) {
              appendLog?.('[FG] error: ' + String(e));
            }
          });
        })();
      } catch {
        // Pas de crash en cas d’erreur d’environnement
      }

      return () => { if (unsub) unsub(); };
    }, []);

  return (
    <section style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Notifications · Envoi manuel</h2>

      <div style={{ marginBottom: 16 }}>
        <button
          onClick={subscribe}
          style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
        >
          Activer les notifications (enregistrer mon token)
        </button>
      </div>

      <label style={{ display: 'block', fontWeight: 600 }}>Titre</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', padding: 8, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 8 }}
      />

      <label style={{ display: 'block', fontWeight: 600 }}>Texte</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        style={{ width: '100%', padding: 8, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 8 }}
      />

      <label style={{ display: 'block', fontWeight: 600 }}>URL (au clic)</label>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        style={{ width: '100%', padding: 8, margin: '6px 0 12px', border: '1px solid #ddd', borderRadius: 8 }}
      />

      <label style={{ display: 'block', fontWeight: 600 }}>Plateforme</label>
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as any)}
        style={{ padding: 8, margin: '6px 0 16px', border: '1px solid #ddd', borderRadius: 8 }}
      >
        <option value="all">Tous</option>
        <option value="web">Web</option>
        <option value="twa">TWA</option>
        <option value="android">Android (natif)</option>
        <option value="ios">iOS</option>
      </select>

      <div>
        <button
          onClick={send}
          style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
        >
          Envoyer maintenant
        </button>
        <button
          onClick={sendDelayed}
          style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer', marginLeft: 8 }}
        >
          Envoyer dans 5s
        </button>
      </div>

<div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
  <div style={{ fontWeight: 600 }}>Tâches “cron” manuelles</div>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    <button
      onClick={async () => setLog(await (await fetch('/api/push/cron?type=H24')).text())}
      style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
    >
      Lancer rappel H-24
    </button>
    <button
      onClick={async () => setLog(await (await fetch('/api/push/cron?type=H1')).text())}
      style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
    >
      Lancer rappel H-1
    </button>
    <button
      onClick={async () => setLog(await (await fetch('/api/push/cron?type=GRID_DONE')).text())}
      style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
    >
      Lancer “grille terminée”
    </button>
  </div>

  <div style={{ marginTop: 8 }}>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
      Test ciblé (user_id UUID)
    </label>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        placeholder="619cda3f-26c0-4ef5-aace-26770f977942"
        onChange={(e) => (window as any).__ONLY_UID = e.target.value}
        style={{ flex: 1, minWidth: 260, padding: 8, border: '1px solid #ddd', borderRadius: 8 }}
      />
      <button
        onClick={async () => {
          const uid = (window as any).__ONLY_UID;
          if (!uid) { setLog('Renseigne un user_id'); return; }
          setLog(await (await fetch(`/api/push/test-user?only=${uid}`)).text());
        }}
        style={{ padding: 10, border: '1px solid #ddd', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
      >
        Tester cet utilisateur
      </button>
    </div>
  </div>
</div>


      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f7f7f7',
          padding: 10,
          borderRadius: 8,
          marginTop: 16,
          maxHeight: 280,
          overflow: 'auto',
        }}
      >
        {log}
      </pre>
    </section>
  );
}
