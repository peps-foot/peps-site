'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { NavBar } from './NavBar'
import SupabaseProvider from './SupabaseProvider'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  const hideNavBarRoutes = ['/connexion', '/inscription', '/admin/grids']
  const showNavbar = pathname ? !hideNavBarRoutes.includes(pathname) : false

  return (
    <SupabaseProvider>
      {showNavbar && <NavBar />}
      {children}
    </SupabaseProvider>
  )
}
