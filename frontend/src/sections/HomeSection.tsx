import { useShellyDevices, useToggleShellyDevice, useTahomaShutters, useSendTahomaCommand } from '../queries'
import type { ShellyDevice, TahomaDevice } from '../api/client'

function ShellyPanel() {
  const { data: devices, isLoading, error } = useShellyDevices()
  const toggle = useToggleShellyDevice()

  return (
    <div className="hud-panel">
      <h3>Luci &amp; prese (Shelly)</h3>
      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && devices && devices.length === 0 && <p className="empty">Nessun device Shelly trovato.</p>}
      {devices && devices.length > 0 && (
        <ul>
          {devices.map((d: ShellyDevice) => (
            <li key={d.id}>
              <span>
                {d.online ? '🟢' : '⚪'} {d.name}
              </span>
              <button
                className="hud-button"
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ deviceId: d.id, on: d.state !== 'on' })}
              >
                {d.state === 'on' ? 'Spegni' : 'Accendi'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function TahomaPanel() {
  const { data: shutters, isLoading, error } = useTahomaShutters()
  const sendCommand = useSendTahomaCommand()

  return (
    <div className="hud-panel">
      <h3>Serrande (Tahoma)</h3>
      {error && <p className="empty">{(error as Error).message}</p>}
      {!error && isLoading && <p className="empty">Caricamento...</p>}
      {!error && shutters && shutters.length === 0 && <p className="empty">Nessuna serranda trovata.</p>}
      {shutters && shutters.length > 0 && (
        <ul>
          {shutters.map((s: TahomaDevice) => (
            <li key={s.deviceURL} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <span>{s.label}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="hud-button"
                  disabled={sendCommand.isPending}
                  onClick={() => sendCommand.mutate({ deviceURL: s.deviceURL, command: 'open' })}
                >
                  Apri
                </button>
                <button
                  className="hud-button"
                  disabled={sendCommand.isPending}
                  onClick={() => sendCommand.mutate({ deviceURL: s.deviceURL, command: 'stop' })}
                >
                  Stop
                </button>
                <button
                  className="hud-button"
                  disabled={sendCommand.isPending}
                  onClick={() => sendCommand.mutate({ deviceURL: s.deviceURL, command: 'close' })}
                >
                  Chiudi
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function HomeSection() {
  return (
    <div className="panel-grid">
      <ShellyPanel />
      <TahomaPanel />
    </div>
  )
}

export default HomeSection
