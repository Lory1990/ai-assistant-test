import { useTeamSummary } from '../queries'
import { GaugeRing } from '../components/GaugeRing'

function OverviewSection() {
  const { data: summary } = useTeamSummary()

  return (
    <>
      <div className="gauge-row">
        <GaugeRing
          size={190}
          percent={summary ? Math.min(100, (summary.totalCaloriesEatenToday / 2000) * 100) : 0}
          value={summary ? `${Math.round(summary.totalCaloriesEatenToday)}` : '—'}
          label="kcal mangiate oggi"
        />
        <GaugeRing
          percent={summary ? Math.min(100, (summary.teamGoals.length + summary.personalGoals.length) * 20) : 0}
          value={summary ? `${summary.teamGoals.length + summary.personalGoals.length}` : '—'}
          label="obiettivi attivi"
        />
        <GaugeRing
          percent={summary ? Math.min(100, (summary.workoutSessionsThisWeek / 7) * 100) : 0}
          value={summary ? `${summary.workoutSessionsThisWeek}` : '—'}
          label="allenamenti (7gg)"
        />
        <GaugeRing
          percent={summary ? Math.min(100, summary.upcomingEvents.length * 20) : 0}
          value={summary ? `${summary.upcomingEvents.length}` : '—'}
          label="eventi importanti"
        />
      </div>

      <div className="panel-grid">
        <div className="hud-panel">
          <h3>Prossimi eventi importanti</h3>
          {summary && summary.upcomingEvents.length > 0 ? (
            <ul>
              {summary.upcomingEvents.map((e) => (
                <li key={e.id}>
                  <span>{e.title}</span>
                  <span className="item-meta">{new Date(e.startsAt).toLocaleString('it-IT')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">Nessun evento importante in arrivo.</p>
          )}
        </div>
      </div>
    </>
  )
}

export default OverviewSection
