import { useState } from 'react'
import './App.css'

type Tab = 'pasti' | 'obiettivi' | 'calendario' | 'device'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pasti', label: 'Pasti' },
  { id: 'obiettivi', label: 'Obiettivi' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'device', label: 'Device' },
]

function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h2>{title}</h2>
      <p>
        Vista in costruzione. Il backend espone dati e azioni per questa sezione;
        qui andrà collegata la fetch verso <code>/api/...</code>.
      </p>
    </div>
  )
}

function App() {
  const [tab, setTab] = useState<Tab>('pasti')

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Personal AI Assistant</h1>
      <nav style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ fontWeight: tab === t.id ? 'bold' : 'normal' }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'pasti' && <Placeholder title="Pasti registrati" />}
      {tab === 'obiettivi' && <Placeholder title="Obiettivi e azioni motivazionali" />}
      {tab === 'calendario' && <Placeholder title="Eventi importanti" />}
      {tab === 'device' && <Placeholder title="Device Shelly" />}
    </div>
  )
}

export default App
