import { useEffect, useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  requestLoginCode,
  loginWithCode,
  fetchSocialProviders,
  startSocialLogin,
  type SocialProvider,
} from './authStore'

// Provider che offriamo nella schermata. Compaiono attivi solo se l'alias
// corrispondente esiste davvero tra gli identity provider del realm.
const OFFERED_PROVIDERS = [
  { alias: 'google', label: 'Google' },
  { alias: 'facebook', label: 'Facebook' },
]

function SocialButtons() {
  const [configured, setConfigured] = useState<SocialProvider[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSocialProviders()
      .then(setConfigured)
      .catch(() => setConfigured([]))
  }, [])

  async function start(alias: string) {
    setError(null)
    try {
      await startSocialLogin(alias)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  if (configured === null) return null

  return (
    <div className="login-social">
      <div className="login-divider">oppure</div>
      {OFFERED_PROVIDERS.map((p) => {
        const isConfigured = configured.some((c) => c.alias === p.alias)
        return (
          <button
            key={p.alias}
            type="button"
            className="hud-button hud-button--ghost"
            onClick={() => start(p.alias)}
            disabled={!isConfigured}
            title={
              isConfigured
                ? `Accedi con ${p.label}`
                : `Identity provider "${p.alias}" non configurato nel realm Keycloak`
            }
          >
            Continua con {p.label}
          </button>
        )
      })}
      {configured.length === 0 && (
        <p className="login-hint">
          Per attivare i login social aggiungi gli identity provider Google/Facebook nel realm Keycloak
          (Identity providers), con Client ID e Secret delle rispettive app OAuth.
        </p>
      )}
      {error && <p className="login-error">{error}</p>}
    </div>
  )
}

/**
 * Accesso senza password: si inserisce l'email, arriva un codice, si entra.
 * Non c'è distinzione tra accedere e registrarsi — chi riceve il codice ha
 * dimostrato di possedere quella casella, e l'account nasce al primo accesso.
 */
function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await requestLoginCode(email.trim())
      setStep('code')
      setNotice(`Ho inviato un codice a ${email.trim()}. Scade tra 10 minuti.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      // Al successo l'authStore notifica App, che monta la dashboard.
      await loginWithCode(email.trim(), code.trim(), displayName.trim() || undefined)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  function backToEmail() {
    setStep('email')
    setCode('')
    setError(null)
    setNotice(null)
  }

  return (
    <div className="login-screen">
      <div className="login-screen__theme">
        <ThemeToggle />
      </div>
      <div className="brand-ring" />
      <h1>Family HUD</h1>
      <p>
        Il quartier generale digitale della tua famiglia: pasti, obiettivi, allenamenti, casa e calendario in un
        unico posto.
      </p>

      <div className="login-card">
        {step === 'email' ? (
          <form onSubmit={requestCode} className="login-form">
            <p className="login-hint">Inserisci la tua email: ti mando un codice per entrare.</p>
            <input
              className="hud-input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
            <button className="hud-button" type="submit" disabled={pending}>
              {pending ? 'Invio...' : 'Inviami il codice'}
            </button>
            {error && <p className="login-error">{error}</p>}
          </form>
        ) : (
          <form onSubmit={submitCode} className="login-form">
            {notice && <p className="login-hint">{notice}</p>}
            <input
              className="hud-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Codice a 6 cifre"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
              required
            />
            <input
              className="hud-input"
              type="text"
              placeholder="Come ti chiami (solo al primo accesso)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
            <button className="hud-button" type="submit" disabled={pending}>
              {pending ? 'Verifico...' : 'Entra'}
            </button>
            {error && <p className="login-error">{error}</p>}
            <button type="button" className="login-tab" onClick={backToEmail}>
              Cambia email
            </button>
          </form>
        )}

        {step === 'email' && <SocialButtons />}
      </div>
    </div>
  )
}

export default LoginScreen
