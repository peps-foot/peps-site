'use client'

import OnlyClient from './OnlyClient'
import SupabaseProvider from './SupabaseProvider'
import { NavBar } from './NavBar'
import { usePathname } from 'next/navigation'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
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
