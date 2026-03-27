import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

export const updateSession = async (request: NextRequest) => {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const localeAuthPath = /^\/[a-zA-Z-]+\/(login|register)(\/)?$/
  const localeRootPath = /^\/[a-zA-Z-]+(\/)?$/

  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/project/') ||
    localeAuthPath.test(pathname)

  if (!user && !isPublicPath) {
    if (pathname === '/' || localeRootPath.test(pathname)) {
      return NextResponse.redirect(new URL('/en/login', request.url))
    }
    return NextResponse.redirect(new URL('/en/login', request.url))
  }

  if (user && (pathname === '/login' || pathname === '/register' || localeAuthPath.test(pathname))) {
    return NextResponse.redirect(new URL('/en/dashboard', request.url))
  }

  return response
}

