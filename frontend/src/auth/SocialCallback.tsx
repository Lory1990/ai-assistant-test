import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { completeSocialLogin } from './authStore'
import { SectionLoader } from '../components/SectionLoader'

/**
 * Atterraggio dopo il login social: il backend ha già scambiato il code e ha
 * parcheggiato i token dietro un handoff monouso, qui li ritiriamo e torniamo
 * sulla dashboard.
 */
function SocialCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  // In StrictMode l'effect gira due volte: l'handoff è monouso, il secondo
  // tentativo fallirebbe dopo che il primo è già andato a buon fine.
  const redeemed = useRef(false)

  useEffect(() => {
    if (redeemed.current) return
    redeemed.current = true

    const failure = searchParams.get('error')
    if (failure) {
      setError(failure)
      return
    }

    const handoff = searchParams.get('handoff')
    if (!handoff) {
      setError('Risposta di login incompleta.')
      return
    }

    completeSocialLogin(handoff)
      .then(() => navigate('/chat', { replace: true }))
      .catch((err: Error) => setError(err.message))
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="login-screen">
        <h1>Login non riuscito</h1>
        <p className="login-error">{error}</p>
        <button className="hud-button" onClick={() => navigate('/', { replace: true })}>
          Torna al login
        </button>
      </div>
    )
  }

  return <SectionLoader />
}

export default SocialCallback
