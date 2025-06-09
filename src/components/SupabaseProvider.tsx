'use client'

import { createContext, useContext, useMemo } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

const SupabaseContext = createContext(createClient())

export const useSupabase = () => useContext(SupabaseContext)

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => createClient(), [])
  return (
    <SupabaseContext.Provider value={client}>
      {children}
    </SupabaseContext.Provider>
  )
}
