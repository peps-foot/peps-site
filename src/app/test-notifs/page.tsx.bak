'use client';

import { useEffect, useState } from 'react';
import { getFcmToken, onForegroundMessage } from '../../lib/firebaseClient';
import { getMessaging, isSupported, getToken, deleteToken } from 'firebase/messaging';

export default function TestNotifsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  // 1) ajoute la fonction
  const sendFromDb = async () => {
    const res = await fetch('/api/push/send-latest', { method: 'POST' });
    const txt = await res.text();
    setLog((l) => l + '\n[send-latest] ' + txt);
  };

  const sendTestDelayed = async () => {
    if (!token) return alert('Pas de token');
    setTimeout(async () => {
        await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            token,
            title: 'But !!!',
            body: 'Test de notif PEPS ⚽ (arrière-plan)',
            url: 'https://www.peps-foot.com/'
        })
        });
    }, 5000); // 5 secondes
    };

    useEffect(() => {
    onForegroundMessage((p) => {
        setLog((l) => l + '\n[FG] ' + JSON.stringify(p));
        const t = p.notification?.title || p.data?.title || 'PEPS';
        const b = p.notification?.body  || p.data?.body  || '';
        if (Notification.permission === 'granted') {
        new Notification(t, { body: b, icon: '/favicon.ico' });
        }
    });
    }, []);

  const enable = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert('Permission refusée'); return; }
    const t = await getFcmToken();
    setToken(t);
    const r = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: t, platform: 'web' }),
    });
    console.log('subscribe ->', r.status, await r.text());
    if (!t) alert("Impossible d'obtenir un token (navigateur non supporté ?)");
  };

  const disable = async () => {
    if (!(await isSupported())) return;

    // on récupère le token courant pour le supprimer en BDD
    const messaging = getMessaging(app);
    const currentToken = await getToken(messaging).catch(() => null);

    if (currentToken) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: currentToken }),
      });
    }

    const ok = await deleteToken(messaging);
    if (ok) {
      setToken(null);
      alert('Notifications désactivées et token supprimé en BDD.');
    } else {
      alert('Aucun token à supprimer (déjà désabonné ?)');
    }
  };

  const sendTest = async () => {
    if (!token) return alert('Pas de token');
    const res = await fetch('/api/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        title: 'But !!!',
        body: 'Test de notif PEPS ⚽',
        url: 'https://www.peps-foot.com/'
      })
    });
    const j = await res.json();
    setLog((l) => l + '\n[send] ' + JSON.stringify(j));
  };

  const sendAll = async () => {
    const res = await fetch('/api/push/send-all', { method: 'POST' });
    const txt = await res.text();
    setLog((l) => l + '\n[send-all] ' + txt);
  };

  return (
    <div style={{maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif'}}>
      <h1>Test notifications PEPS</h1>
      <button onClick={enable} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8}}>1) Activer les notifications</button>
      <br /><br />
<button onClick={sendTest} disabled={!token} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8}}>
  2) M’envoyer une notif test
</button>
&nbsp;
<button onClick={sendTestDelayed} disabled={!token} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8}}>
  3) M’envoyer une notif dans 5s
</button>
<button onClick={sendFromDb} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8, marginLeft: 8}}>
  4) Envoyer depuis la BDD
</button>
<button onClick={sendAll} style={{padding:10, border:'1px solid #ddd', borderRadius:8, marginLeft:8}}>
  5) Envoyer à tous (BDD)
</button>
      <br /><br />
      <div><strong>Token:</strong><br/><textarea value={token || ''} readOnly rows={4} style={{width:'100%'}} /></div>
      <pre style={{whiteSpace:'pre-wrap', background:'#f7f7f7', padding:10, borderRadius:8, marginTop:12}}>{log}</pre>
    </div>
  );
}
