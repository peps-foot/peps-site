'use client';
import { useState } from 'react';

export default function AdminPushPage() {
  const [title, setTitle] = useState('Info PEPS');
  const [body, setBody]   = useState('Message aux joueurs');
  const [url, setUrl]     = useState('https://www.peps-foot.com/');
  const [platform, setPlatform] = useState<'all'|'web'|'twa'|'ios'|'android'>('all');
  const [log, setLog] = useState('');

  const send = async () => {
    const res = await fetch('/api/push/broadcast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, body, url, platform })
    });
    const txt = await res.text();
    setLog(txt);
  };

  return (
    <div style={{maxWidth:640, margin:'40px auto', fontFamily:'sans-serif'}}>
      <h1>Admin · Notification manuelle</h1>

      <label>Titre</label>
      <input value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%', padding:8, margin:'6px 0'}} />

      <label>Texte</label>
      <textarea value={body} onChange={e=>setBody(e.target.value)} rows={3} style={{width:'100%', padding:8, margin:'6px 0'}} />

      <label>URL (au clic)</label>
      <input value={url} onChange={e=>setUrl(e.target.value)} style={{width:'100%', padding:8, margin:'6px 0'}} />

      <label>Plateforme</label>
      <select value={platform} onChange={e=>setPlatform(e.target.value as any)} style={{padding:8, margin:'6px 0'}}>
        <option value="all">Tous</option>
        <option value="web">Web</option>
        <option value="twa">TWA</option>
        <option value="android">Android (natif)</option>
        <option value="ios">iOS</option>
      </select>

      <br/>
      <button onClick={send} style={{padding:10, border:'1px solid #ddd', borderRadius:8, marginTop:10}}>
        Envoyer maintenant
      </button>

      <pre style={{whiteSpace:'pre-wrap', background:'#f7f7f7', padding:10, borderRadius:8, marginTop:16}}>{log}</pre>
    </div>
  );
}
