'use client'

import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export const createClient = () => {
  if (typeof window === 'undefined') {
    console.warn('🛑 createClient appelé côté serveur — annulé.')
    return null
  }

  if (!client) {
    const url = "https://rvswrzxdzfdtenxqtbci.supabase.co"
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njg0MjAsImV4cCI6MjA2MTQ0NDQyMH0.cdvoEv3jHuYdPHnR9Xf_mkVyKgupSRJFLi25KMtqaNk" // ← ta vraie clé Supabase

    if (!url || !key) {
      console.error('❌ Supabase env vars missing')
      return null
    }

    client = createBrowserClient(url, key)
  }

  return client
}
