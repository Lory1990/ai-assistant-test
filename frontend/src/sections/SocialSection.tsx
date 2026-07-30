import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useSocialAccounts,
  useRequestMetaConnectUrl,
  useDisconnectSocialAccount,
  useSocialPosts,
  useScheduleSocialPost,
  useCancelSocialPost,
  useUploadSocialMedia,
} from '../queries'
import type { SocialAccount, SocialPost } from '../api/client'

const PROVIDER_LABEL: Record<SocialAccount['provider'], string> = {
  facebook_page: 'Facebook',
  instagram: 'Instagram',
}

const STATUS_LABEL: Record<SocialPost['status'], string> = {
  pending: 'in attesa',
  published: 'pubblicato',
  failed: 'errore',
  canceled: 'annullato',
}

function ConnectedAccountsPanel() {
  const { data: accounts, isLoading, error } = useSocialAccounts()
  const connect = useRequestMetaConnectUrl()
  const disconnect = useDisconnectSocialAccount()
  const [searchParams, setSearchParams] = useSearchParams()
  const metaParam = searchParams.get('meta')

  useEffect(() => {
    if (metaParam) {
      const next = new URLSearchParams(searchParams)
      next.delete('meta')
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
      <h3>Account collegati</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Un solo login Meta collega le Pagine Facebook e gli account Instagram Business associati.
      </p>
      {metaParam === 'connected' && <p className="link-hint">✅ Account Meta collegati.</p>}
      {metaParam === 'error' && (
        <p className="empty">Collegamento fallito: {searchParams.get('reason') ?? 'errore sconosciuto'}</p>
      )}

      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && accounts && accounts.length === 0 && <p className="empty">Nessun account collegato.</p>}

      {accounts?.map((account) => (
        <div key={account.id} className="device-row">
          <span>
            {PROVIDER_LABEL[account.provider]} — {account.name}
          </span>
          <button className="logout" onClick={() => disconnect.mutate(account.id)} disabled={disconnect.isPending}>
            scollega
          </button>
        </div>
      ))}

      <button className="hud-button" style={{ marginTop: 12 }} onClick={startConnect} disabled={connect.isPending}>
        {connect.isPending ? 'Attendi...' : 'Collega Facebook / Instagram'}
      </button>
      {connect.isError && <p className="empty">{(connect.error as Error).message}</p>}
    </div>
  )
}

function SchedulePostPanel() {
  const { data: accounts } = useSocialAccounts()
  const upload = useUploadSocialMedia()
  const schedule = useScheduleSocialPost()
  const [socialAccountId, setSocialAccountId] = useState('')
  const [content, setContent] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const selected = accounts?.find((a) => a.id === socialAccountId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!socialAccountId || !content.trim() || !scheduledAt) return
    const mediaPath = file ? (await upload.mutateAsync(file)).mediaPath : undefined
    schedule.mutate(
      { socialAccountId, content: content.trim(), scheduledAt: new Date(scheduledAt).toISOString(), mediaPath },
      {
        onSuccess: () => {
          setContent('')
          setScheduledAt('')
          setFile(null)
        },
      },
    )
  }

  return (
    <div className="hud-panel">
      <h3>Programma un post</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select className="hud-input" value={socialAccountId} onChange={(e) => setSocialAccountId(e.target.value)}>
          <option value="">Scegli un account...</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {PROVIDER_LABEL[a.provider]} — {a.name}
            </option>
          ))}
        </select>
        <textarea
          className="hud-input"
          placeholder="Testo del post..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <input
          className="hud-input"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {selected?.provider === 'instagram' && !file && (
          <p className="link-hint">Instagram richiede sempre un'immagine.</p>
        )}
        <input
          className="hud-input"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
        />
        <button className="hud-button" type="submit" disabled={upload.isPending || schedule.isPending}>
          {upload.isPending ? 'Carico immagine...' : schedule.isPending ? 'Programmo...' : 'Programma'}
        </button>
        {upload.isError && <p className="empty">{(upload.error as Error).message}</p>}
        {schedule.isError && <p className="empty">{(schedule.error as Error).message}</p>}
      </form>
      <p className="link-hint" style={{ marginTop: 12 }}>
        La pubblicazione parte da un job che controlla i post in scadenza ogni 5 minuti.
      </p>
    </div>
  )
}

function ScheduledPostsPanel() {
  const { data: posts, isLoading, error } = useSocialPosts()
  const cancel = useCancelSocialPost()

  return (
    <div className="hud-panel" style={{ gridColumn: '1 / -1' }}>
      <h3>Post programmati</h3>
      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && posts && posts.length === 0 && <p className="empty">Nessun post programmato.</p>}
      {posts?.map((post) => (
        <div key={post.id} className="device-row" style={{ alignItems: 'flex-start' }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong>
              {PROVIDER_LABEL[post.socialAccount.provider]} — {post.socialAccount.name}
            </strong>
            <span>{post.content}</span>
            <span className="link-hint">
              {new Date(post.scheduledAt).toLocaleString('it-IT')} · {STATUS_LABEL[post.status]}
            </span>
            {post.error && <span className="empty">{post.error}</span>}
          </span>
          {post.status === 'pending' && (
            <button className="logout" onClick={() => cancel.mutate(post.id)} disabled={cancel.isPending}>
              annulla
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function SocialSection() {
  return (
    <div className="panel-grid">
      <ConnectedAccountsPanel />
      <SchedulePostPanel />
      <ScheduledPostsPanel />
    </div>
  )
}

export default SocialSection
