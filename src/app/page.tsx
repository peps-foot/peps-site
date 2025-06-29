'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirige vers la seule compétition active
    router.replace('/connexion')
  }, [router])

  return null
}
