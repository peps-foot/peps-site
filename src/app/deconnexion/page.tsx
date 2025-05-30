'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Deconnexion() {
  const router = useRouter()

  useEffect(() => {
    console.log('🏃 Déconnexion monté');
    fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'include',       // ← s’assure que le fetch accepte les cookies
    })
      .then(() => {
        // ← on purge manuellement les cookies Supabase au cas où
        document.cookie
          .split(';')
          .map(c => c.trim().split('=')[0])
          .filter(name => name.startsWith('sb-') || name.includes('supabase'))
          .forEach(name => {
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          })
        console.log('✅ signout terminé');
        router.push('/connexion')
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Déconnexion en cours…</p>
    </div>
  )
}
