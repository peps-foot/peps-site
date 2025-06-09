'use client'

import { ReactNode } from 'react'
import SupabaseProvider from '@/components/SupabaseProvider'
import { NavBar } from '@/components/NavBar'

export default function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <SupabaseProvider>
      <NavBar />
      {children}
    </SupabaseProvider>
  )
}
