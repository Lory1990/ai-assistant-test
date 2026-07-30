import { useState } from 'react'
import { useRecentWorkouts, useWorkoutRecap, useLogWorkout } from '../queries'

function LogWorkoutPanel() {
  const [text, setText] = useState('')
  const logWorkout = useLogWorkout()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    logWorkout.mutate(text.trim(), { onSuccess: () => setText('') })
  }

  return (
    <div className="hud-panel">
      <h3>Registra allenamento</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Un esercizio per volta, es. "panca piana 4x8 60kg" o "corsa 30 minuti".
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8 }}>
        <input
          className="hud-input"
          placeholder="Esercizio..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={logWorkout.isPending}
        />
        <button className="hud-button" type="submit" disabled={logWorkout.isPending}>
          {logWorkout.isPending ? 'Salvo...' : 'Registra'}
        </button>
      </form>
      {logWorkout.isError && <p className="empty">{(logWorkout.error as Error).message}</p>}
      {logWorkout.data && <p className="link-hint">{logWorkout.data.message}</p>}
    </div>
  )
}

function RecentWorkoutsPanel() {
  const { data: sessions, isLoading, error } = useRecentWorkouts()
  const recap = useWorkoutRecap()

  return (
    <div className="hud-panel">
      <h3>Allenamenti recenti (7gg)</h3>
      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && sessions && sessions.length === 0 && <p className="empty">Nessun allenamento negli ultimi 7 giorni.</p>}
      {sessions && sessions.length > 0 && (
        <ul>
          {sessions.map((s) => (
            <li key={s.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <span className="item-meta">
                {new Date(s.loggedAt).toLocaleDateString('it-IT')} · {s.memberName}
              </span>
              <span>{s.exercises.map((e) => e.name).join(', ')}</span>
            </li>
          ))}
        </ul>
      )}
      <button className="hud-button" style={{ marginTop: 12 }} disabled={recap.isPending} onClick={() => recap.mutate()}>
        {recap.isPending ? 'Genero...' : 'Genera recap ora'}
      </button>
      {recap.data && (
        <p className="link-hint" style={{ whiteSpace: 'pre-line', marginTop: 8 }}>
          {recap.data.recap}
        </p>
      )}
    </div>
  )
}

function FitnessSection() {
  return (
    <div className="panel-grid">
      <LogWorkoutPanel />
      <RecentWorkoutsPanel />
    </div>
  )
}

export default FitnessSection
