import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { logout } from '../auth/authStore'
import {
  useMe,
  useMemory,
  useAddMemoryFact,
  useRemoveMemoryFact,
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


/**
 * Cosa l'assistente sa di te. Personale: nessun altro del team lo vede, e da
 * qui si può correggere o cancellare quello che ha imparato da solo.
 */
function MemoryPanel() {
  const { data: facts, isLoading, error } = useMemory()
  const addFact = useAddMemoryFact()
  const removeFact = useRemoveMemoryFact()
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addFact.mutate(
      { content: content.trim(), category: category.trim() || undefined },
      {
        onSuccess: () => {
          setContent('')
          setCategory('')
        },
      },
    )
  }

  return (
    <div className="hud-panel">
      <h3>Cosa l'assistente sa di te</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Preferenze e vincoli che valgono in tutte le conversazioni. Solo tuoi: il team non li vede.
      </p>

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          className="hud-input"
          placeholder='es. "Sono vegetariano", "Mi alleno il lunedì e il giovedì"'
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="hud-input"
            placeholder="Ambito (facoltativo): alimentazione, salute..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <button className="hud-button" type="submit" disabled={addFact.isPending}>
            {addFact.isPending ? 'Salvo...' : 'Ricorda'}
          </button>
        </div>
        {addFact.isError && <p className="empty">{(addFact.error as Error).message}</p>}
      </form>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {error && <p className="empty">{(error as Error).message}</p>}
        {!error && isLoading && <p className="empty">Caricamento...</p>}
        {!error && facts && facts.length === 0 && (
          <p className="empty">Non sa ancora nulla di te. Diglielo in chat, o scrivilo qui sopra.</p>
        )}
        {facts?.map((fact) => (
          <div key={fact.id} className="device-row">
            <span>
              {fact.category && <span className="item-meta">[{fact.category}] </span>}
              {fact.content}
              {fact.source === 'assistant' && <span className="item-meta"> · imparato in chat</span>}
            </span>
            <button className="logout" onClick={() => removeFact.mutate(fact.id)} disabled={removeFact.isPending}>
              dimentica
            </button>
          </div>
        ))}
      </div>
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

      <MemoryPanel />
      <TelegramLinkPanel telegramLinked={me.telegramLinked} email={me.email} />
      <GoogleAccountPanel />
    </div>
  )
}

export default ProfileSection
