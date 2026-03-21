import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function RootPage() {
  // FIXED: Added await here to resolve the cookie store properly
  const cookieStore = await cookies()
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Primary Page Logic:
  // If we have a session, go straight to the portfolio selection screen
  if (user) {
    redirect('/dashboard')
  } else {
    // Otherwise, require authentication
    redirect('/login')
  }
}