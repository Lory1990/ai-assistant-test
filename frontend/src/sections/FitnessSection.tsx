import { useState } from 'react'
import {
  useRecentWorkouts,
  useWorkoutRecap,
  useLogWorkout,
  useTrainingPlans,
  useTrainingToday,
  useSaveTrainingPlan,
  useDeleteTrainingPlan,
} from '../queries'
import type { TrainingPlan, TrainingPlanInput } from '../api/client'
import { PlanWindowFields, formatValidity, isActive, toDateInput, type PlanWindowValue } from '../components/planFields'

// I campi numerici restano stringhe finché si scrive: un <input type="number">
// controllato da un number non lascia svuotare la casella né digitare "6." .
interface ExerciseDraft {
  name: string
  sets: string
  reps: string
  weightKg: string
}

interface DayDraft {
  name: string
  exercises: ExerciseDraft[]
}

const EMPTY_EXERCISE: ExerciseDraft = { name: '', sets: '', reps: '', weightKg: '' }

function emptyWindow(): PlanWindowValue {
  return { name: '', notes: '', validFrom: toDateInput(new Date().toISOString()), validTo: '' }
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? null : n
}

function draftFromPlan(plan: TrainingPlan): { window: PlanWindowValue; days: DayDraft[] } {
  return {
    window: {
      name: plan.name,
      notes: plan.notes ?? '',
      validFrom: toDateInput(plan.validFrom),
      validTo: toDateInput(plan.validTo),
    },
    days: plan.days.map((d) => ({
      name: d.name,
      exercises: d.exercises.map((e) => ({
        name: e.name,
        sets: e.sets?.toString() ?? '',
        reps: e.reps ?? '',
        weightKg: e.weightKg?.toString() ?? '',
      })),
    })),
  }
}

function TrainingPlanEditor({ plan, onClose }: { plan: TrainingPlan | null; onClose: () => void }) {
  const initial = plan ? draftFromPlan(plan) : { window: emptyWindow(), days: [] as DayDraft[] }
  const [window, setWindow] = useState<PlanWindowValue>(initial.window)
  const [days, setDays] = useState<DayDraft[]>(initial.days)
  const save = useSaveTrainingPlan()

  function updateDay(index: number, next: Partial<DayDraft>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...next } : d)))
  }

  function updateExercise(dayIndex: number, exIndex: number, next: Partial<ExerciseDraft>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, exercises: d.exercises.map((e, j) => (j === exIndex ? { ...e, ...next } : e)) } : d,
      ),
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!window.name.trim() || !window.validFrom) return

    const input: TrainingPlanInput = {
      name: window.name.trim(),
      notes: window.notes.trim() || null,
      validFrom: window.validFrom,
      validTo: window.validTo || null,
      // Righe lasciate vuote scartate qui: aggiungere una riga e non
      // compilarla è il modo normale di cambiare idea, non un errore da
      // segnalare.
      days: days
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          exercises: d.exercises
            .filter((ex) => ex.name.trim())
            .map((ex) => ({
              name: ex.name.trim(),
              sets: toNumber(ex.sets),
              reps: ex.reps.trim() || null,
              weightKg: toNumber(ex.weightKg),
            })),
        })),
    }

    save.mutate({ id: plan?.id, input }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PlanWindowFields value={window} onChange={setWindow} namePlaceholder="Nome scheda, es. Massa 4 giorni" />

      {days.map((day, dayIndex) => (
        <div key={dayIndex} style={{ borderTop: '1px solid var(--hud-border, #2a3a4a)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="item-meta" style={{ minWidth: 64 }}>
              Giorno {dayIndex + 1}
            </span>
            <input
              className="hud-input"
              placeholder="es. Petto e tricipiti"
              value={day.name}
              onChange={(e) => updateDay(dayIndex, { name: e.target.value })}
            />
            <button
              type="button"
              className="hud-button hud-button--ghost"
              onClick={() => setDays((prev) => prev.filter((_, i) => i !== dayIndex))}
            >
              ✕
            </button>
          </div>

          {day.exercises.map((ex, exIndex) => (
            <div key={exIndex} style={{ display: 'flex', gap: 6, marginTop: 6, paddingLeft: 72 }}>
              <input
                className="hud-input"
                placeholder="Esercizio"
                value={ex.name}
                onChange={(e) => updateExercise(dayIndex, exIndex, { name: e.target.value })}
              />
              <input
                className="hud-input"
                style={{ width: 70 }}
                placeholder="serie"
                value={ex.sets}
                onChange={(e) => updateExercise(dayIndex, exIndex, { sets: e.target.value })}
              />
              <input
                className="hud-input"
                style={{ width: 90 }}
                placeholder="rip. 8-10"
                value={ex.reps}
                onChange={(e) => updateExercise(dayIndex, exIndex, { reps: e.target.value })}
              />
              <input
                className="hud-input"
                style={{ width: 70 }}
                placeholder="kg"
                value={ex.weightKg}
                onChange={(e) => updateExercise(dayIndex, exIndex, { weightKg: e.target.value })}
              />
              <button
                type="button"
                className="hud-button hud-button--ghost"
                onClick={() =>
                  updateDay(dayIndex, { exercises: day.exercises.filter((_, j) => j !== exIndex) })
                }
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="hud-button hud-button--ghost"
            style={{ marginTop: 6, marginLeft: 72 }}
            onClick={() => updateDay(dayIndex, { exercises: [...day.exercises, { ...EMPTY_EXERCISE }] })}
          >
            + esercizio
          </button>
        </div>
      ))}

      <button
        type="button"
        className="hud-button hud-button--ghost"
        onClick={() => setDays((prev) => [...prev, { name: '', exercises: [{ ...EMPTY_EXERCISE }] }])}
      >
        + giorno
      </button>

      {save.isError && <p className="empty">{(save.error as Error).message}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="hud-button" type="submit" disabled={save.isPending}>
          {save.isPending ? 'Salvo...' : 'Salva scheda'}
        </button>
        <button type="button" className="hud-button hud-button--ghost" onClick={onClose}>
          Annulla
        </button>
      </div>
    </form>
  )
}

function TodayPlanPanel() {
  const { data: today, isLoading } = useTrainingToday()

  return (
    <div className="hud-panel">
      <h3>Oggi in palestra</h3>
      {isLoading && <p className="empty">Caricamento...</p>}
      {!isLoading && !today && <p className="empty">Nessuna scheda attiva per oggi.</p>}
      {today && (
        <>
          <p className="item-meta">
            {today.plan.name} · giorno {today.day.order} di {today.plan.days.length}
            {today.started ? ' · in corso' : ''}
          </p>
          <h4 style={{ margin: '8px 0' }}>{today.day.name}</h4>
          <ul>
            {today.day.exercises.map((ex, i) => (
              <li key={i}>
                <span>{ex.name}</span>
                <span className="item-meta">
                  {[ex.sets ? `${ex.sets} serie` : null, ex.reps ? `${ex.reps} rip.` : null, ex.weightKg ? `${ex.weightKg} kg` : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </li>
            ))}
          </ul>
          {today.day.notes && <p className="link-hint">{today.day.notes}</p>}
          {!today.started && (
            <p className="link-hint">
              Registrando il primo esercizio la rotazione avanza: domani toccherà il giorno successivo.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function TrainingPlansPanel() {
  const { data: plans, isLoading, error } = useTrainingPlans()
  const remove = useDeleteTrainingPlan()
  // null = editor chiuso; 'new' = nuova scheda; altrimenti la scheda in modifica.
  const [editing, setEditing] = useState<'new' | TrainingPlan | null>(null)

  return (
    <div className="hud-panel">
      <h3>Le mie schede</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Personali: il team vede gli allenamenti registrati, non la scheda. Una sola attiva per volta.
      </p>

      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {plans && plans.length === 0 && !editing && <p className="empty">Nessuna scheda.</p>}

      {plans && plans.length > 0 && (
        <ul>
          {plans.map((plan) => (
            <li key={plan.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span>
                {isActive(plan) ? '🟢 ' : ''}
                {plan.name}
              </span>
              <span className="item-meta">
                {formatValidity(plan)} · {plan.days.length} giorni
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button className="hud-button hud-button--ghost" onClick={() => setEditing(plan)}>
                  Modifica
                </button>
                <button
                  className="hud-button hud-button--ghost"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(plan.id)}
                >
                  Elimina
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <div style={{ marginTop: 12 }}>
          <TrainingPlanEditor
            // Rimontare l'editor quando cambia scheda: lo stato del form parte
            // dalla scheda scelta, non da quella di prima.
            key={editing === 'new' ? 'new' : editing.id}
            plan={editing === 'new' ? null : editing}
            onClose={() => setEditing(null)}
          />
        </div>
      ) : (
        <button className="hud-button" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
          Nuova scheda
        </button>
      )}
    </div>
  )
}

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
      <TodayPlanPanel />
      <LogWorkoutPanel />
      <TrainingPlansPanel />
      <RecentWorkoutsPanel />
    </div>
  )
}

export default FitnessSection
