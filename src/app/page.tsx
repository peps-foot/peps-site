'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '../utils/supabase' // adapte le chemin si besoin

export default function Home() {
  const router = useRouter()
  
useEffect(() => {
  const check = async () => {
    const url = new URL(window.location.href);
    const type = url.searchParams.get('type');
    
    // ✅ NE PAS REDIRIGER si on est en recovery
    if (type === 'recovery') {
      console.log("🟡 On est sur une URL de réinitialisation — pas de redirection.");
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("🔴 Pas de session, redirection vers /connexion");
      router.replace('/connexion');
    }
  };
  check();
}, []);

  return null
}
