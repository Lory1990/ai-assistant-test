import { useState } from 'react'
import { useTeamSummary, useCreateGoal } from '../queries'
import type { GoalSummary } from '../api/client'

function GoalList({ title, goals, showCreator }: { title: string; goals: GoalSummary[]; showCreator: boolean }) {
  return (
    <div className="hud-panel">
      <h3>{title}</h3>
      {goals.length > 0 ? (
        <ul>
          {goals.map((g) => (
            <li key={g.id} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <span>
                {g.important ? '⭐ ' : ''}
                {g.title}
                {g.description ? ` — ${g.description}` : ''}
              </span>
              <span className="item-meta">
                [{g.category}] priorità: {g.priority}
                {g.dueDate ? ` · scade ${new Date(g.dueDate).toLocaleDateString('it-IT')}` : ''}
                {showCreator ? ` · ${g.createdBy}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nessun obiettivo attivo.</p>
      )}
    </div>
  )
}

function CreateGoalPanel() {
  const createGoal = useCreateGoal()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'general' | 'gym'>('general')
  const [scope, setScope] = useState<'team' | 'personal'>('team')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [important, setImportant] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    createGoal.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        scope,
        dueDate: dueDate || undefined,
        priority,
        important,
      },
      {
        onSuccess: () => {
          setTitle('')
          setDescription('')
          setDueDate('')
          setImportant(false)
        },
      },
    )
  }

  return (
    <div className="hud-panel">
      <h3>Nuovo obiettivo</h3>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input className="hud-input" placeholder="Titolo" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input
          className="hud-input"
          placeholder="Descrizione (opz.)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="hud-input" value={scope} onChange={(e) => setScope(e.target.value as 'team' | 'personal')}>
            <option value="team">Team</option>
            <option value="personal">Personale</option>
          </select>
          <select className="hud-input" value={category} onChange={(e) => setCategory(e.target.value as 'general' | 'gym')}>
            <option value="general">Generale</option>
            <option value="gym">Palestra</option>
          </select>
          <select className="hud-input" value={priority} onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}>
            <option value="low">Priorità bassa</option>
            <option value="medium">Priorità media</option>
            <option value="high">Priorità alta</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="hud-input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ flex: 'none' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} />
            Importante
          </label>
          <button className="hud-button" type="submit" disabled={createGoal.isPending}>
            {createGoal.isPending ? 'Salvo...' : 'Aggiungi'}
          </button>
        </div>
        {createGoal.isError && <p className="empty">{(createGoal.error as Error).message}</p>}
      </form>
    </div>
  )
}

function GoalsSection() {
  const { data: summary } = useTeamSummary()

  return (
    <div className="panel-grid">
      <GoalList title="Obiettivi del team" goals={summary?.teamGoals ?? []} showCreator />
      <GoalList
        title="Obiettivi personali"
        goals={(summary?.personalGoals ?? []).map((g) => ({ ...g, createdBy: null }))}
        showCreator={false}
      />
      <CreateGoalPanel />
    </div>
  )
}

export default GoalsSection
