'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { NavBar } from './NavBar'
import SupabaseProvider from './SupabaseProvider'

console.log('[ClientLayout] rendu');

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  const hideNavBarRoutes = ['/connexion', '/inscription', '/admin/grids','/regles_connexion']
  const showNavbar = pathname ? !hideNavBarRoutes.some(route => pathname.startsWith(route)) : false
  console.log('[ClientLayout] pathname =', pathname);
  console.log('[ClientLayout] showNavbar =', showNavbar);

  return (
    <SupabaseProvider>
      {showNavbar && <NavBar />}
      {children}
    </SupabaseProvider>
  )
}
