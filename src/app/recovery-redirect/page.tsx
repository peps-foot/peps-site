'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RecoveryRedirect() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    console.log('📦 Hash capturé dans recovery-redirect:', hash)
    router.replace(`/reset-password${hash}`)
  }, [])

  return (
    <div className="text-center p-10">
      <p>Redirection sécurisée en cours...</p>
    </div>
  )
}
