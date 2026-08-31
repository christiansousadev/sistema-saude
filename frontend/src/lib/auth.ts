/**
 * S-1: Gerenciamento de sessão via cookies.
 *
 * O JWT de acesso agora é armazenado em um cookie HttpOnly (ss_access_token)
 * definido pelo servidor — JavaScript não consegue lê-lo (proteção XSS).
 *
 * O cookie ss_session_exp contém apenas o timestamp de expiração da sessão
 * e é legível por JS para evitar chamadas desnecessárias ao /auth/me quando
 * a sessão já expirou.
 */

const SESSION_EXP_COOKIE = 'ss_session_exp'

// guard para evitar acesso ao document no lado servidor (SSR)
const isBrowser = typeof document !== 'undefined'

/**
 * Lê o valor de um cookie pelo nome.
 * Retorna null no servidor ou se o cookie não existir.
 */
function getCookieValue(name: string): string | null {
  if (!isBrowser) return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${encodeURIComponent(name)}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Retorna o timestamp Unix (em segundos) de expiração da sessão.
 * Lê o cookie ss_session_exp que o servidor define junto com o JWT.
 * Retorna null se não houver sessão ativa.
 */
export function getSessionExpiry(): number | null {
  const val = getCookieValue(SESSION_EXP_COOKIE)
  if (!val) return null
  const ts = parseInt(val, 10)
  return isNaN(ts) ? null : ts
}

/**
 * Verifica se a sessão provavelmente ainda é válida com base no cookie de expiração.
 * Usado no AuthContext.restore() para evitar chamada desnecessária ao /auth/me
 * quando o token já expirou.
 *
 * Nota: como o JWT real está em cookie HttpOnly, esta verificação usa apenas
 * o timestamp de expiração (ss_session_exp) como indicador.
 */
export function isSessionLikelyValid(): boolean {
  const exp = getSessionExpiry()
  if (!exp) return false
  // adiciona 5s de buffer para evitar race condition no limite de expiração
  return Date.now() / 1000 < exp - 5
}

/**
 * Remove o cookie de expiração do cliente.
 * Usado após logout bem-sucedido — o cookie HttpOnly é removido pelo servidor.
 */
export function clearSessionCookie(): void {
  if (!isBrowser) return
  // expira o cookie de expiração no cliente
  document.cookie = `${SESSION_EXP_COOKIE}=; Max-Age=0; path=/`
}
