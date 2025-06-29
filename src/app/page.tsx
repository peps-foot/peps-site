'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function Home() {
  const router = useRouter()
  const [isRedirecting, setIsRedirecting] = useState(true)
  
  useEffect(() => {
    // Redirige vers la seule compétition active
    router.replace('/connexion')
  }, [router])

    if (isRedirecting) return null
  return null
}
