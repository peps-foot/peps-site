'use client'

import { createContext, useContext, useMemo } from 'react'
import supabase from '../lib/supabaseBrowser'
import type { SupabaseClient } from '@supabase/supabase-js'

console.log('[SupabaseProvider] rendu');

const SupabaseContext = createContext<SupabaseClient | null>(null)

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) throw new Error('useSupabase must be used inside SupabaseProvider')
  return context
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  console.log('📦 SupabaseProvider loaded')

  const supabaseClient = useMemo(() => {
    if (typeof window === 'undefined') {
      console.warn('⚠️ SupabaseProvider loaded on server — skipping client init')
      return null
    }

    return supabase
  }, [])

  if (!supabaseClient) return null

  return (
    <SupabaseContext.Provider value={supabaseClient}>
      {children}
    </SupabaseContext.Provider>
  )
}
