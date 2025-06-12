'use client'

import { createContext, useContext, useMemo } from 'react'
import { createClient } from '@/lib/supabaseBrowser'
import type { SupabaseClient } from '@supabase/supabase-js'

const SupabaseContext = createContext<SupabaseClient | null>(null)

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) throw new Error('useSupabase must be used inside SupabaseProvider')
  return context
}

export default function SupabaseProvider({ children }: { children: React.ReactNode }) {
  console.log('📦 SupabaseProvider loaded')

  const supabase = useMemo(() => {
    if (typeof window === 'undefined') {
      console.warn('⚠️ SupabaseProvider loaded on server — skipping client init')
      return null
    }

    try {
      return createClient()
    } catch (e) {
      console.error('❌ Supabase init failed:', e)
      return null
    }
  }, [])

  if (!supabase) return null

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}
