import { useState } from 'react'
import {
  useTeamSummary,
  useNutritionPlans,
  useNutritionToday,
  useSaveNutritionPlan,
  useDeleteNutritionPlan,
  useApplyNutritionToday,
} from '../queries'
import type { NutritionPlan, NutritionPlanInput } from '../api/client'
import { PlanWindowFields, formatValidity, isActive, toDateInput, type PlanWindowValue } from '../components/planFields'

interface MealDraft {
  slot: string
  description: string
  grams: string
  calories: string
}

interface DayDraft {
  name: string
  meals: MealDraft[]
}

const EMPTY_MEAL: MealDraft = { slot: '', description: '', grams: '', calories: '' }

function emptyWindow(): PlanWindowValue {
  return { name: '', notes: '', validFrom: toDateInput(new Date().toISOString()), validTo: '' }
}

function toNumber(value: string): number | null {
  const n = Number(value.replace(',', '.'))
  return value.trim() === '' || Number.isNaN(n) ? null : n
}

function draftFromPlan(plan: NutritionPlan): { window: PlanWindowValue; days: DayDraft[] } {
  return {
    window: {
      name: plan.name,
      notes: plan.notes ?? '',
      validFrom: toDateInput(plan.validFrom),
      validTo: toDateInput(plan.validTo),
    },
    days: plan.days.map((d) => ({
      name: d.name,
      meals: d.meals.map((m) => ({
        slot: m.slot,
        description: m.description,
        grams: m.grams?.toString() ?? '',
        calories: m.calories?.toString() ?? '',
      })),
    })),
  }
}

function NutritionPlanEditor({ plan, onClose }: { plan: NutritionPlan | null; onClose: () => void }) {
  const initial = plan ? draftFromPlan(plan) : { window: emptyWindow(), days: [] as DayDraft[] }
  const [window, setWindow] = useState<PlanWindowValue>(initial.window)
  const [days, setDays] = useState<DayDraft[]>(initial.days)
  const save = useSaveNutritionPlan()

  function updateDay(index: number, next: Partial<DayDraft>) {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...next } : d)))
  }

  function updateMeal(dayIndex: number, mealIndex: number, next: Partial<MealDraft>) {
    setDays((prev) =>
      prev.map((d, i) =>
        i === dayIndex ? { ...d, meals: d.meals.map((m, j) => (j === mealIndex ? { ...m, ...next } : m)) } : d,
      ),
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!window.name.trim() || !window.validFrom) return

    const input: NutritionPlanInput = {
      name: window.name.trim(),
      notes: window.notes.trim() || null,
      validFrom: window.validFrom,
      validTo: window.validTo || null,
      days: days
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          meals: d.meals
            .filter((m) => m.description.trim())
            .map((m) => ({
              slot: m.slot.trim() || 'pasto',
              description: m.description.trim(),
              grams: toNumber(m.grams),
              calories: toNumber(m.calories),
            })),
        })),
    }

    save.mutate({ id: plan?.id, input }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PlanWindowFields value={window} onChange={setWindow} namePlaceholder="Nome scheda, es. Definizione 1800 kcal" />

      {days.map((day, dayIndex) => (
        <div key={dayIndex} style={{ borderTop: '1px solid var(--hud-border, #2a3a4a)', paddingTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="item-meta" style={{ minWidth: 64 }}>
              Giorno {dayIndex + 1}
            </span>
            <input
              className="hud-input"
              placeholder="es. Giorno di allenamento"
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

          {day.meals.map((meal, mealIndex) => (
            <div key={mealIndex} style={{ display: 'flex', gap: 6, marginTop: 6, paddingLeft: 72 }}>
              <input
                className="hud-input"
                style={{ width: 110 }}
                placeholder="colazione"
                value={meal.slot}
                onChange={(e) => updateMeal(dayIndex, mealIndex, { slot: e.target.value })}
              />
              <input
                className="hud-input"
                placeholder="Cosa si mangia"
                value={meal.description}
                onChange={(e) => updateMeal(dayIndex, mealIndex, { description: e.target.value })}
              />
              <input
                className="hud-input"
                style={{ width: 70 }}
                placeholder="g"
                value={meal.grams}
                onChange={(e) => updateMeal(dayIndex, mealIndex, { grams: e.target.value })}
              />
              <input
                className="hud-input"
                style={{ width: 80 }}
                placeholder="kcal"
                value={meal.calories}
                onChange={(e) => updateMeal(dayIndex, mealIndex, { calories: e.target.value })}
              />
              <button
                type="button"
                className="hud-button hud-button--ghost"
                onClick={() => updateDay(dayIndex, { meals: day.meals.filter((_, j) => j !== mealIndex) })}
              >
                ✕
              </button>
            </div>
          ))}

          <button
            type="button"
            className="hud-button hud-button--ghost"
            style={{ marginTop: 6, marginLeft: 72 }}
            onClick={() => updateDay(dayIndex, { meals: [...day.meals, { ...EMPTY_MEAL }] })}
          >
            + pasto
          </button>
        </div>
      ))}

      <button
        type="button"
        className="hud-button hud-button--ghost"
        onClick={() => setDays((prev) => [...prev, { name: '', meals: [{ ...EMPTY_MEAL }] }])}
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

function TodayNutritionPanel() {
  const { data: today, isLoading } = useNutritionToday()
  const apply = useApplyNutritionToday()

  const totalCalories = today?.day.meals.reduce((sum, m) => sum + (m.calories ?? 0), 0) ?? 0

  return (
    <div className="hud-panel">
      <h3>La dieta di oggi</h3>
      {isLoading && <p className="empty">Caricamento...</p>}
      {!isLoading && !today && <p className="empty">Nessuna scheda alimentare attiva per oggi.</p>}
      {today && (
        <>
          <p className="item-meta">
            {today.plan.name} · giorno {today.day.order} di {today.plan.days.length}
            {totalCalories > 0 ? ` · ${Math.round(totalCalories)} kcal` : ''}
          </p>
          <h4 style={{ margin: '8px 0' }}>{today.day.name}</h4>
          <ul>
            {today.day.meals.map((meal, i) => (
              <li key={i}>
                <span>
                  {meal.slot}: {meal.description}
                  {meal.grams ? ` (${meal.grams}g)` : ''}
                </span>
                <span className="item-meta">{meal.calories ? `${Math.round(meal.calories)} kcal` : '—'}</span>
              </li>
            ))}
          </ul>
          {today.day.notes && <p className="link-hint">{today.day.notes}</p>}
          <button
            className="hud-button"
            style={{ marginTop: 12 }}
            disabled={apply.isPending || today.applied}
            onClick={() => apply.mutate()}
          >
            {today.applied ? 'Già nei pasti di oggi' : apply.isPending ? 'Genero...' : 'Metti nei pasti di oggi'}
          </button>
          {apply.isError && <p className="empty">{(apply.error as Error).message}</p>}
        </>
      )}
    </div>
  )
}

function NutritionPlansPanel() {
  const { data: plans, isLoading, error } = useNutritionPlans()
  const remove = useDeleteNutritionPlan()
  const [editing, setEditing] = useState<'new' | NutritionPlan | null>(null)

  return (
    <div className="hud-panel">
      <h3>Le mie schede alimentari</h3>
      <p className="link-hint" style={{ marginBottom: 12 }}>
        Personali: il team vede i pasti registrati, non la scheda. Una sola attiva per volta.
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
          <NutritionPlanEditor
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

function TodayMealsPanel() {
  const { data: summary } = useTeamSummary()

  return (
    <div className="hud-panel">
      <h3>Pasti di oggi</h3>
      {summary && summary.meals.length > 0 ? (
        <ul>
          {summary.meals.map((m) => (
            <li key={m.id}>
              <span>
                {m.planned ? '📋 ' : '✅ '}
                {m.description}
                {m.grams ? ` (${m.grams}g)` : ''}
              </span>
              <span className="item-meta">
                {m.calories ? `${Math.round(m.calories)} kcal` : '—'} · {m.loggedBy}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nessun pasto registrato oggi.</p>
      )}
      {summary && summary.totalCaloriesPlannedToday > 0 && (
        <p className="link-hint">Piano di oggi: {Math.round(summary.totalCaloriesPlannedToday)} kcal previste.</p>
      )}
      <p className="link-hint">Chiedi un piano alimentare al bot con /pianoalimentare.</p>
    </div>
  )
}

function ShoppingListPanel() {
  const { data: summary } = useTeamSummary()

  return (
    <div className="hud-panel">
      <h3>Lista della spesa</h3>
      {summary && summary.shoppingList.length > 0 ? (
        <ul>
          {summary.shoppingList.map((item) => (
            <li key={item.id} style={{ opacity: item.checked ? 0.5 : 1 }}>
              <span>
                {item.checked ? '✅ ' : '⬜ '}
                {item.name}
              </span>
              <span className="item-meta">{item.quantity}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Lista della spesa vuota.</p>
      )}
    </div>
  )
}

function FoodSection() {
  return (
    <div className="panel-grid">
      <TodayNutritionPanel />
      <TodayMealsPanel />
      <NutritionPlansPanel />
      <ShoppingListPanel />
    </div>
  )
}

export default FoodSection
