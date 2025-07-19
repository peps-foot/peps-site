'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '../utils/supabase' // adapte le chemin si besoin

export default function Home() {
  const router = useRouter()
  
useEffect(() => {
  const check = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) router.replace('/connexion');
  };
  check();
}, []);


  return null
}
