'use client';
import { useEffect, useState } from 'react';
import { getFcmToken } from '../lib/firebaseClient';
import supabase from '../lib/supabaseBrowser';

export default function NotificationsSettings() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({
    allow_admin_broadcast: true,
    allow_grid_done: true,
    allow_match_reminder_24h: true,
    allow_match_reminder_1h: true,
  });
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

useEffect(() => {
  (async () => {
    console.log('[NotifSettings] getSession…');
    const { data: { session }, error } = await supabase.auth.getSession();
    console.log('[NotifSettings] session =', session?.user?.id, 'error =', error);
    const user_id = session?.user?.id || null;
    setUid(user_id);
    if (!user_id) { setLoading(false); return; }

    const res = await fetch(`/api/push/prefs?user_id=${user_id}`, { cache: 'no-store' });
    const json = await res.json();
    if (json?.prefs) setPrefs({
      allow_admin_broadcast: !!json.prefs.allow_admin_broadcast,
      allow_grid_done: !!json.prefs.allow_grid_done,
      allow_match_reminder_24h: !!json.prefs.allow_match_reminder_24h,
      allow_match_reminder_1h: !!json.prefs.allow_match_reminder_1h,
    });
    setLoading(false);
  })();
}, []);


  const linkDevice = async () => {
    if (!uid) return;
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { alert('Permission refusée.'); return; }
    }
    const token = await getFcmToken();
    if (!token) { alert('Impossible de récupérer un token FCM.'); return; }

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, platform: 'web', user_id: uid }),
    });
    alert('Appareil relié à ton compte 👍');
  };

  const save = async () => {
    if (!uid) return;
    await fetch('/api/push/prefs', {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ user_id: uid, prefs }),
    });
  };

  if (loading) return <p>Chargement…</p>;
  if (!uid) return <p>Connecte-toi pour gérer tes notifications.</p>;

  return (
    <div style={{maxWidth: 720, margin:'24px auto', fontFamily:'system-ui'}}>
      <h3 style={{fontSize:18, marginBottom:12}}>Mes notifications</h3>

      <label style={{display:'block', margin:'8px 0'}}>
        <input type="checkbox" checked={prefs.allow_grid_done} onChange={()=>toggle('allow_grid_done')} />
        <span style={{marginLeft:8}}>Grille terminée</span>
      </label>

      <label style={{display:'block', margin:'8px 0'}}>
        <input type="checkbox" checked={prefs.allow_match_reminder_24h} onChange={()=>toggle('allow_match_reminder_24h')} />
        <span style={{marginLeft:8}}>Rappel H-24 (match non parié)</span>
      </label>

      <label style={{display:'block', margin:'8px 0'}}>
        <input type="checkbox" checked={prefs.allow_match_reminder_1h} onChange={()=>toggle('allow_match_reminder_1h')} />
        <span style={{marginLeft:8}}>Rappel H-1 (match non parié)</span>
      </label>

      <label style={{display:'block', margin:'8px 0'}}>
        <input type="checkbox" checked={prefs.allow_admin_broadcast} onChange={()=>toggle('allow_admin_broadcast')} />
        <span style={{marginLeft:8}}>Messages ponctuels de PEPS (infos, alertes)</span>
      </label>

      <div style={{marginTop:8}}>
        <button onClick={linkDevice} style={{marginRight:8, padding:'8px 12px', border:'1px solid #ddd', borderRadius:8}}>
          Relier cet appareil à mon compte
        </button>
        <button onClick={save} style={{padding:'8px 12px', border:'1px solid #ddd', borderRadius:8}}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
