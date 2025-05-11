'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Profil() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      // 1) on récupère la session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        console.log('Pas de session, redirection possible');
        return;
      }

      // 2) on charge le profil lié au user_id
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', session.user.id)
        .single();

      if (error) {
        console.error('Erreur fetch profil :', error);
      } else {
        console.log('Profil récupéré :', data.username);
        setUsername(data.username);
      }
    };

    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6 bg-white shadow rounded text-center">
        <h1 className="text-xl font-bold mb-4">Page de Profil</h1>
        {username 
          ? <p>Ton pseudo est : <strong>{username}</strong></p>
          : <p>Chargement ou non connecté…</p>
        }
      </div>
    </div>
  );
}