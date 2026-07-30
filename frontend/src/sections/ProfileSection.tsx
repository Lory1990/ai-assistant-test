import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { logout } from '../auth/authStore'
import {
  useMe,
  useRequestLinkCode,
  useLinkTelegram,
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

function TelegramLinkPanel({ telegramLinked }: { telegramLinked: boolean }) {
  const requestCode = useRequestLinkCode()
  const linkTelegram = useLinkTelegram()
  const [redeemCode, setRedeemCode] = useState('')

  async function redeem(e: React.FormEvent) {
    e.preventDefault()
    if (!redeemCode.trim()) return
    linkTelegram.mutate(redeemCode.trim(), { onSuccess: () => setRedeemCode('') })
  }

  return (
    <div className="hud-panel">
      <h3>Collega Telegram</h3>
      {telegramLinked && <p className="link-hint">✅ Bot Telegram già collegato a questo account.</p>}

      <p className="link-hint" style={{ marginTop: 12 }}>
        Hai già scritto al bot? Al primo messaggio ti mostra un codice: incollalo qui.
      </p>
      <form onSubmit={redeem} style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          className="hud-input"
          placeholder="Codice dal bot"
          value={redeemCode}
          onChange={(e) => setRedeemCode(e.target.value)}
        />
        <button className="hud-button" type="submit" disabled={linkTelegram.isPending}>
          {linkTelegram.isPending ? 'Collego...' : 'Collega'}
        </button>
      </form>
      {linkTelegram.isError && <p className="empty">{(linkTelegram.error as Error).message}</p>}
      {linkTelegram.isSuccess && <p className="link-hint">Collegato con successo.</p>}

      <p className="link-hint" style={{ marginTop: 16 }}>
        Oppure genera qui un codice da incollare tu nel bot con /collega:
      </p>
      {requestCode.data ? (
        <>
          <div className="link-code">{requestCode.data.code}</div>
          <p className="link-hint">
            Nel bot invia <code>/collega {requestCode.data.code}</code>. Valido fino alle{' '}
            {new Date(requestCode.data.expiresAt).toLocaleTimeString('it-IT')}.
          </p>
        </>
      ) : (
        <button className="hud-button" onClick={() => requestCode.mutate()} disabled={requestCode.isPending}>
          Genera codice
        </button>
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

      <TelegramLinkPanel telegramLinked={me.telegramLinked} />
      <GoogleAccountPanel />
    </div>
  )
}

export default ProfileSection
