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

  const subscribe = async () => {
    try {
      // 1) Permission
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        appendLog('Permission refusée.');
        return;
      }

      // 2) Récup token (via SW déjà prêt)
      const token = await getFcmToken();
      if (!token) {
        appendLog('Impossible de récupérer un token FCM.');
        return;
      }
      appendLog('Token récupéré: ' + token.slice(0, 16) + '…');

      // 3) Enregistrement en base
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, platform: 'web' }),
      });
      const json = await res.json();
      appendLog('subscribe → ' + JSON.stringify(json));
    } catch (e: any) {
      appendLog('subscribe error: ' + (e?.message || String(e)));
    }
  };

  const send = async () => {
    const res = await fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, body, url, platform }),
    });
    const txt = await res.text();
    setLog(txt);
  };

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

  // Optionnel: écouter les messages en premier plan (debug)
useEffect(() => {
  onForegroundMessage(async (p) => {
    const d = (p && p.data) || {};
    const reg = await navigator.serviceWorker.ready;
    const toAbs = (u: string) => new URL(u, location.origin).href;

    const title = d.title || 'PEPS';
    const body  = d.body  || '';
    const icon  = toAbs(d.icon || '/icon-512x512.png');
    const url   = d.url   || '/';
    // Astuce test : tag unique pour forcer une nouvelle bannière à chaque essai
    const tag   = (d.tag ? String(d.tag) : 'peps-broadcast') + '-' + Date.now();

    reg.showNotification(title, {
      body,
      icon,
      badge: toAbs('/icon-192x192.png'),
      data: { url },
      tag
      // ❌ pas de renotify ici (ça fait raler TypeScript)
    });
  });
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
