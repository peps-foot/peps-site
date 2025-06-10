'use client'

import { createBrowserClient } from '@supabase/ssr'

console.log('🔍 ENV CHECK - URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
console.log('🔍 ENV CHECK - KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export const createClient = () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Supabase env vars are missing!')
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

