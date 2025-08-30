'use client';

import { useEffect, useState } from 'react';
import { getFcmToken, onForegroundMessage } from '../../lib/firebaseClient';

export default function TestNotifsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  useEffect(() => {
    // écoute les messages reçus quand la page est au premier plan
    onForegroundMessage((p) => setLog((l) => l + '\n[FG] ' + JSON.stringify(p)));
  }, []);

  const enable = async () => {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { alert('Permission refusée'); return; }
    const t = await getFcmToken();
    setToken(t);
    if (!t) alert("Impossible d'obtenir un token (navigateur non supporté ?)");
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

  return (
    <div style={{maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif'}}>
      <h1>Test notifications PEPS</h1>
      <button onClick={enable} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8}}>1) Activer les notifications</button>
      <br /><br />
      <button onClick={sendTest} disabled={!token} style={{padding: 10, border: '1px solid #ddd', borderRadius: 8}}>
        2) M’envoyer une notif test
      </button>
      <br /><br />
      <div><strong>Token:</strong><br/><textarea value={token || ''} readOnly rows={4} style={{width:'100%'}} /></div>
      <pre style={{whiteSpace:'pre-wrap', background:'#f7f7f7', padding:10, borderRadius:8, marginTop:12}}>{log}</pre>
    </div>
  );
}
