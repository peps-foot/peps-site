'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function Deconnexion() {
  const router = useRouter();

  useEffect(() => {
    const deconnecter = async () => {
      await supabase.auth.signOut();
      router.push('/connexion');
    };

    deconnecter();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Déconnexion en cours...</p>
    </div>
  );
}
