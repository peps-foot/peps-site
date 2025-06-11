'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import OnlyClient from './OnlyClient'
import SupabaseProvider from './SupabaseProvider'
import { NavBar } from './NavBar'

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  // 🔒 Ne rien afficher côté serveur ou avant montage
  if (!hasMounted) return null

  const hideNavbarRoutes = ['/connexion', '/inscription', '/admin/grids']
  const showNavbar = !hideNavbarRoutes.includes(pathname)

  return (
    <OnlyClient>
      <SupabaseProvider>
        {showNavbar && <NavBar />}
        {children}
      </SupabaseProvider>
    </OnlyClient>
  )
}
