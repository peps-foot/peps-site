'use client'

import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/supabaseClientEnv'

let client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (typeof window === 'undefined') {
    console.warn('🔴 createClient appelé côté serveur — annulé.')
    return null
  }

  if (!client) {
    console.log('🌐 SUPABASE_URL', SUPABASE_URL)
    console.log('🗝️ SUPABASE_ANON_KEY', SUPABASE_ANON_KEY?.substring(0, 6))

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Supabase env vars still missing')
      return null
    }

    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  return client
}
