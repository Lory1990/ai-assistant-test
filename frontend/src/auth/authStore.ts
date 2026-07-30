const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Il refresh token vive in localStorage: e' cio' che tiene la sessione aperta
// tra un reload e l'altro. L'access token invece sta solo in memoria e viene
// rigenerato all'avvio, cosi' non resta in giro piu' del necessario.
const REFRESH_TOKEN_KEY = 'family-hud.refreshToken'

// Margine con cui rinnovare l'access token prima della scadenza reale.
const REFRESH_MARGIN_SECONDS = 30

export interface TokenSet {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

type Listener = () => void

let accessToken: string | null = null
let accessTokenExpiresAt = 0
let refreshPromise: Promise<string | null> | null = null
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach((l) => l())
}

export function subscribeToAuth(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function isAuthenticated(): boolean {
  return accessToken !== null
}

function storeTokens(tokens: TokenSet) {
  accessToken = tokens.accessToken
  accessTokenExpiresAt = Date.now() + tokens.expiresIn * 1000
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  notify()
}

function clearTokens() {
  accessToken = null
  accessTokenExpiresAt = 0
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  notify()
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const payload = await res.json().catch(() => null)
    throw new Error(payload?.error ?? `Richiesta fallita: ${res.status}`)
  }
  return res.json() as Promise<T>
}

/**
 * Rinnova l'access token dal refresh token salvato. Le chiamate concorrenti
 * condividono la stessa promise: al primo caricamento parecchie query partono
 * insieme e non devono generare altrettanti refresh.
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (!storedRefreshToken) return Promise.resolve(null)

  refreshPromise = postJson<TokenSet>('/api/auth/refresh', { refreshToken: storedRefreshToken })
    .then((tokens) => {
      storeTokens(tokens)
      return tokens.accessToken
    })
    .catch(() => {
      // Refresh token scaduto o revocato: la sessione e' finita.
      clearTokens()
      return null
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

/** Access token valido, rinnovandolo se sta per scadere. null se non si e' loggati. */
export async function getAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < accessTokenExpiresAt - REFRESH_MARGIN_SECONDS * 1000) {
    return accessToken
  }
  return refreshAccessToken()
}

/** Da chiamare all'avvio: ripristina la sessione se c'e' un refresh token valido. */
export async function restoreSession(): Promise<boolean> {
  const token = await getAccessToken()
  return token !== null
}

export async function loginWithPassword(email: string, password: string): Promise<void> {
  storeTokens(await postJson<TokenSet>('/api/auth/login', { email, password }))
}

export async function register(email: string, password: string, displayName?: string): Promise<void> {
  storeTokens(await postJson<TokenSet>('/api/auth/register', { email, password, displayName }))
}

export function requestPasswordReset(email: string): Promise<{ ok: boolean }> {
  return postJson('/api/auth/forgot-password', { email })
}

/** Ritira i token parcheggiati dal backend dopo un login social. */
export async function completeSocialLogin(handoff: string): Promise<void> {
  storeTokens(await postJson<TokenSet>('/api/auth/social/handoff', { handoff }))
}

export async function logout(): Promise<void> {
  const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
  clearTokens()
  if (storedRefreshToken) {
    await postJson('/api/auth/logout', { refreshToken: storedRefreshToken }).catch(() => undefined)
  }
}

export interface SocialProvider {
  alias: string
  displayName: string
}

export async function fetchSocialProviders(): Promise<SocialProvider[]> {
  const res = await fetch(`${API_URL}/api/auth/providers`)
  if (!res.ok) return []
  return res.json() as Promise<SocialProvider[]>
}

/** Chiede al backend l'URL a cui mandare il browser per il login social. */
export async function startSocialLogin(alias: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/social/${alias}`)
  const payload = await res.json().catch(() => null)
  if (!res.ok) throw new Error(payload?.error ?? `Richiesta fallita: ${res.status}`)
  window.location.href = (payload as { url: string }).url
}
