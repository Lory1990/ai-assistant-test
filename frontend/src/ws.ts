import { useEffect, useRef, useState } from 'react'
import { keycloak } from './auth/keycloak'
import { useInvalidateAllData } from './queries'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const WS_URL = API_URL.replace(/^http/, 'ws') + '/ws'

const RECONNECT_DELAY_MS = 3000

/**
 * WebSocket per aggiornamenti live bidirezionali: il server (API web, bot
 * Telegram, assistente AI) notifica quando qualcosa cambia nel team, e qui
 * invalidiamo tutte le query cosi' la dashboard si aggiorna da sola, senza
 * bisogno di refresh manuale. L'autenticazione avviene inviando l'access
 * token come primo messaggio (il browser non puo' impostare header custom
 * sull'handshake WebSocket).
 */
export function useLiveUpdates(): boolean {
  const invalidateAll = useInvalidateAllData()
  const [connected, setConnected] = useState(false)
  const invalidateAllRef = useRef(invalidateAll)
  invalidateAllRef.current = invalidateAll

  useEffect(() => {
    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      if (cancelled) return
      socket = new WebSocket(WS_URL)

      socket.onopen = async () => {
        await keycloak.updateToken(30).catch(() => undefined)
        socket?.send(JSON.stringify({ type: 'auth', token: keycloak.token }))
      }

      socket.onmessage = (event) => {
        let msg: any
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }
        if (msg.type === 'auth-ok') setConnected(true)
        if (msg.type === 'data-updated') invalidateAllRef.current()
      }

      socket.onclose = () => {
        setConnected(false)
        if (!cancelled) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }

      socket.onerror = () => socket?.close()
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [])

  return connected
}
