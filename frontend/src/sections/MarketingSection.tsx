import { useState } from 'react'
import {
  useMarketingPlans,
  useCreateMarketingPlan,
  useDeleteMarketingPlan,
  useSetMarketingItemStatus,
  useScheduleMarketingItem,
  useSocialAccounts,
  useUploadSocialMedia,
} from '../queries'
import type { MarketingPlan, MarketingPlanItem } from '../api/client'

const CHANNELS = ['instagram', 'facebook', 'newsletter', 'blog', 'linkedin']

const STATUS_LABEL: Record<MarketingPlanItem['status'], string> = {
  idea: 'bozza',
  approved: 'approvato',
  discarded: 'scartato',
}

/** Un input date dà "YYYY-MM-DD": lo mandiamo come istante locale, non come mezzanotte UTC. */
function localIso(day: string, boundary: 'start' | 'end'): string {
  return new Date(`${day}T${boundary === 'start' ? '00:00:00' : '23:59:59'}`).toISOString()
}

function todayPlusDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function BriefPanel() {
  const createPlan = useCreateMarketingPlan()
  const [brief, setBrief] = useState('')
  const [name, setName] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('')
  const [objective, setObjective] = useState('')
  const [channels, setChannels] = useState<string[]>(['instagram'])
  const [periodStart, setPeriodStart] = useState(todayPlusDays(0))
  const [periodEnd, setPeriodEnd] = useState(todayPlusDays(28))
  const [itemsPerWeek, setItemsPerWeek] = useState(3)

  function toggleChannel(channel: string) {
    setChannels((current) =>
      current.includes(channel) ? current.filter((c) => c !== channel) : [...current, channel],
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!brief.trim() || channels.length === 0) return
    createPlan.mutate(
      {
        name: name.trim() || undefined,
        brief: brief.trim(),
        audience: audience.trim() || undefined,
        tone: tone.trim() || undefined,
        objective: objective.trim() || undefined,
        channels,
        periodStart: localIso(periodStart, 'start'),
        periodEnd: localIso(periodEnd, 'end'),
        itemsPerWeek,
      },
      { onSuccess: () => setBrief('') },
    )
  }

  return (
    <div className="hud-panel">
      <h3>Nuovo piano editoriale</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Solo tuo: il marketing non è condiviso col team. L'AI scrive le bozze, pubblicare resta una tua scelta.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          className="hud-input"
          placeholder="Cosa vuoi promuovere? es. il lancio del corso di pilates di settembre"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
        <input className="hud-input" placeholder="Nome del piano (opzionale)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="hud-input" placeholder="A chi parli? es. donne 30-50 anni a Milano" value={audience} onChange={(e) => setAudience(e.target.value)} />
        <input className="hud-input" placeholder="Tono di voce, es. diretto e informale" value={tone} onChange={(e) => setTone(e.target.value)} />
        <input className="hud-input" placeholder="Obiettivo, es. prenotazioni della lezione di prova" value={objective} onChange={(e) => setObjective(e.target.value)} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              className="hud-button"
              style={{ padding: '8px 12px', opacity: channels.includes(channel) ? 1 : 0.45 }}
              onClick={() => toggleChannel(channel)}
            >
              {channel}
            </button>
          ))}
        </div>

        <label className="link-hint">
          Dal
          <input className="hud-input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={{ marginLeft: 8 }} />
        </label>
        <label className="link-hint">
          Al
          <input className="hud-input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={{ marginLeft: 8 }} />
        </label>
        <label className="link-hint">
          Contenuti a settimana
          <input
            className="hud-input"
            type="number"
            min={1}
            max={14}
            value={itemsPerWeek}
            onChange={(e) => setItemsPerWeek(Number(e.target.value))}
            style={{ marginLeft: 8, width: 80 }}
          />
        </label>

        <button className="hud-button" type="submit" disabled={createPlan.isPending || channels.length === 0}>
          {createPlan.isPending ? 'L’AI sta scrivendo il piano...' : 'Genera il piano'}
        </button>
        {channels.length === 0 && <p className="empty">Scegli almeno un canale.</p>}
        {createPlan.isError && <p className="empty">{(createPlan.error as Error).message}</p>}
      </form>
    </div>
  )
}

function ScheduleForm({ item, onDone }: { item: MarketingPlanItem; onDone: () => void }) {
  const { data: accounts } = useSocialAccounts()
  const upload = useUploadSocialMedia()
  const schedule = useScheduleMarketingItem()
  const [socialAccountId, setSocialAccountId] = useState('')
  // L'input datetime-local vuole l'ora locale senza fuso: la data del piano è
  // già l'istante giusto, va solo riscritta in quel formato.
  const [scheduledAt, setScheduledAt] = useState(() => {
    const date = new Date(item.scheduledFor)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  })
  const [file, setFile] = useState<File | null>(null)

  const selected = accounts?.find((a) => a.id === socialAccountId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!socialAccountId) return
    const mediaPath = file ? (await upload.mutateAsync(file)).mediaPath : undefined
    schedule.mutate(
      { id: item.id, socialAccountId, scheduledAt: new Date(scheduledAt).toISOString(), mediaPath },
      { onSuccess: onDone },
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
      <select className="hud-input" value={socialAccountId} onChange={(e) => setSocialAccountId(e.target.value)}>
        <option value="">Scegli un account...</option>
        {accounts?.map((account) => (
          <option key={account.id} value={account.id}>
            {account.provider === 'instagram' ? 'Instagram' : 'Facebook'} — {account.name}
          </option>
        ))}
      </select>
      {accounts && accounts.length === 0 && (
        <p className="link-hint">Nessun account collegato: collegane uno dalla sezione Social.</p>
      )}
      <input className="hud-input" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      <input className="hud-input" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      {selected?.provider === 'instagram' && !file && <p className="link-hint">Instagram richiede sempre un'immagine.</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="hud-button" type="submit" disabled={upload.isPending || schedule.isPending || !socialAccountId}>
          {upload.isPending ? 'Carico immagine...' : schedule.isPending ? 'Programmo...' : 'Programma il post'}
        </button>
        <button className="logout" type="button" onClick={onDone}>
          annulla
        </button>
      </div>
      {upload.isError && <p className="empty">{(upload.error as Error).message}</p>}
      {schedule.isError && <p className="empty">{(schedule.error as Error).message}</p>}
    </form>
  )
}

function ItemRow({ item }: { item: MarketingPlanItem }) {
  const setStatus = useSetMarketingItemStatus()
  const [scheduling, setScheduling] = useState(false)

  return (
    <div className="device-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <span className="link-hint">
        {new Date(item.scheduledFor).toLocaleString('it-IT')} · {item.channel} / {item.format} · {STATUS_LABEL[item.status]}
        {item.socialPostId && ' · post programmato'}
      </span>
      <strong>{item.title}</strong>
      <span style={{ whiteSpace: 'pre-wrap', opacity: item.status === 'discarded' ? 0.5 : 1 }}>{item.copy}</span>
      {item.hashtags.length > 0 && <span className="link-hint">{item.hashtags.map((h) => `#${h}`).join(' ')}</span>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {item.status !== 'approved' && (
          <button
            className="hud-button"
            style={{ padding: '6px 10px' }}
            onClick={() => setStatus.mutate({ id: item.id, status: 'approved' })}
            disabled={setStatus.isPending}
          >
            approva
          </button>
        )}
        {item.status !== 'discarded' && (
          <button className="logout" onClick={() => setStatus.mutate({ id: item.id, status: 'discarded' })} disabled={setStatus.isPending}>
            scarta
          </button>
        )}
        {!item.socialPostId && !scheduling && (
          <button className="hud-button" style={{ padding: '6px 10px' }} onClick={() => setScheduling(true)}>
            programma su social
          </button>
        )}
      </div>
      {setStatus.isError && <p className="empty">{(setStatus.error as Error).message}</p>}
      {scheduling && <ScheduleForm item={item} onDone={() => setScheduling(false)} />}
    </div>
  )
}

function PlanPanel({ plan }: { plan: MarketingPlan }) {
  const deletePlan = useDeleteMarketingPlan()

  return (
    <div className="hud-panel" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span>{plan.name}</span>
        <button className="logout" onClick={() => deletePlan.mutate(plan.id)} disabled={deletePlan.isPending}>
          elimina piano
        </button>
      </h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        {new Date(plan.periodStart).toLocaleDateString('it-IT')} – {new Date(plan.periodEnd).toLocaleDateString('it-IT')} ·{' '}
        {plan.channels.join(', ')} · {plan.items.length} contenuti
        {plan.objective && ` · obiettivo: ${plan.objective}`}
      </p>
      {plan.items.map((item) => (
        <ItemRow key={item.id} item={item} />
      ))}
      {deletePlan.isError && <p className="empty">{(deletePlan.error as Error).message}</p>}
    </div>
  )
}

function MarketingSection() {
  const { data: plans, isLoading, error } = useMarketingPlans()

  return (
    <div className="panel-grid">
      <BriefPanel />
      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && plans && plans.length === 0 && <p className="empty">Nessun piano editoriale ancora.</p>}
      {plans?.map((plan) => (
        <PlanPanel key={plan.id} plan={plan} />
      ))}
    </div>
  )
}

export default MarketingSection
