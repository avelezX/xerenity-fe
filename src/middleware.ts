import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req:NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // if user is signed in and the current path is / redirect the user to /account
  if (session) {
    return NextResponse.redirect(new URL('/home', req.url))
  }

  // if user is not signed in and the current path is not / redirect the user to /
  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

      // add the CORS headers to the response
      
  return res
}

export const config = {
  matcher: ['/', '/'],
}