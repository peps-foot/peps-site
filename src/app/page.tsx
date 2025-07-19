'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { supabase } from '../utils/supabase'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)
      const type = params.get('type')

      // ✅ NE PAS REDIRIGER si c'est un lien recovery (réinit mot de passe)
      if (type === 'recovery') {
        console.log("🟡 URL de réinitialisation détectée — pas de redirection.")
        return
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        console.log("🔴 Pas de session, redirection vers /connexion")
        router.replace('/connexion')
      }
    }
    check()
  }, [])

  return null
}
