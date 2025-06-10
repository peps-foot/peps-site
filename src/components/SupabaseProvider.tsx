'use client'

import { createContext, useContext, useMemo } from 'react'
import { createClient } from '@/lib/supabaseBrowser'

import type { SupabaseClient } from '@supabase/supabase-js'
//import type { Database } from '@/types/supabase' // tu peux retirer ça si tu n’as pas typé ta DB

const SupabaseContext = createContext<SupabaseClient | null>(null)

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) throw new Error('useSupabase must be used inside SupabaseProvider')
  return context
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  console.log('📦 SupabaseProvider loaded')
  const supabase = useMemo(() => {
  try {
    return createClient()
  } catch (e) {
    console.error('❌ Supabase init failed:', e)
    return null
  }
  }, [])
  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}
