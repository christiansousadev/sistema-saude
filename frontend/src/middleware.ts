import { type NextRequest, NextResponse } from 'next/server'

/**
 * B-4: Middleware Next.js para proteção de rotas antes da renderização.
 *
 * Estratégia:
 * - Rotas /admin/* requerem cookie ss_access_token (autenticação)
 * - A verificação de is_superadmin é feita pelo backend (HTTP 403) — o middleware
 *   só verifica a presença do cookie de sessão para evitar o flash do layout.
 *
 * Nota: O cookie ss_access_token é HttpOnly, então o middleware do servidor
 * consegue lê-lo via request.cookies — JS do browser não consegue.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── rotas protegidas: qualquer /dashboard, /physical, /clinical, /settings, /admin ──
  const isProtected = pathname.startsWith('/dashboard')
    || pathname.startsWith('/physical')
    || pathname.startsWith('/clinical')
    || pathname.startsWith('/settings')
    || pathname.startsWith('/admin')

  if (!isProtected) return NextResponse.next()

  // verifica o cookie de sessão — leitura server-side (HttpOnly está acessível aqui)
  const sessionToken = request.cookies.get('ss_access_token')
  const sessionExp = request.cookies.get('ss_session_exp')

  const hasSession = Boolean(sessionToken?.value)
  const sessionExpired = sessionExp
    ? Date.now() / 1000 >= parseInt(sessionExp.value, 10)
    : true

  // sem sessão ou expirada → redireciona para login
  if (!hasSession || sessionExpired) {
    const loginUrl = new URL('/login', request.url)
    // preserva o destino original para redirecionar após o login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // sessão presente → continua normalmente
  // a verificação de is_superadmin fica com o backend (retorna 403 para não-admins)
  return NextResponse.next()
}

export const config = {
  // aplica o middleware a todas as rotas — exceto assets, API routes e arquivos estáticos
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|register|api/).*)',
  ],
}
