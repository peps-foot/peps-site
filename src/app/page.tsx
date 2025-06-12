'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    // Redirige vers la seule compétition active
    router.replace('/0094ae32-8870-4ae9-b3d2-a3c237299302')
  }, [router])

  return null
}
