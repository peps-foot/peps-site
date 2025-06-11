'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (typeof window === 'undefined') {
    // Ne crée pas Supabase côté serveur
    console.warn('🛑 createClient appelé côté serveur — annulé.')
    return null
  }

  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    console.log('🌐 SUPABASE_URL', url)
    console.log('🗝️ SUPABASE_ANON_KEY', key?.substring(0, 6)) // pour ne pas tout afficher

    if (!url || !key) {
      console.error('❌ Supabase env vars missing')
      return null
    }

    client = createBrowserClient(url, key)
  }

  return client
}
