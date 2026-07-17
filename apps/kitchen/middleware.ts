import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (!request.nextUrl.searchParams.has('token')) return NextResponse.next()

  const cleanUrl = request.nextUrl.clone()
  cleanUrl.searchParams.delete('token')
  return NextResponse.redirect(cleanUrl, 307)
}

export const config = {
  matcher: '/kitchen/:path*',
}
