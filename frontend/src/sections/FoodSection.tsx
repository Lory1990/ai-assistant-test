import { useTeamSummary } from '../queries'

function FoodSection() {
  const { data: summary } = useTeamSummary()

  return (
    <div className="panel-grid">
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
    </div>
  )
}

export default FoodSection
