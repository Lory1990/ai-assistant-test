import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { logout } from '../auth/authStore'
import {
  useMe,
  useGoogleStatus,
  useRequestGoogleConnectUrl,
  useDisconnectGoogle,
} from '../queries'

function GoogleAccountPanel() {
  const { data: status } = useGoogleStatus()
  const connect = useRequestGoogleConnectUrl()
  const disconnect = useDisconnectGoogle()
  const [searchParams, setSearchParams] = useSearchParams()
  const googleParam = searchParams.get('google')

  useEffect(() => {
    if (googleParam) {
      const next = new URLSearchParams(searchParams)
      next.delete('google')
      next.delete('reason')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startConnect() {
    const res = await connect.mutateAsync()
    window.location.href = res.url
  }

  return (
    <div className="hud-panel">
      <h3>Google (Calendar + Gmail)</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Solo collegamento: lettura di calendario ed email non ancora implementata.
      </p>
      {googleParam === 'connected' && <p className="link-hint">✅ Account Google collegato.</p>}
      {googleParam === 'error' && <p className="empty">Collegamento fallito: {searchParams.get('reason') ?? 'errore sconosciuto'}</p>}

      {status?.connected ? (
        <>
          <p className="link-hint">✅ Collegato come {status.email}</p>
          <button className="hud-button" style={{ marginTop: 8 }} onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
            {disconnect.isPending ? 'Scollego...' : 'Scollega'}
          </button>
        </>
      ) : (
        <button className="hud-button" onClick={startConnect} disabled={connect.isPending}>
          {connect.isPending ? 'Attendi...' : 'Collega Google'}
        </button>
      )}
      {connect.isError && <p className="empty">{(connect.error as Error).message}</p>}
    </div>
  )
}

/**
 * Il collegamento non si fa più da qui: si scrive al bot, che chiede l'email e
 * manda un codice. Questo pannello resta per dire se la chat è collegata.
 */
function TelegramLinkPanel({ telegramLinked, email }: { telegramLinked: boolean; email: string | null }) {
  return (
    <div className="hud-panel">
      <h3>Telegram</h3>
      {telegramLinked ? (
        <p className="link-hint">✅ Bot Telegram collegato a questo account.</p>
      ) : (
        <p className="link-hint">
          Scrivi al bot su Telegram: ti chiederà la tua email ({email ?? 'quella di questo account'}) e ti manderà
          un codice di verifica. Inserito quello, la chat sarà collegata a questo stesso account.
        </p>
      )}
    </div>
  )
}

function ProfileSection() {
  const { data: me } = useMe()
  if (!me) return null

  return (
    <div className="panel-grid">
      <div className="hud-panel">
        <h3>Il tuo profilo</h3>
        <ul>
          <li>
            <span>Nome</span>
            <span className="item-meta">{me.displayName ?? '—'}</span>
          </li>
          <li>
            <span>Email</span>
            <span className="item-meta">{me.email ?? '—'}</span>
          </li>
          <li>
            <span>Team</span>
            <span className="item-meta">{me.team.name}</span>
          </li>
        </ul>
        <button className="hud-button" style={{ marginTop: 12 }} onClick={() => logout()}>
          Esci
        </button>
      </div>

      <TelegramLinkPanel telegramLinked={me.telegramLinked} email={me.email} />
      <GoogleAccountPanel />
    </div>
  )
}

export default ProfileSection
