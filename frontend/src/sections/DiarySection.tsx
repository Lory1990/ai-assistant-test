import { useState } from 'react'
import { useDiaryEntries, useAddDiaryEntry, useRemoveDiaryEntry } from '../queries'

const MOODS = ['😊', '😐', '😔', '😡', '😴']

function DiarySection() {
  const { data: entries, isLoading, error } = useDiaryEntries()
  const addEntry = useAddDiaryEntry()
  const removeEntry = useRemoveDiaryEntry()
  const [content, setContent] = useState('')
  const [mood, setMood] = useState<string | undefined>(undefined)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    addEntry.mutate(
      { content: content.trim(), mood },
      {
        onSuccess: () => {
          setContent('')
          setMood(undefined)
        },
      },
    )
  }

  return (
    <div className="panel-grid">
      <div className="hud-panel" style={{ maxWidth: 720, width: '100%' }}>
        <h3>Diario personale</h3>
        <p className="link-hint" style={{ marginBottom: 12 }}>
          Solo tuo: non visibile al team, non passa mai dall'assistente AI.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="hud-input"
            placeholder="Cosa vuoi annotare oggi?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                className="hud-button"
                style={{ padding: '8px 12px', opacity: mood === m ? 1 : 0.5 }}
                onClick={() => setMood(mood === m ? undefined : m)}
              >
                {m}
              </button>
            ))}
            <button className="hud-button" type="submit" disabled={addEntry.isPending} style={{ marginLeft: 'auto' }}>
              {addEntry.isPending ? 'Salvo...' : 'Annota'}
            </button>
          </div>
          {addEntry.isError && <p className="empty">{(addEntry.error as Error).message}</p>}
        </form>

        <div className="chat-log" style={{ marginTop: 20 }}>
          {error && <p className="empty">{(error as Error).message}</p>}
          {!error && isLoading && <p className="empty">Caricamento...</p>}
          {!error && entries && entries.length === 0 && <p className="empty">Nessuna voce ancora.</p>}
          {entries?.map((entry) => (
            <div key={entry.id} className="chat-message chat-message--assistant">
              <span className="chat-message__role">
                {new Date(entry.createdAt).toLocaleString('it-IT')} {entry.mood ?? ''}
              </span>
              <span className="chat-message__content" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span>{entry.content}</span>
                <button
                  className="logout"
                  onClick={() => removeEntry.mutate(entry.id)}
                  style={{ flexShrink: 0 }}
                >
                  elimina
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DiarySection
