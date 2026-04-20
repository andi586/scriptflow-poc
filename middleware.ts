import { NextRequest, NextResponse } from 'next/server'

const PASSWORD = 'heaven2026'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /create and /movie pages
  if (pathname.startsWith('/create') || pathname.startsWith('/movie')) {
    const cookie = req.cookies.get('sf_access')
    if (cookie?.value === PASSWORD) return NextResponse.next()

    // Check password in URL param
    const pwd = req.nextUrl.searchParams.get('pwd')
    if (pwd === PASSWORD) {
      const res = NextResponse.next()
      res.cookies.set('sf_access', PASSWORD, { maxAge: 60 * 60 * 24 * 7 })
      return res
    }

    // Redirect to password page
    return NextResponse.redirect(new URL('/enter', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/create/:path*', '/movie/:path*']
}
