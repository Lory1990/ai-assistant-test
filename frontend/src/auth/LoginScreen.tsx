import { useEffect, useState } from 'react'
import { ThemeToggle } from '../components/ThemeToggle'
import {
  loginWithPassword,
  register,
  requestPasswordReset,
  fetchSocialProviders,
  startSocialLogin,
  OtpRequiredError,
  type SocialProvider,
} from './authStore'

type Mode = 'login' | 'register' | 'forgot'

const MODE_LABEL: Record<Mode, string> = {
  login: 'Accedi',
  register: 'Registrati',
  forgot: 'Recupera',
}

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

function LoginScreen() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [totp, setTotp] = useState('')
  // Il campo codice compare solo dopo che il backend segnala che serve: Keycloak
  // non permette di saperlo prima del tentativo.
  const [otpRequired, setOtpRequired] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setOtpRequired(false)
    setTotp('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setPending(true)
    try {
      if (mode === 'login') {
        // Al successo l'authStore notifica App, che monta la dashboard:
        // non serve fare nulla qui.
        await loginWithPassword(email.trim(), password, totp.trim() || undefined)
      } else if (mode === 'register') {
        await register(email.trim(), password, displayName.trim() || undefined)
      } else {
        await requestPasswordReset(email.trim())
        setNotice('Se esiste un account con questa email, riceverai le istruzioni per reimpostare la password.')
      }
    } catch (err) {
      // Email e password restano compilate: si aggiunge solo il codice.
      if (err instanceof OtpRequiredError) setOtpRequired(true)
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
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
        <div className="login-tabs">
          {(['login', 'register', 'forgot'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`login-tab ${mode === m ? 'is-active' : ''}`}
              onClick={() => switchMode(m)}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="login-form">
          {mode === 'register' && (
            <input
              className="hud-input"
              type="text"
              placeholder="Come ti chiami"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className="hud-input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          {mode !== 'forgot' && (
            <input
              className="hud-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
            />
          )}
          {mode === 'login' && otpRequired && (
            <input
              className="hud-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Codice di verifica"
              value={totp}
              onChange={(e) => setTotp(e.target.value)}
              autoFocus
              required
            />
          )}
          <button className="hud-button" type="submit" disabled={pending}>
            {pending ? 'Attendi...' : MODE_LABEL[mode]}
          </button>
          {error && <p className="login-error">{error}</p>}
          {notice && <p className="login-hint">{notice}</p>}
        </form>

        {mode === 'login' && <SocialButtons />}
      </div>
    </div>
  )
}

export default LoginScreen
