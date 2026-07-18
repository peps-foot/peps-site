import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(
      new URL('/connexion?error=google', requestUrl.origin)
    )
  }

  const cookieStore = await cookies()

  const supabaseUrl = 'https://rvswrzxdzfdtenxqtbci.supabase.co'
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2c3dyenhkemZkdGVueHF0YmNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4Njg0MjAsImV4cCI6MjA2MTQ0NDQyMH0.cdvoEv3jHuYdPHnR9Xf_mkVyKgupSRJFLi25KMtqaNk'

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Variables Supabase manquantes')

    return NextResponse.redirect(
      new URL('/connexion?error=configuration', requestUrl.origin)
    )
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Erreur callback Google :', error)

    return NextResponse.redirect(
      new URL('/connexion?error=google', requestUrl.origin)
    )
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}